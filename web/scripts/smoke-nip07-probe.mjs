import { chromium } from 'playwright-core';
import { fastNip07, nip07WaitChecks } from './smoke-nip07-wait.mjs';
import { createRealFixture } from './smoke-real-fixture.mjs';

const f = await createRealFixture();
const errors = [];
let browser;
try {
  const base = await new Promise((done, fail) => {
    f.server.stdout.once('data', (data) => done(String(data).trim()));
    f.server.once('exit', (code) => fail(new Error(`server exited ${code}`)));
  });
  browser = await chromium.launch({
    executablePath:
      process.env.LKJSTR_CHROME ??
      `${process.env.HOME}/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`,
    args: ['--no-sandbox', '--disable-background-networking', '--ignore-certificate-errors'],
  });
  const options = {
    browser,
    base,
    relayUrl: f.relayUrl,
    pubkey: f.fixture.note.pubkey,
    sign: f.fixtureSign,
    errors,
    fake: f.fake,
    bunker: f.bunker,
    check(name, ok) {
      console.log(ok ? 'ok' : 'FAIL', name);
      if (!ok) throw new Error(name);
    },
  };
  if (process.argv.includes('--baseline')) await fastNip07(options, true);
  else await nip07WaitChecks(options);
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser?.close();
  await f.close();
}
