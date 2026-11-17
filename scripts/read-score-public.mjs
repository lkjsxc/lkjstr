// Explicit opt-in, public-only baseline. All browser targets use the race's read-only guard.
import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadavg } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { openBrowser, seedIdentity, readerState } from './race-profile.mjs';
import { startStatic } from './race-server.mjs';
import { publicIdentity, defaultNpub } from './race-report.mjs';
import { publicAccount, delay } from './real-hour-public.mjs';
import { buildIdentity } from './real-hour-browser.mjs';
import { ownedDirectory } from './real-hour-owned.mjs';
import { startEdgeRoute } from './race-route.mjs';
import { createReadScore, hash } from './read-score-model.mjs';
import { auditLosses } from './read-score-losses.mjs';
import { verify, controls, prepareViews, captureStore } from './read-score-public-support.mjs';
const root=resolve(new URL('../',import.meta.url).pathname);
process.chdir(root);
const option=(name,fallback)=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const seconds=Number(option('seconds','300'));
if(!Number.isInteger(seconds)||seconds<15||seconds>3600)throw Error('seconds must be 15..3600');
const helper=resolve(option('verify-helper',process.env.LKJSTR_REAL_VERIFY??'target/debug/examples/engine-public-verify'));
process.env.LKJSTR_REAL_VERIFY=helper;
const output=await ownedDirectory(root,option('output','tmp/read-score-'+Date.now()),true);
const build=resolve(option('build','dist'));
await cp(build,output+'/dist',{recursive:true});
const identity=await buildIdentity(output+'/dist');
const requested=publicIdentity(option('account',defaultNpub));
const relays=option('relays','wss://yabu.me/,wss://nos.lol/,wss://relay.damus.io/').split(',');
const scope=option('candidate-scope')?JSON.parse(await readFile(resolve(option('candidate-scope')),'utf8')):null;
const replay=option('replay')?JSON.parse(await readFile(resolve(option('replay'))+'/workload.json','utf8')):null;
const account=replay?.account??await publicAccount(relays,requested.pubkey);
if(account.follows.length<100)throw Error('Q5 requires a busy read-only account');
const profiles=replay?.profiles??[account.follows[0],account.follows[Math.floor(account.follows.length/2)],account.follows.at(-1)];
const witness=replay?.witness??await controls(account,profiles,relays,Math.floor(Date.now()/1000)-1);
const context=[account.followEvent];
const witnessEvents=witness.probes.flatMap(p=>p.events);
const initialProof=verify(helper,witnessEvents,account,profiles,context);
const wantedWitness=replay?.wantedWitness??[...new Set(Object.values(initialProof.eligibility).flatMap(p=>p.ordered?.slice(0,50)??[]))].sort();
const candidateAllowlist=replay?.candidateAllowlist??scope?.urls??null;
const workload={account,profiles,relays,seconds,witness,wantedWitness,candidateAllowlist,
  scope:'Home and Notifications plus three followed profiles, 50 verified witness rows per view, fixed 24h control span; product ordinary live queries unchanged'};
if(replay&&(hash(replay.profiles)!==hash(profiles)||hash(replay.relays)!==hash(relays)||replay.seconds!==seconds))
  throw Error('Replay duration or relay/profile set differs');
await writeFile(output+'/workload.json',JSON.stringify(workload,null,2));
await mkdir(output+'/harness');
for(const file of (await readdir('scripts')).filter(f=>/^(read-score|race-|real-hour-public|real-hour-budget|real-hour-browser|real-hour-owned).*\.mjs$/.test(f)))
  await cp('scripts/'+file,output+'/harness/'+file);
const report={schema:'lkjstr-read-score-1',mode:'public-read-only-multiview',started:new Date().toISOString(),
  sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  engineRevision:option('engine-revision','unasserted'),build:identity,
  candidateScopeFrozen:!!candidateAllowlist?.length,candidateScopeHash:candidateAllowlist?hash(candidateAllowlist):null,
  helperSha256:createHash('sha256').update(await readFile(helper)).digest('hex'),
  initialLoad:loadavg(),requestedSeconds:seconds,workloadHash:hash({...workload,witness:undefined,wantedWitness:undefined}),
  witnessHash:hash(wantedWitness),witnessCount:wantedWitness.length,limits:workload.scope};
let server,browser,unlisten,edgeRoute,stopped=false;
for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.on(signal,()=>{stopped=true});
const score=createReadScore();
try{
  server=await startStatic(output+'/dist');
  if(option('host-route')==='archserver')edgeRoute=await startEdgeRoute(output);
  report.hostRoute=edgeRoute?.evidence??null;
  report.serving={kind:'loopback exact release bytes; production headers; no public WAN/TLS leg',...server.policy};
  await seedIdentity({profile:output+'/profile',site:'lkjstr',base:server.base,account:publicIdentity(account.pubkey),hostResolverRules:edgeRoute?.resolverRules,relayAllowlist:candidateAllowlist});
  browser=await openBrowser(output+'/profile',{site:'lkjstr',base:server.base,hostResolverRules:edgeRoute?.resolverRules,relayAllowlist:candidateAllowlist});
  await prepareViews(browser,account,profiles,relays,server.base);
  unlisten=browser.cdp.listenNetwork(event=>score.receive(event));
  score.start();browser.cdp.start();
  report.navigationStarted=new Date().toISOString();
  await browser.page.goto(server.base,{waitUntil:'commit',timeout:45000});
  const start=Date.now();report.samples=[];
  await browser.page.waitForFunction(profiles=>profiles.every(pubkey=>globalThis.__openRaceGuard?.openedQueries?.some(
    row=>row.query?.source==='profile'&&row.query.pubkey===pubkey)),profiles,{timeout:30000});
  while(Date.now()-start<seconds*1000&&!stopped){
    await delay(Math.min(1000,seconds*1000-(Date.now()-start)));
    if(report.samples.length===0||Date.now()-Date.parse(report.samples.at(-1).at)>=30000){
      report.samples.push({at:new Date().toISOString(),load:loadavg()});
    }
  }
  score.stop();browser.cdp.stop();unlisten();unlisten=null;
  report.elapsedSeconds=(Date.now()-start)/1000;
  report.dom=await browser.page.evaluate(()=>({open:globalThis.__openRace,views:globalThis.__readScoreViews,seen:globalThis.__readScoreSeen,
    mounted:[...document.querySelectorAll('.view')].map(v=>({kind:v.dataset.kind,visible:v.getClientRects().length>0,notes:v.querySelectorAll('.note').length,phase:v.querySelector('.fstate')?.textContent}))}));
  report.account=await readerState(browser.page,'lkjstr',publicIdentity(account.pubkey));
  report.network=await browser.cdp.sample();
  report.openedQueries=report.network.guards.flatMap(g=>g.guard?.openedQueries??[]);
  report.requestedWindows=report.network.guards.flatMap(g=>g.guard?.windows??[]);
  const received=score.bodies(), proof=verify(helper,received,account,profiles,[...context,...witnessEvents]);
  const wanted=[...new Set(Object.values(proof.eligibility).flatMap(p=>p.eligible))];
  const witnessProof=verify(helper,witnessEvents,account,profiles,[...context,...received]);
  const stillEligible=new Set(Object.values(witnessProof.eligibility).flatMap(p=>p.eligible));
  const finalWitness=replay?wantedWitness:wantedWitness.filter(id=>stillEligible.has(id));
  report.witnessPolicyExcluded=wantedWitness.filter(id=>!stillEligible.has(id));
  workload.wantedWitness=finalWitness;
  await writeFile(output+'/workload.json',JSON.stringify(workload,null,2));
  report.witnessHash=hash(finalWitness);report.witnessCount=finalWitness.length;
  const stored=new Set(await captureStore(browser.page));
  const verified=proof.controlVerified.filter(id=>stored.has(id));
  const states=Object.values(report.dom.views??{});
  const visibleComplete=states.length===5?Math.max(...states.map(v=>v.at)):null;
  Object.assign(report,score.finish({verified,wanted,witness:finalWitness,
    firstScreenMs:report.dom.open?.marks?.firstScreenMs??null,visibleCompleteMs:visibleComplete}));
  report.firstTextMs=report.dom.open?.marks?.firstNoteMs??null;
  report.firstScreenSettledMs=report.dom.open?.marks?.firstScreenSettledMs??null;
  report.actualCandidateRelays=report.network.relayUrls??[];
  report.lossAudit=auditLosses({witness:finalWitness,events:witnessEvents,received,requests:report.requests,
    stored:[...stored],verified:proof.controlVerified,obtained:report.receivedVerifiedIds});
  if(report.lossAudit.quotaLimited){report.complete=false;report.unknown.push('witnesses-outside-request-quota')}
  report.nativeProof={rejected:proof.rejected,eligible:proof.eligibility};
  report.deniedCandidateConnections=report.network.guards.reduce((n,g)=>n+(g.guard?.deniedConnections??0),0);
  report.deniedCandidateUrls=[...new Set(report.network.guards.flatMap(g=>g.guard?.deniedUrls??[]))];
  if(report.deniedCandidateConnections){report.complete=false;report.unknown.push('candidate-scope-denied')}
  report.validReadOnly=report.account.readOnly&&report.network.forbiddenSentFrames===0
    &&report.network.guards.every(g=>g.guard&&g.guard.forbidden===0);
  if(!report.validReadOnly||stopped)throw Error(stopped?'Interrupted; partial evidence':'Read-only authority/guard incomplete');
  if(report.network.errors.length){report.complete=false;report.unknown.push('target-network-capture-error')}
  report.productStoredWitnesses=finalWitness.filter(id=>stored.has(id)).length;
  await writeFile(output+'/received-public.json',JSON.stringify(received));
  await writeFile(output+'/signature-proof.json',JSON.stringify(proof));
  await writeFile(output+'/loss-audit.json',JSON.stringify(report.lossAudit,null,2));
  await browser.page.screenshot({path:output+'/views.jpg',type:'jpeg',quality:80});
}catch(error){report.failure=String(error?.stack??error).slice(0,3000);report.complete=false;process.exitCode=1;
  if(browser)report.failureGuards=await browser.cdp.sample().catch(()=>null);
}
finally{
  score.stop();unlisten?.();await browser?.close();await server?.close();await edgeRoute?.close();
  await rm(output+'/profile',{recursive:true,force:true});
  report.finished=new Date().toISOString();report.finalLoad=loadavg();
  await writeFile(output+'/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({output,complete:report.complete,metrics:report.metrics,recall:report.recall,firstScreenMs:report.firstScreenMs,failure:report.failure}));
}
