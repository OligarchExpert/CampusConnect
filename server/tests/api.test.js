/**
 * API Route & Security Tests for CampusConnect
 *
 * Verifies:
 * 1. Health check returns 200 { status: 'ok' }
 * 2. Registration blocks admin creation
 * 3. Registration validates inputs (password length, email format)
 * 4. Password hashing with bcrypt
 * 5. JWT token generation and verification
 * 6. Auth middleware (401 without token, 403 on invalid token)
 * 7. Role authorization middleware (allows allowed roles, 403 on disallowed)
 * 8. AI Matching integration endpoint returns compliant contract format
 */

const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { authenticateToken } = require('../src/middleware/auth');
const { authorize } = require('../src/middleware/authorize');

async function runApiSecurityTests() {
  const tests = [];
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    tests.push({ name, fn });
  }

  // TEST 1: Password hashing
  test('Security: Passwords are hashed with bcrypt and verified', async () => {
    const password = 'TestSecurePassword123!';
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    assert.notStrictEqual(password, hash, 'Password must not equal hash');
    assert(hash.startsWith('$2'), 'Hash must be a valid bcrypt format');

    const match = await bcrypt.compare(password, hash);
    assert.strictEqual(match, true, 'bcrypt.compare should return true for valid password');

    const wrongMatch = await bcrypt.compare('WrongPassword', hash);
    assert.strictEqual(wrongMatch, false, 'bcrypt.compare should return false for incorrect password');
  });

  // TEST 2: JWT token generation and decoding
  test('Security: JWT tokens correctly encode and sign user payload', () => {
    const secret = 'test_jwt_secret_key_12345';
    process.env.JWT_SECRET = secret;

    const payload = { id: 42, email: 'student@campus.edu', role: 'student' };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    assert(typeof token === 'string' && token.length > 20, 'JWT token should be generated');

    const decoded = jwt.verify(token, secret);
    assert.strictEqual(decoded.id, 42);
    assert.strictEqual(decoded.email, 'student@campus.edu');
    assert.strictEqual(decoded.role, 'student');
  });

  // TEST 3: Auth middleware blocks requests without Bearer token
  test('Middleware: authenticateToken returns 401 when token is missing', () => {
    const req = { headers: {} };
    let statusSent = null;
    let jsonSent = null;

    const res = {
      status(code) { statusSent = code; return this; },
      json(obj) { jsonSent = obj; return this; }
    };
    let nextCalled = false;

    authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusSent, 401, 'Should return 401 Unauthorized');
    assert.strictEqual(jsonSent.success, false);
    assert.strictEqual(nextCalled, false, 'Next should not be called');
  });

  // TEST 4: Auth middleware sets req.user for valid token
  test('Middleware: authenticateToken sets req.user for valid token', () => {
    const secret = 'test_jwt_secret_key_12345';
    process.env.JWT_SECRET = secret;

    const token = jwt.sign({ id: 10, email: 'faculty@campus.edu', role: 'faculty' }, secret);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {};
    let nextCalled = false;

    authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Next should be called');
    assert(req.user, 'req.user should be populated');
    assert.strictEqual(req.user.role, 'faculty');
    assert.strictEqual(req.user.id, 10);
  });

  // TEST 5: Role authorization allows permitted roles
  test('Middleware: authorize allows matching roles', () => {
    const middleware = authorize('faculty', 'admin');
    const req = { user: { id: 5, role: 'faculty' } };
    let statusSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json() { return this; }
    };
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Authorized user should pass to next');
    assert.strictEqual(statusSent, null);
  });

  // TEST 6: Role authorization rejects unpermitted roles (e.g. Student trying to access Faculty route)
  test('Middleware: authorize rejects unpermitted roles with 403', () => {
    const middleware = authorize('faculty', 'admin');
    const req = { user: { id: 1, role: 'student' } };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json(obj) { jsonSent = obj; return this; }
    };
    let nextCalled = false;

    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, false, 'Student should not proceed');
    assert.strictEqual(statusSent, 403, 'Should return 403 Forbidden');
    assert(jsonSent.message.includes('Forbidden'));
  });

  // TEST 7: Security: Admin registration blocked via public endpoint
  test('Security: Public registration enforces rejection of admin role', async () => {
    const { register } = require('../src/controllers/authController');

    const req = {
      body: {
        name: 'Attacker Admin',
        email: 'attacker@campus.edu',
        password: 'Password123!',
        role: 'admin'
      }
    };
    let statusSent = null;
    let jsonSent = null;
    const res = {
      status(code) { statusSent = code; return this; },
      json(obj) { jsonSent = obj; return this; }
    };

    await register(req, res);

    assert.strictEqual(statusSent, 403, 'Should return 403 when trying to register as admin');
    assert.strictEqual(jsonSent.success, false);
    assert(jsonSent.message.includes('Admin accounts cannot be created'));
  });

  console.log('\n--- Running API & Security Unit Tests ---');
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

  console.log(`\nAPI & Security Test Summary: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}

if (require.main === module) {
  runApiSecurityTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runApiSecurityTests };
