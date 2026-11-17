import { cp, rm } from 'node:fs/promises';
import { seedIdentity } from './race-profile.mjs';
import { measureOpen, useHome } from './race-run.mjs';
import { copyProfile } from './race-report.mjs';
import { delay } from './real-hour-public.mjs';
export async function scheduleRace({ directory, report, sites, account, requestedRuns, durationMs, situations,
  warmSeconds, useSeconds, schemaVersion, save, prior, hostResolverRules, stopRequested = () => false }) {
  const checkStop = () => { if (stopRequested()) throw Error('Race interrupted after the current observation'); };
  const queue = [], foundations = report.foundations = {}, pendingProfiles = new Set();
  const waitUntil = async epoch => {
    while (Date.now() < epoch) {
      checkStop();
      console.log(JSON.stringify({ phase: 'waiting-owned-profile', seconds: Math.ceil((epoch - Date.now()) / 1000) }));
      await delay(Math.min(30000, epoch - Date.now()));
    }
  };
  const keep = async (site, profile, seeded, closed) => {
    const destination = directory + '/foundation-' + site;
    await rm(destination, { recursive: true, force: true }); await copyProfile(profile, destination);
    foundations[site] = { profile: destination, seeded, lastClosed: closed, sourceBuild: report.build };
    await save();
  };
  const run = async (site, scenario, index, profile, seeded, closed, mobile = false) => {
    checkStop();
    const provenance = { seeded, lastClosed: closed, profileAgeHours: (Date.now() - Date.parse(seeded)) / 3600000,
      idleSeconds: closed ? (Date.now() - Date.parse(closed)) / 1000 : 0,
      identityOnlyCold: scenario === 'cold' || scenario === 'phone-cold' };
    console.log(JSON.stringify({ phase: 'opening', site, scenario, index, idleSeconds: provenance.idleSeconds }));
    const result = await measureOpen({ profile, site, base: sites[site], account, mobile, durationMs, provenance, hostResolverRules,
      screenshot: directory + '/' + scenario + '-' + site + '-' + index + '.png' });
    result.scenario = scenario; result.index = index; report.runs.push(result); await save();
    console.log(JSON.stringify({ phase: 'measured', site, scenario, index, marks: result.dom?.marks, failure: result.failure }));
    return result;
  };
  const drain = async lookahead => {
    checkStop();
    queue.sort((a, b) => a.due - b.due);
    while (queue.length && queue[0].due <= Date.now() + lookahead) {
      checkStop(); const item = queue.shift(); await waitUntil(item.due);
      const result = await run(item.site, 'five-minute', item.index, item.profile, item.seeded, item.closed);
      await keep(item.site, item.profile, item.seeded, result.finished);
      await rm(item.profile, { recursive: true, force: true }); pendingProfiles.delete(item.profile);
      queue.sort((a, b) => a.due - b.due);
    }
  };
  try {
    checkStop();
    if (prior) for (const site of Object.keys(sites)) {
      const source = prior.foundations[site];
      if (!source) throw Error('Prior race lacks ' + site + ' profile');
      await keep(site, source.profile, source.seeded, source.lastClosed);
    }
    if (situations.has('cold') || (situations.has('five-minute') && !prior)) {
      for (let index = 1; index <= requestedRuns; index++) {
        for (const site of index % 2 ? ['nostter', 'lkjstr'] : ['lkjstr', 'nostter']) {
          await drain(durationMs + 5000);
          const profile = directory + '/profile-' + site + '-' + index; pendingProfiles.add(profile);
          const identity = await seedIdentity({ profile, site, base: sites[site], account, schemaVersion, hostResolverRules });
          const result = await run(site, situations.has('cold') ? 'cold' : 'warm-preparation', index, profile, identity.seeded, null);
          if (situations.has('five-minute')) queue.push({ site, index, profile, seeded: identity.seeded,
            closed: result.finished, due: Date.parse(result.finished) + warmSeconds * 1000 });
          else { await keep(site, profile, identity.seeded, result.finished);
            await rm(profile, { recursive: true, force: true }); pendingProfiles.delete(profile); }
        }
      }
      await drain(Infinity);
    } else if (situations.has('five-minute')) {
      for (let index = 1; index <= requestedRuns; index++) for (const site of index % 2 ? ['nostter', 'lkjstr'] : ['lkjstr', 'nostter']) {
        const base = foundations[site], profile = directory + '/profile-' + site + '-' + index;
        await copyProfile(base.profile, profile); pendingProfiles.add(profile);
        const prep = await run(site, 'warm-preparation', index, profile, base.seeded, base.lastClosed);
        queue.push({ site, index, profile, seeded: base.seeded, closed: prep.finished,
          due: Date.parse(prep.finished) + warmSeconds * 1000 });
        await drain(0);
      }
      await drain(Infinity);
    }
    if (situations.has('day-use')) {
      checkStop();
      report.workloads = [];
      for (const site of ['nostter', 'lkjstr']) {
        if (!foundations[site]) {
          const profile = directory + '/foundation-' + site;
          const identity = await seedIdentity({ profile, site, base: sites[site], account, schemaVersion, hostResolverRules });
          foundations[site] = { profile, seeded: identity.seeded, lastClosed: null };
        }
        const workload = await useHome({ profile: foundations[site].profile, site, base: sites[site], account,
          seconds: useSeconds, hostResolverRules, stopRequested, progressFile: directory + '/workload-' + site + '.json' });
        report.workloads.push(workload); foundations[site].lastClosed = workload.finished; await save();
      }
      for (let index = 1; index <= requestedRuns; index++) for (const site of index % 2 ? ['nostter', 'lkjstr'] : ['lkjstr', 'nostter']) {
        const foundation = foundations[site], profile = directory + '/day-' + site + '-' + index;
        await copyProfile(foundation.profile, profile); pendingProfiles.add(profile);
        await run(site, 'day-use-workload', index, profile, foundation.seeded, foundation.lastClosed);
        await rm(profile, { recursive: true, force: true }); pendingProfiles.delete(profile);
      }
    }
    if (situations.has('phone')) for (const site of ['nostter', 'lkjstr']) {
      checkStop();
      const profile = directory + '/phone-' + site; pendingProfiles.add(profile);
      const identity = await seedIdentity({ profile, site, base: sites[site], account, schemaVersion, hostResolverRules });
      await run(site, 'phone-cold', 1, profile, identity.seeded, null, true);
      await rm(profile, { recursive: true, force: true }); pendingProfiles.delete(profile);
    }
  } finally { for (const profile of pendingProfiles) await rm(profile, { recursive: true, force: true }); }
}
