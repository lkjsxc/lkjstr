import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

export default class PlaywrightQuietReporter implements Reporter {
  printsToStdio(): boolean {
    return true;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'passed' || result.status === 'skipped') return;
    const location = test.location;
    const where = location
      ? `${location.file}:${location.line}:${location.column}`
      : test.titlePath().join(' > ');
    console.error(`FAIL ${where}`);
    console.error(`  project: ${test.parent.project()?.name ?? 'unknown'}`);
    if (result.error?.message) console.error(`  ${result.error.message}`);
    const trace = result.attachments.find((item) => item.name === 'trace');
    if (trace?.path) console.error(`  trace: ${trace.path}`);
  }

  onEnd(result: FullResult): void {
    if (result.status === 'passed') return;
    console.error(`playwright run ${result.status}`);
  }
}
