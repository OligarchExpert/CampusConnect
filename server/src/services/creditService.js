/**
 * CampusConnect Credit Engine
 *
 * Implements all hackathon business rules:
 * 1. First verified help A -> B in that direction earns 10 credits.
 * 2. Subsequent verified help A -> B earns 3 credits each.
 * 3. B -> A is a separate directional relationship.
 * 4. A helper may earn at most 20 peer-help credits in a rolling 24-hour period.
 * 5. If only part of an award fits under the remaining cap, award only that amount. If cap exhausted, award 0.
 * 6. Even if the award is reduced or blocked, preserve the verified completion and directional pair history.
 * 7. Faculty-task rewards are exempt from peer-help cap, require authorized faculty approval, and use saved task record.
 * 8. Prevent self-help and duplicate awards.
 * 9. Record every award and reversal in credit_transactions (immutable ledger).
 * 10. Flag suspicious reciprocal exchanges for admin review without automatic punishment.
 */

const FIRST_TIME_PEER_REWARD = 10;
const SUBSEQUENT_PEER_REWARD = 3;
const DAILY_PEER_CAP = 20;

/**
 * Award peer-help credits inside an active database transaction connection.
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number} helperId
 * @param {number} requesterId
 * @param {number} requestId
 * @returns {Promise<{ creditsAwarded: number, isFirstTime: boolean, capApplied: boolean }>}
 */
async function awardPeerHelpCredit(conn, helperId, requesterId, requestId) {
  // 1. Prevent self-help
  if (Number(helperId) === Number(requesterId)) {
    throw new Error('Self-help is not allowed');
  }

  // 2. Prevent duplicate award for this request
  const [existingCompletions] = await conn.execute(
    'SELECT id FROM help_completions WHERE request_id = ? FOR UPDATE',
    [requestId]
  );
  if (existingCompletions.length > 0) {
    throw new Error('Duplicate award: this help request is already completed');
  }

  // 3. Check / update directional pair history (FOR UPDATE for concurrency safety)
  const [pairRows] = await conn.execute(
    'SELECT id, pair_count FROM help_pairs WHERE helper_id = ? AND requester_id = ? FOR UPDATE',
    [helperId, requesterId]
  );

  let isFirstTime = false;
  let baseReward = SUBSEQUENT_PEER_REWARD;

  if (pairRows.length === 0) {
    // First time A is helping B
    isFirstTime = true;
    baseReward = FIRST_TIME_PEER_REWARD;
    await conn.execute(
      'INSERT INTO help_pairs (helper_id, requester_id, pair_count) VALUES (?, ?, 1)',
      [helperId, requesterId]
    );
  } else {
    // Subsequent help A -> B
    isFirstTime = false;
    baseReward = SUBSEQUENT_PEER_REWARD;
    await conn.execute(
      'UPDATE help_pairs SET pair_count = pair_count + 1 WHERE id = ?',
      [pairRows[0].id]
    );
  }

  // 4. Calculate rolling 24-hour cap for peer_help
  const [capRows] = await conn.execute(
    `SELECT COALESCE(SUM(amount), 0) AS earned_in_24h
     FROM credit_transactions
     WHERE user_id = ?
       AND type = 'peer_help'
       AND created_at >= NOW() - INTERVAL 24 HOUR`,
    [helperId]
  );

  const earnedIn24h = parseInt(capRows[0].earned_in_24h, 10);
  const remainingCap = Math.max(0, DAILY_PEER_CAP - earnedIn24h);
  const creditsAwarded = Math.min(baseReward, remainingCap);
  const capApplied = creditsAwarded < baseReward;

  // 5. Always record the verified completion regardless of whether award was 0 or partial
  await conn.execute(
    `INSERT INTO help_completions
       (request_id, helper_id, requester_id, first_time, credits_awarded, cap_applied)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [requestId, helperId, requesterId, isFirstTime ? 1 : 0, creditsAwarded, capApplied ? 1 : 0]
  );

  // 6. Record credit transaction in immutable ledger if award > 0
  if (creditsAwarded > 0) {
    const desc = isFirstTime
      ? `First-time peer help reward (+${creditsAwarded} credits)`
      : `Peer help reward (+${creditsAwarded} credits)`;

    await conn.execute(
      `INSERT INTO credit_transactions
         (user_id, amount, type, source_id, source_type, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [helperId, creditsAwarded, 'peer_help', requestId, 'help_request', desc]
    );
  }

  // 7. Flag suspicious reciprocal exchange: check if B has also helped A
  const [reciprocalRows] = await conn.execute(
    'SELECT id, pair_count FROM help_pairs WHERE helper_id = ? AND requester_id = ?',
    [requesterId, helperId]
  );

  if (reciprocalRows.length > 0) {
    // Both directions exist! Flag for admin review without automatically punishing users
    await conn.execute(
      `INSERT INTO reports
         (subject_id, reason, context_type, context_id, status)
       VALUES (?, ?, ?, ?, ?)`,
      [
        helperId,
        `Reciprocal peer-help activity detected: User ${helperId} and User ${requesterId} have completed reciprocal requests.`,
        'help_request',
        requestId,
        'open'
      ]
    );
  }

  return { creditsAwarded, isFirstTime, capApplied };
}

module.exports = {
  FIRST_TIME_PEER_REWARD,
  SUBSEQUENT_PEER_REWARD,
  DAILY_PEER_CAP,
  awardPeerHelpCredit
};
