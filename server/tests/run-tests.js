/**
 * CampusConnect Test Runner
 * Executes all test suites and reports final status.
 */

const { runCreditEngineTests } = require('./creditEngine.test');
const { runApiSecurityTests } = require('./api.test');

async function main() {
  console.log('====================================================');
  console.log('  CampusConnect Automated Test Suite');
  console.log('====================================================');

  const suite1 = await runCreditEngineTests();
  const suite2 = await runApiSecurityTests();

  const totalPassed = suite1.passed + suite2.passed;
  const totalFailed = suite1.failed + suite2.failed;

  console.log('====================================================');
  console.log(`TOTAL RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log('====================================================');

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    console.log('All tests passed successfully! 🎉');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
