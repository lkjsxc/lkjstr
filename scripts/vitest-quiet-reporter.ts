import type {
  Reporter,
  SerializedError,
  TestCase,
  TestModule,
  TestRunEndReason,
} from 'vitest/node';

export default class VitestQuietReporter implements Reporter {
  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason,
  ): void {
    if (reason === 'passed') return;

    for (const error of unhandledErrors) {
      console.error(formatSerializedError(error));
    }

    for (const testCase of allTestCases(testModules)) {
      if (testCase.result().state !== 'failed') continue;
      const file = testCase.module.moduleId;
      console.error(`FAIL ${testCase.fullName} (${file})`);
      for (const err of testCase.result().errors ?? []) {
        console.error(formatSerializedError(err));
      }
    }
  }
}

function allTestCases(
  testModules: ReadonlyArray<TestModule>,
): TestCase[] {
  return testModules.flatMap((module) => [...module.children.allTests()]);
}

function formatSerializedError(error: SerializedError): string {
  const message = error.message ?? 'unknown error';
  const stack = error.stack ?? '';
  return stack ? `${message}\n${stack}` : message;
}
