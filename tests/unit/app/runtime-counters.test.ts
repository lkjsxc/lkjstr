import { afterEach, describe, expect, it } from 'vitest';
import {
  countRuntime,
  runtimeCounterSnapshots,
  setRuntimeCountersEnabled,
} from '../../../src/lib/app/runtime-counters';

describe('runtime counters', () => {
  afterEach(() => setRuntimeCountersEnabled(false));

  it('rejects non-static counter keys when counters are enabled', () => {
    setRuntimeCountersEnabled(true);

    expect(() =>
      countRuntime('timeline:dynamic-tab' as never, 'created'),
    ).toThrow('Unknown runtime counter key');
    countRuntime('timeline:home', 'created');

    expect(runtimeCounterSnapshots()).toEqual([
      expect.objectContaining({ key: 'timeline:home', created: 1 }),
    ]);
  });
});
