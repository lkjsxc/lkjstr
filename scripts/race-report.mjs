import { readFile, writeFile, cp, mkdir, rm, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
export const defaultNpub = 'npub1s02jksmr6tgmcksf3hnmue7pyzlm0sxwarh7lk8tdeprw2hjg6ysp7fxtw';
const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const polymod = values => {
  let value = 1;
  for (const item of values) {
    const top = value >>> 25; value = ((value & 0x1ffffff) << 5) ^ item;
    [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].forEach((generator, i) => { if ((top >>> i) & 1) value ^= generator; });
  }
  return value >>> 0;
};
const prefix = [3, 3, 3, 3, 0, 14, 16, 21, 2]; // The bech32 expansion of "npub".
export function publicIdentity(input) {
  let pubkey = input;
  if (input.startsWith('npub1')) {
    const words = [...input.slice(5)].map(char => alphabet.indexOf(char));
    if (words.some(word => word < 0) || polymod([...prefix, ...words]) !== 1) throw Error('Invalid npub checksum');
    let value = 0, bits = 0; const bytes = [];
    for (const word of words.slice(0, -6)) {
      value = ((value << 5) | word) & 65535; bits += 5;
      if (bits >= 8) bytes.push((value >>> (bits -= 8)) & 255);
    }
    if (bytes.length !== 32 || (value & ((1 << bits) - 1))) throw Error('Invalid npub payload');
    pubkey = Buffer.from(bytes).toString('hex');
  }
  if (!/^[0-9a-f]{64}$/.test(pubkey)) throw Error('Only npub or a 64-hex public key is accepted');
  let value = 0, bits = 0; const words = [];
  for (const byte of Buffer.from(pubkey, 'hex')) {
    value = ((value << 8) | byte) & 65535; bits += 8;
    while (bits >= 5) words.push((value >>> (bits -= 5)) & 31);
  }
  if (bits) words.push((value << (5 - bits)) & 31);
  const sum = polymod([...prefix, ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const checksum = Array.from({ length: 6 }, (_, i) => (sum >>> (5 * (5 - i))) & 31);
  return { pubkey, npub: 'npub1' + [...words, ...checksum].map(word => alphabet[word]).join('') };
}
export function median(values, expected = values.length) {
  if (values.length !== expected || !values.length || values.some(value => !Number.isFinite(value))) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function summarise(report) {
  const groups = new Map();
  for (const run of report.runs) {
    const key = run.scenario + ':' + run.site;
    if (!groups.has(key)) groups.set(key, []); groups.get(key).push(run);
  }
  return [...groups.entries()].map(([key, runs]) => {
    const expected = runs[0].scenario === 'phone-cold' ? 1 : report.requestedRuns;
    const valid = runs.filter(run => !run.failure && run.validReadOnly);
    const metric = name => median(valid.map(run => run.dom?.marks[name]), expected);
    return { scenario: runs[0].scenario, site: runs[0].site, expected, valid: valid.length,
      firstNoteMs: metric('firstNoteMs'), firstScreenMs: metric('firstScreenMs'), tenRenderedMs: metric('tenRenderedMs'),
      firstScreenSettledMs: metric('firstScreenSettledMs'), tenSettledMs: metric('tenSettledMs'),
      restMs: metric('restMs'), finalRestMs: median(valid.map(run => run.dom?.finalRestMs), expected),
      cls: median(valid.map(run => run.dom?.cls), expected),
      totalLayoutShift: median(valid.map(run => run.dom?.totalLayoutShift), expected),
      bytes: median(valid.map(run => (run.network?.httpTransferredBytes ?? 0) + (run.network?.websocketReceivedPayloadBytes ?? 0)), expected),
      longTasks: median(valid.map(run => run.dom?.longTasks), expected),
      longTaskMs: median(valid.map(run => run.dom?.longTaskMs), expected),
      profileAgeHours: median(valid.map(run => run.provenance.profileAgeHours), expected),
      idleSeconds: median(valid.map(run => run.provenance.idleSeconds), expected),
      firstScreenBeforeRelay: valid.filter(run => run.beforeRelay === true).length,
      unresolved: valid.map(run => ({ run: run.index, missing: Object.keys({ firstNoteMs: 1, firstScreenMs: 1, tenRenderedMs: 1, restMs: 1 })
        .filter(name => run.dom?.marks[name] === undefined) })).filter(item => item.missing.length) };
  });
}
export async function saveReport(directory, report) {
  report.summary = summarise(report);
  await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2));
  const number = (value, digits = 1) => value === null || value === undefined ? 'unavailable' : value.toFixed(digits);
  const lines = ['# Open race', '', 'Started: ' + report.started + '. Initial load: ' + report.initialLoadAverage.join('/') + '.', '',
    '| Situation | Client | Valid/runs | First note ms | First screen ms | First 10 rendered ms | Rest ms | Final rest ms | CLS | Bytes | Long tasks |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const row of report.summary) lines.push('| ' + [row.scenario, row.site, row.valid + '/' + row.expected,
    number(row.firstNoteMs), number(row.firstScreenMs), number(row.tenRenderedMs), number(row.restMs), number(row.finalRestMs),
    number(row.cls, 5), number(row.bytes, 0), number(row.longTasks, 0)].join(' | ') + ' |');
  lines.push('', ...report.limitations.map(text => '- ' + text), '');
  await writeFile(resolve(directory, 'report.md'), lines.join('\n'));
}
export async function copyProfile(source, destination) {
  await mkdir(destination, { recursive: true });
  await cp(source, destination, { recursive: true, filter: path => !/\/(?:SingletonLock|SingletonSocket|SingletonCookie|DevToolsActivePort)$/.test(path) });
}
export function foundationWitnesses(report) {
  if (!Number.isFinite(Date.parse(report.finished)) || report.cleanupFailure?.length ||
      report.networkRoute?.listenerClosed === false) throw Error('Prior race is not closed cleanly');
  const account = publicIdentity(report.account?.npub ?? '');
  if (account.pubkey !== report.account.pubkey) throw Error('Prior public account identity disagrees');
  return ['nostter', 'lkjstr'].map(site => {
    const foundation = report.foundations?.[site];
    const run = report.runs?.find(item => item.site === site && item.finished === foundation?.lastClosed);
    const workload = report.workloads?.find(item => item.site === site && item.finished === foundation?.lastClosed);
    const source = run ?? workload, network = run?.network ?? workload?.guard;
    if (!foundation || !source || source.failure || source.profile?.readOnly !== true ||
        (run && run.validReadOnly !== true) || network?.forbiddenSentFrames !== 0 ||
        !network.guards?.some(item => item.type === 'page') ||
        network.guards.some(item => !item.guard || item.guard.forbidden !== 0))
      throw Error('Prior foundation lacks a completed read-only source witness: ' + site);
    return { site, source: run ? run.scenario : 'Home workload', index: run?.index ?? null,
      finished: foundation.lastClosed, matrixComplete: report.complete === true };
  });
}
export async function priorRun(requested) {
  const directory = await realpath(resolve(requested)), report = JSON.parse(await readFile(resolve(directory, 'report.json'), 'utf8'));
  const owner = report.ownership, root = await realpath(owner?.root ?? '/__invalid-race-owner');
  const part = relative(resolve(root, 'tmp'), directory);
  if (owner?.kind !== 'lkjstr-open-race' || owner.directory !== directory || isAbsolute(part) || part === '..' || part.startsWith('../') ||
      !/^[0-9a-f-]{36}$/.test(owner.id)) throw Error('Not an owned public race profile');
  const witnesses = foundationWitnesses(report);
  for (const foundation of Object.values(report.foundations)) {
    if (await realpath(foundation.profile) !== foundation.profile || !foundation.profile.startsWith(directory + '/'))
      throw Error('Race profile is not within its owned run');
  }
  return { ...report, profileReuse: { basis: 'closed read-only source observations', witnesses } };
}
export const fileHash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
export { rm };
