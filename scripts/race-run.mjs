import { writeFile } from 'node:fs/promises';
import { loadavg } from 'node:os';
import { openBrowser, readerState } from './race-profile.mjs';
import { delay } from './real-hour-public.mjs';
export async function measureOpen({ profile, site, base, account, mobile = false, durationMs = 45000, screenshot, provenance, hostResolverRules }) {
  const browser = await openBrowser(profile, { site, mobile, hostResolverRules, base });
  const result = { site, mobile, started: new Date().toISOString(), initialLoadAverage: loadavg(), provenance: { ...provenance },
    observationMs: durationMs, browserVersion: browser.browserVersion, userAgent: browser.userAgent, routePermission: browser.routePermission, errors: [] };
  try {
    browser.page.on('pageerror', error => { if (result.errors.length < 20) result.errors.push(String(error).slice(0, 300)); });
    browser.cdp.start();
    await browser.page.goto(base + (site === 'nostter' ? '/home' : '/'), { waitUntil: 'commit', timeout: 45000 });
    const finish = Date.now() + durationMs;
    while (Date.now() < finish) await delay(Math.min(1000, finish - Date.now()));
    browser.cdp.stop(); // Freeze transfer accounting at the end of the same observation window.
    result.dom = await browser.page.evaluate(() => {
      const state = globalThis.__openRace;
      if (state) state.stop = true;
      return state ?? null;
    });
    if (result.dom) {
      result.navigationStarted = new Date(result.dom.timeOrigin).toISOString();
      result.provenance.launchIdleSeconds = provenance.idleSeconds;
      result.provenance.profileAgeHours = (result.dom.timeOrigin - Date.parse(provenance.seeded)) / 3600000;
      result.provenance.idleSeconds = provenance.lastClosed ? (result.dom.timeOrigin - Date.parse(provenance.lastClosed)) / 1000 : 0;
    }
    result.profile = await readerState(browser.page, site, account);
    result.network = await browser.cdp.sample();
    if (screenshot) await browser.page.screenshot({ path: screenshot, fullPage: false });
    const relayEpoch = Math.min(...result.network.guards.map(item => item.guard?.firstEventEpoch).filter(Number.isFinite),
      result.network.firstRelayEventEpoch ?? Infinity);
    if (Number.isFinite(relayEpoch) && result.dom) result.firstRelayEventMs = relayEpoch - result.dom.timeOrigin;
    result.engineReadyMs = result.network.guards.find(item => item.type === 'page')?.guard?.engineReadyMs ?? null;
    const replyEpoch = Math.min(...result.network.guards.map(item => item.guard?.firstReplyEpoch).filter(Number.isFinite),
      result.network.firstRelayReplyEpoch ?? Infinity);
    if (Number.isFinite(replyEpoch) && result.dom) result.firstRelayReplyMs = replyEpoch - result.dom.timeOrigin;
    result.beforeRelay = result.dom?.marks?.firstScreenMs !== undefined && Number.isFinite(result.firstRelayReplyMs)
      ? result.dom.marks.firstScreenMs < result.firstRelayReplyMs : null;
    result.validReadOnly = result.profile.readOnly && result.network.forbiddenSentFrames === 0 &&
      result.network.guards.every(item => item.guard && item.guard.forbidden === 0);
    if (mobile && result.network.errors.length) throw Error('Mobile target throttling or network capture failed; inspect errors');
    if (!result.validReadOnly) throw Error('Read-only guard/account witness is incomplete or rejected a write');
    if (site === 'nostter' && new URL(result.profile.url).pathname !== '/home') throw Error('Nostter did not stay on Home');
    if (!result.dom?.marks.firstNoteMs) result.incomplete = 'No Home text note appeared within the observation window';
  } catch (error) { result.failure = String(error?.stack ?? error).slice(0, 2000); }
  finally {
    result.observationFinished = new Date().toISOString();
    await browser.close();
    result.finished = new Date().toISOString(); result.finalLoadAverage = loadavg();
  }
  return result;
}
export async function useHome({ profile, site, base, account, seconds, progressFile, hostResolverRules, stopRequested = () => false }) {
  const browser = await openBrowser(profile, { site, observe: false, hostResolverRules, base });
  const evidence = { site, started: new Date().toISOString(), requestedSeconds: seconds, steps: 0, profiles: 0, threads: 0, load: [] };
  try {
    browser.cdp.start();
    await browser.page.goto(base + (site === 'nostter' ? '/home' : '/'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    const started = Date.now(); let nextStep = 0, nextSample = 0;
    while (Date.now() - started < seconds * 1000) {
      if (stopRequested()) throw Error('Race interrupted during Home workload');
      if (Date.now() >= nextStep) {
        evidence.steps++;
        await browser.page.evaluate(site => {
          const view = site === 'lkjstr' ? document.querySelector('.view[data-kind="home"]') : document.scrollingElement;
          if (!view) return;
          if (view.scrollTop + view.clientHeight >= view.scrollHeight - 30) view.scrollTop = 0;
          else view.scrollTop += Math.max(400, view.clientHeight * 0.7);
          view.dispatchEvent(new Event('scroll'));
        }, site);
        nextStep = Date.now() + 15000;
      }
      if (Date.now() >= nextSample) {
        evidence.load.push({ seconds: (Date.now() - started) / 1000, load: loadavg() });
        if (progressFile) await writeFile(progressFile, JSON.stringify(evidence, null, 2));
        nextSample = Date.now() + 60000;
      }
      await delay(Math.min(1000, Math.max(1, seconds * 1000 - (Date.now() - started))));
    }
    await browser.page.evaluate(site => {
      const view = site === 'lkjstr' ? document.querySelector('.view[data-kind="home"]') : document.scrollingElement;
      if (view) { view.scrollTop = 0; view.dispatchEvent(new Event('scroll')); }
    }, site);
    await delay(5000); evidence.profile = await readerState(browser.page, site, account);
    evidence.elapsedSeconds = (Date.now() - started) / 1000;
    browser.cdp.stop(); evidence.guard = await browser.cdp.sample();
    if (!evidence.profile.readOnly || evidence.guard.guards.some(item => !item.guard || item.guard.forbidden))
      throw Error('Home workload did not retain public read-only authority');
  } finally { await browser.close(); evidence.finished = new Date().toISOString(); }
  return evidence;
}
