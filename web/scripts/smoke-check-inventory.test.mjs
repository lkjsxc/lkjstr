import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCheckInventory } from './smoke-check-inventory.mjs';
import { realSmokeChecks } from './smoke-real-checks.mjs';
import { uploadSmokeChecks } from './smoke-upload-checks.mjs';

const scripts = fileURLToPath(new URL('.', import.meta.url));
const temporary = fileURLToPath(new URL('../../tmp/', import.meta.url));

// Exercise the real recorder's exit status and retained evidence in a browser-free run.
function run(t, expected, body, argument = null) {
  mkdirSync(temporary, { recursive: true });
  const dir = mkdtempSync(join(temporary, 'inventory-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = `
    import { createCheckInventory } from './smoke-check-inventory.mjs';
    import { createSmokeResults } from './smoke-real-results.mjs';

    const inventory = createCheckInventory(${JSON.stringify(expected)});
    const results = createSmokeResults(inventory);
    try {
      ${body}
      results.complete();
    } catch (error) {
      await results.fail(error);
    }
    await results.writeReport([], { published: [], searches: [] });
    results.finish([]);
  `;
  const child = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', source, JSON.stringify(argument)],
    {
      cwd: scripts,
      encoding: 'utf8',
      env: { ...process.env, LKJSTR_SMOKE_OUTPUT: dir },
    },
  );
  assert.ifError(child.error);
  const report = JSON.parse(readFileSync(join(dir, 'smoke-real/report.json'), 'utf8'));
  const failureLog = readFileSync(join(dir, 'smoke-real-failures.jsonl'), 'utf8').trim();
  assert.deepEqual(failureLog ? failureLog.split('\n').map(JSON.parse) : [], report.failures);
  const progress = readFileSync(join(dir, 'smoke-real-progress.log'), 'utf8').trim().split('\n');
  return { child, report, progress };
}

test('the smoke exit and failure report identify missing, extra and repeated checks', async (t) => {
  const controls = [
    { names: ['first', 'second'], missing: [], extra: [], duplicates: [] },
    { names: ['first'], missing: ['second'], extra: [], duplicates: [] },
    { names: ['first', 'second', 'third'], missing: [], extra: ['third'], duplicates: [] },
    { names: ['first', 'second', 'first'], missing: [], extra: [], duplicates: [['first', 2]] },
    { names: ['first', 'first'], missing: ['second'], extra: [], duplicates: [['first', 2]] },
  ];
  for (const { names, ...mismatch } of controls) {
    await t.test(names.join(', '), (t) => {
      const { child, report, progress } = run(
        t,
        ['first', 'second'],
        'for (const name of JSON.parse(process.argv[1])) results.check(name);',
        names,
      );
      const failed = Object.values(mismatch).some((list) => list.length > 0);
      assert.equal(child.status, failed ? 1 : 0, child.stderr);
      assert.equal(child.stdout, failed ? '' : 'ok smoke-real\n');
      assert.deepEqual(
        progress,
        names.map((name) => `ok ${name}`),
      );
      if (failed) {
        const error = `Error: Smoke check inventory mismatch: ${JSON.stringify(mismatch)}`;
        assert.equal(report.checks.failure, error);
        assert.equal(report.failures[0].error, error);
      } else {
        assert.deepEqual(report.failures, []);
      }
    });
  }
});

test('interleaved lanes and nonthrowing observations can complete together', (t) => {
  const { child, progress } = run(
    t,
    ['a1', 'a2', 'b1', 'b2', 'wire 1', 'wire 2'],
    `
    const lane = async (name) => {
      results.check(name + '1');
      await Promise.resolve();
      results.check(name + '2');
    };
    await Promise.all([lane('b'), lane('a')]);
    await results.observe([['wire 1', true], ['wire 2', true]]);
  `,
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(progress, ['ok b1', 'ok a1', 'ok b2', 'ok a2', 'ok wire 1', 'ok wire 2']);
});

test('a failed check stops its lane and keeps evidence from its sibling', (t) => {
  const { child, report, progress } = run(
    t,
    ['stop', 'unreached', 'sibling', 'wire 1', 'wire 2'],
    `
    const stopped = async () => {
      results.check('stop', false);
      results.check('unreached');
    };
    const sibling = async () => {
      await Promise.resolve();
      results.check('sibling');
    };
    await Promise.allSettled([stopped(), sibling()]);
    await results.observe([['wire 1', false], ['wire 2', true]]);
  `,
  );
  assert.equal(child.status, 1);
  assert.deepEqual(progress, ['FAIL stop', 'ok sibling', 'FAIL wire 1', 'ok wire 2']);
  assert.deepEqual(
    report.failures.map(({ name }) => name),
    ['stop', 'wire 1'],
  );
});

test('each real mode selects its own required checks', () => {
  const needsScreenshot = ['server marks agree in a second app page', 'narrow time rail is 16px'];
  for (const shots of [false, true]) {
    const full = realSmokeChecks(shots);
    const quick = uploadSmokeChecks({ quick: true, shots });
    assert.doesNotThrow(() => createCheckInventory(full));
    assert.doesNotThrow(() => createCheckInventory(quick));
    assert.equal(full.includes(needsScreenshot[0]), shots);
    assert.equal(quick.includes(needsScreenshot[0]), shots);
    assert.equal(full.includes(needsScreenshot[1]), shots);
    assert.equal(quick.includes(needsScreenshot[1]), false);
    assert.ok(
      full.includes(
        'view state: a picture opens as a new tab right after its own, in the same tile',
      ),
    );
    assert.ok(full.includes('upload extension hang retries the retained file'));
    assert.ok(!quick.includes('upload extension hang retries the retained file'));
    assert.ok(quick.includes('no upload page errors'));
    assert.ok(!full.includes('no upload page errors'));
  }
  assert.throws(
    () => createCheckInventory(['repeat', 'repeat']),
    /Duplicate name in smoke inventory/,
  );
});
