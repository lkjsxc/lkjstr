import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { presenceViolations } from './check-feature-presence.mjs';

function inspect(context, source) {
  const directory = mkdtempSync(join(tmpdir(), 'lkjstr-presence-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'presence.ts');
  writeFileSync(path, source.trim());
  return presenceViolations([path]);
}

test('detects a stored refusal and a hidden rail through local state', (context) => {
  const violations = inspect(context, `
    const key = 'rails';
    function say(kind: string, supported: boolean) {
      const next = supported && !refused.has(kind);
      kv.set(key, { ...known, [kind]: next });
    }
    let plain = false;
    function draw(data: Timeline, eligible: boolean) {
      const counted = Boolean(data.supported && data.months.length);
      plain = !counted && eligible;
      rail.hidden = !(counted || plain);
    }
  `);
  assert.equal(violations.length, 2);
  assert.match(violations[0], /:4: keep capability refusals out of persistent storage/);
  assert.match(violations[1], /:10: keep the feature visible while engine data is incomplete/);
});

test('detects direct refusals and a multiline hidden assignment', (context) => {
  assert.equal(inspect(context, `
    kv.set(key, false);
    localStorage.setItem('rails:previous', JSON.stringify({ home: false }));
    window.localStorage.setItem(key, 'refused');
    rail.hidden =
      !engine.cacheComplete;
    rail.toggleAttribute('hidden', !data.supported);
  `).length, 5);
});

test('allows view eligibility, child drawing, relay settings and an explained exception', (context) => {
  assert.deepEqual(inspect(context, `
    rail.hidden = !eligible();
    grip.hidden = rows.length === 0;
    kv.set('relays:', [{ read: false, write: false }]);
    rail.hidden = !data.supported; // absent-by-view: the visitor view uses native scrolling.
  `), []);
});
