/**
 * CampusConnect Test Runner
 * Executes all test suites and reports final status.
 */

const { runCreditEngineTests } = require('./creditEngine.test');
const { runApiSecurityTests } = require('./api.test');
const { runMatchingTests } = require('./matching.test');
const { runEndToEndScenarioTests } = require('./e2e-scenarios.test');
const { runWelfareTests } = require('./welfare.test');

async function main() {
  console.log('====================================================');
  console.log('  CampusConnect Automated Test Suite');
  console.log('====================================================');

  const suite1 = await runCreditEngineTests();
  const suite2 = await runApiSecurityTests();
  const suite3 = await runMatchingTests();
  const suite4 = await runEndToEndScenarioTests();
  const suite5 = await runWelfareTests();

  const totalPassed = suite1.passed + suite2.passed + suite3.passed + suite4.passed + suite5.passed;
  const totalFailed = suite1.failed + suite2.failed + suite3.failed + suite4.failed + suite5.failed;

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
