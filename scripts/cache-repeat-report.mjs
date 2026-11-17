import { writeFile } from 'node:fs/promises';
import { summariseRepeat } from './cache-repeat-model.mjs';
const number = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : 'unavailable';
export async function saveRepeat(directory, report) {
  report.summary = summariseRepeat(report);
  await writeFile(directory + '/report.json', JSON.stringify(report, null, 2) + '\n');
  const result = report.summary;
  const lines = ['# Cache repeat measurement', '', 'Started: ' + report.started + '.',
    'Mode: ' + result.mode + '; completed hour protocol: ' + result.completedHour + '.',
    'Initial load: ' + report.initialLoadAverage.join(', ') + '.', '',
    '| Measure | Result |', '| --- | --- |',
    '| Previously held repeat visits | ' + result.previouslyHeldVisits + ' |',
    '| Held screen painted within 100 ms | ' + result.cachedPaintWithin100 + ' |',
    '| Painted within 100 ms before a relay event | ' + result.cacheConfirmedWithin100 + ' |',
    '| Painted within 100 ms with a stored-window mark (secondary) | ' + result.cacheMarkedWithin100 + ' |',
    '| Stored-window mark observed in this build | ' + result.cacheReplayMarkObserved + ' |',
    '| Share confirmed from cache | ' + number(result.cacheConfirmedShare === null ? null : result.cacheConfirmedShare * 100) + '% |',
    '| Second / first received events | ' + number(result.secondToFirstEvents, 4) + ' |',
    '| Second / first received WS payload bytes | ' + number(result.secondToFirstWebSocketBytes, 4) + ' |',
    '| Previously named author raw for over 100 ms | ' + result.knownAuthorRawOver100 + ' |', '',
    'A frame after the DOM contains held visible row keys, names and previously loaded pictures is the paint proxy.',
    'It is not a compositor screenshot timestamp. Relay overlap makes the source unproven.',
    'Payload bytes exclude WebSocket framing, TLS and compression; HTTP encoded bytes are reported separately.', '',
    '| Phase | Visit | Kind | First content ms | Held screen ms | Evidence | Events | Received bytes |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const row of report.visits) lines.push('| ' + [row.phase, row.id, row.kind,
    number(row.dom?.firstContentMs), number(row.dom?.cachedScreenMs), row.result?.status ?? 'unavailable',
    row.network?.events ?? 'unavailable', row.network?.receivedBytes ?? 'unavailable'].join(' | ') + ' |');
  lines.push('', '## Coverage limits', '');
  for (const gap of result.coverageGaps) lines.push('- ' + gap);
  if (result.missingKinds.length) lines.push('- Unvisited or unavailable: ' + result.missingKinds.join(', ') + '.');
  if (report.failure) lines.push('- Run failed: see bounded diagnostics in report.json.');
  await writeFile(directory + '/report.md', lines.join('\n') + '\n');
}
