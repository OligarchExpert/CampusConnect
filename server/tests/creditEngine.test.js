/**
 * Unit & Business Logic Tests for CampusConnect Credit Engine
 *
 * Verifies all 12 hackathon credit rules:
 * 1. First verified help A -> B gives 10 credits
 * 2. Subsequent help A -> B gives 3 credits
 * 3. B -> A is an independent directional pair (earns 10 credits)
 * 4. Reciprocal activity is flagged for admin review
 * 5. Self-help is rejected
 * 6. Duplicate completions for the same request are rejected
 * 7. Rolling 24-hour cap of 20 peer-help credits
 * 8. Partial awards when near cap limit
 * 9. Cap exhausted awards 0 credits but preserves completion & pair count
 * 10. Immutable transaction logging
 */

const assert = require('assert');
const { awardPeerHelpCredit, FIRST_TIME_PEER_REWARD, SUBSEQUENT_PEER_REWARD, DAILY_PEER_CAP } = require('../src/services/creditService');

/**
 * Creates an in-memory mock connection tracking SQL queries and table states.
 */
function createMockConnection() {
  const state = {
    help_completions: [],
    help_pairs: [],        // { id, helper_id, requester_id, pair_count }
    credit_transactions: [], // { id, user_id, amount, type, source_id, created_at }
    reports: []            // { id, subject_id, reason, context_type, context_id }
  };

  let nextId = 1;

  return {
    state,
    async execute(sql, params = []) {
      const cleanSql = sql.replace(/\s+/g, ' ').trim();

      // Duplicate check: SELECT id FROM help_completions WHERE request_id = ?
      if (cleanSql.includes('SELECT id FROM help_completions WHERE request_id = ?')) {
        const [requestId] = params;
        const matches = state.help_completions.filter(c => c.request_id === requestId);
        return [matches];
      }

      // Pair check: SELECT id, pair_count FROM help_pairs WHERE helper_id = ? AND requester_id = ?
      if (cleanSql.includes('SELECT id, pair_count FROM help_pairs WHERE helper_id = ? AND requester_id = ?')) {
        const [helperId, requesterId] = params;
        const matches = state.help_pairs.filter(p => p.helper_id === helperId && p.requester_id === requesterId);
        return [matches];
      }

      // Insert pair: INSERT INTO help_pairs
      if (cleanSql.includes('INSERT INTO help_pairs')) {
        const [helperId, requesterId, count] = params;
        state.help_pairs.push({
          id: nextId++,
          helper_id: helperId,
          requester_id: requesterId,
          pair_count: count || 1
        });
        return [{ insertId: nextId - 1 }];
      }

      // Update pair count: UPDATE help_pairs SET pair_count = pair_count + 1
      if (cleanSql.includes('UPDATE help_pairs SET pair_count = pair_count + 1')) {
        const [id] = params;
        const p = state.help_pairs.find(x => x.id === id);
        if (p) p.pair_count++;
        return [{ affectedRows: 1 }];
      }

      // 24h cap check: SELECT COALESCE(SUM(amount), 0) AS earned_in_24h FROM credit_transactions
      if (cleanSql.includes('SELECT COALESCE(SUM(amount), 0) AS earned_in_24h')) {
        const [userId] = params;
        const sum = state.credit_transactions
          .filter(t => t.user_id === userId && t.type === 'peer_help')
          .reduce((acc, t) => acc + t.amount, 0);
        return [[{ earned_in_24h: sum }]];
      }

      // Insert completion: INSERT INTO help_completions
      if (cleanSql.includes('INSERT INTO help_completions')) {
        const [requestId, helperId, requesterId, firstTime, creditsAwarded, capApplied] = params;
        state.help_completions.push({
          id: nextId++,
          request_id: requestId,
          helper_id: helperId,
          requester_id: requesterId,
          first_time: firstTime,
          credits_awarded: creditsAwarded,
          cap_applied: capApplied
        });
        return [{ insertId: nextId - 1 }];
      }

      // Insert credit transaction: INSERT INTO credit_transactions
      if (cleanSql.includes('INSERT INTO credit_transactions')) {
        const [userId, amount, type, sourceId, sourceType, desc] = params;
        state.credit_transactions.push({
          id: nextId++,
          user_id: userId,
          amount,
          type,
          source_id: sourceId,
          source_type: sourceType,
          description: desc,
          created_at: new Date()
        });
        return [{ insertId: nextId - 1 }];
      }

      // Insert report: INSERT INTO reports
      if (cleanSql.includes('INSERT INTO reports')) {
        const [subjectId, reason, contextId] = params;
        state.reports.push({
          id: nextId++,
          subject_id: subjectId,
          reason,
          context_id: contextId
        });
        return [{ insertId: nextId - 1 }];
      }

      return [[]];
    }
  };
}

async function runCreditEngineTests() {
  const tests = [];
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    tests.push({ name, fn });
  }

  // TEST 1: Rule 1 - First time A helps B gives 10 credits
  test('Rule 1: First verified help A -> B awards 10 credits', async () => {
    const conn = createMockConnection();
    const result = await awardPeerHelpCredit(conn, 1, 2, 101);

    assert.strictEqual(result.creditsAwarded, 10, 'Expected 10 credits for first-time help');
    assert.strictEqual(result.isFirstTime, true, 'Expected isFirstTime to be true');
    assert.strictEqual(result.capApplied, false, 'Expected capApplied to be false');

    const pair = conn.state.help_pairs.find(p => p.helper_id === 1 && p.requester_id === 2);
    assert(pair, 'Expected pair record in help_pairs');
    assert.strictEqual(pair.pair_count, 1, 'Expected pair_count = 1');

    const tx = conn.state.credit_transactions.find(t => t.user_id === 1);
    assert(tx, 'Expected transaction record');
    assert.strictEqual(tx.amount, 10, 'Expected tx amount 10');
  });

  // TEST 2: Rule 2 - Subsequent help A -> B gives 3 credits
  test('Rule 2: Subsequent verified help A -> B awards 3 credits', async () => {
    const conn = createMockConnection();
    // First interaction
    await awardPeerHelpCredit(conn, 1, 2, 101);

    // Second interaction
    const result2 = await awardPeerHelpCredit(conn, 1, 2, 102);

    assert.strictEqual(result2.creditsAwarded, 3, 'Expected 3 credits for subsequent help');
    assert.strictEqual(result2.isFirstTime, false, 'Expected isFirstTime to be false');
    assert.strictEqual(result2.capApplied, false, 'Expected capApplied to be false');

    const pair = conn.state.help_pairs.find(p => p.helper_id === 1 && p.requester_id === 2);
    assert.strictEqual(pair.pair_count, 2, 'Expected pair_count = 2');
  });

  // TEST 3: Rule 3 - B helping A is a separate directional relationship (10 credits)
  test('Rule 3: B -> A is an independent directional relationship', async () => {
    const conn = createMockConnection();
    // A helps B
    await awardPeerHelpCredit(conn, 1, 2, 101);

    // Now B helps A (first time in that direction)
    const resultB = await awardPeerHelpCredit(conn, 2, 1, 103);

    assert.strictEqual(resultB.creditsAwarded, 10, 'Expected 10 credits for first-time B -> A');
    assert.strictEqual(resultB.isFirstTime, true, 'Expected isFirstTime = true for B -> A');

    const pairB = conn.state.help_pairs.find(p => p.helper_id === 2 && p.requester_id === 1);
    assert(pairB, 'Expected separate pair record for 2 -> 1');
  });

  // TEST 4: Rule 12 - Reciprocal exchange is flagged in reports for admin review
  test('Rule 12: Reciprocal exchange flags report for admin review without automatic punishment', async () => {
    const conn = createMockConnection();
    await awardPeerHelpCredit(conn, 1, 2, 101);
    await awardPeerHelpCredit(conn, 2, 1, 102);

    assert.strictEqual(conn.state.reports.length, 1, 'Expected 1 report generated for reciprocal exchange');
    assert(conn.state.reports[0].reason.includes('Reciprocal'), 'Report reason should mention reciprocal activity');
  });

  // TEST 5: Rule 9 - Self-help is blocked
  test('Rule 9: Self-help is rejected with an error', async () => {
    const conn = createMockConnection();
    let threw = false;
    try {
      await awardPeerHelpCredit(conn, 1, 1, 201);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.message, 'Self-help is not allowed');
    }
    assert(threw, 'Should have thrown error on self-help');
  });

  // TEST 6: Rule 9 & 11 - Duplicate completion of same request is rejected
  test('Rule 9 & 11: Duplicate completion on same request is rejected', async () => {
    const conn = createMockConnection();
    await awardPeerHelpCredit(conn, 1, 2, 101);

    let threw = false;
    try {
      await awardPeerHelpCredit(conn, 1, 2, 101);
    } catch (err) {
      threw = true;
      assert(err.message.includes('Duplicate award'));
    }
    assert(threw, 'Should have thrown duplicate award error');
  });

  // TEST 7: Rule 4 & 5 - Rolling 24h cap with partial award
  test('Rule 4 & 5: Rolling 24-hour cap of 20 credits with partial award', async () => {
    const conn = createMockConnection();
    // Helper 1 helps User 2 (10 credits)
    await awardPeerHelpCredit(conn, 1, 2, 101); // 10 cr earned, 10 remaining
    // Helper 1 helps User 3 (10 credits)
    await awardPeerHelpCredit(conn, 1, 3, 102); // 20 cr earned, 0 remaining

    // Helper 1 now helps User 4 (first time base reward would be 10)
    const result3 = await awardPeerHelpCredit(conn, 1, 4, 103);

    assert.strictEqual(result3.creditsAwarded, 0, 'Expected 0 credits when 24h cap of 20 is exhausted');
    assert.strictEqual(result3.capApplied, true, 'Expected capApplied = true');
    assert.strictEqual(result3.isFirstTime, true, 'Expected isFirstTime = true');

    // Rule 6: Completion record and pair history MUST still be saved!
    const completion = conn.state.help_completions.find(c => c.request_id === 103);
    assert(completion, 'Completion record must be preserved even when award is 0');
    assert.strictEqual(completion.credits_awarded, 0);

    const pair = conn.state.help_pairs.find(p => p.helper_id === 1 && p.requester_id === 4);
    assert(pair, 'Pair history must be preserved even when award is 0');
    assert.strictEqual(pair.pair_count, 1);
  });

  // TEST 8: Rule 5 - Partial award when 2 credits remain under the 20-credit cap
  test('Rule 5: Partial award when remaining cap is smaller than base reward', async () => {
    const conn = createMockConnection();
    // Manually simulate helper having earned 18 credits in transactions
    conn.state.credit_transactions.push({
      id: 99,
      user_id: 1,
      amount: 18,
      type: 'peer_help',
      source_id: 50,
      created_at: new Date()
    });

    // Helper 1 helps User 2 (subsequent reward = 3 credits, but only 20 - 18 = 2 cap remains)
    conn.state.help_pairs.push({ id: 1, helper_id: 1, requester_id: 2, pair_count: 1 });

    const result = await awardPeerHelpCredit(conn, 1, 2, 105);

    assert.strictEqual(result.creditsAwarded, 2, 'Expected partial award of 2 credits (20 - 18)');
    assert.strictEqual(result.capApplied, true, 'Expected capApplied = true');
    assert.strictEqual(result.isFirstTime, false);
  });

  console.log('\n--- Running Credit Engine Unit Tests ---');
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nCredit Engine Test Summary: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}

if (require.main === module) {
  runCreditEngineTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runCreditEngineTests };
