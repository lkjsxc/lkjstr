// One manual read-only comparison. Never part of an automated gate.
// Builds must already exist; fresh browser context / IndexedDB for each engine.
import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
const paths = ['tmp/outbox-baseline-engine', 'tmp/engine-pkg'];
const results = [];
for (const [index, engine] of paths.entries()) {
  if (index) await new Promise(resolve => setTimeout(resolve, 60000));
  const output = `tmp/outbox-public-${index === 0 ? 'before' : 'after'}.json`;
  const child = spawn(process.execPath, ['scripts/engine-orchestration-sample.mjs'], {
    stdio: ['ignore','inherit','inherit'],
    env: {...process.env,LKJSTR_SAMPLE_ENGINE:engine,LKJSTR_SAMPLE_CHANNELS:'1',LKJSTR_SAMPLE_NIP11:'1',LKJSTR_SAMPLE_OUTPUT:output},
  });
  const code = await new Promise(resolve => child.once('exit',resolve));
  results.push(JSON.parse(await readFile(output,'utf8')));
  if (code) process.exitCode = 1;
}
await writeFile('tmp/outbox-public.json',JSON.stringify({
  limitations:['Sequential public samples are not a controlled performance comparison.','One-minute quiet interval separates engines.','Only guarded REQ/CLOSE frames; no account or signer.'],
  before:results[0],after:results[1],
},null,2));
if (!results[1]?.channelSample?.channels.length) {
  console.error('Public channel proof is empty');
  process.exitCode = 1;
}
