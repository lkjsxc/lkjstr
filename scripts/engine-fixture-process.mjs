// Frozen-package debugging can run already-built fixture helpers without Cargo.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
export function fixtureProcess(name, options) {
  if (!['engine-fixtures', 'engine-bunker'].includes(name)) throw new Error('Unknown fixture');
  return process.env.LKJSTR_PREBUILT_FIXTURES === '1'
    ? spawn(resolve('target/debug/examples', name), [], options)
    : spawn('cargo', ['run', '-q', '-p', 'lkjstr-core', '--example', name], options);
}
