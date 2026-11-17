// Derived audit of an immutable capture; writes a new file and never changes the raw report.
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { hash, eventHash } from './read-score-model.mjs';
import { createHash } from 'node:crypto';
const [directory]=process.argv.slice(2);
if(!directory)throw Error('Provide a captured read-score directory');
const root=resolve(directory), raw=await readFile(root+'/report.json','utf8');
const report=JSON.parse(raw),workload=JSON.parse(await readFile(root+'/workload.json','utf8'));
const urls=workload.candidateAllowlist;
report.candidateScopeFrozen=Array.isArray(urls)&&urls.length>0&&report.deniedCandidateConnections!==undefined;
report.candidateScopeHash=report.candidateScopeFrozen?hash(urls):null;
const actual=report.actualCandidateRelays??report.network?.relayUrls??[];
report.candidateScopeOutside=report.candidateScopeFrozen?actual.filter(url=>!urls.includes(url)):actual;
if(report.candidateScopeOutside.length){report.complete=false;(report.unknown??=[]).push('socket-outside-recorded-scope')}
report.rawReportSha256=createHash('sha256').update(raw).digest('hex');
if(!report.eventIdentitySemantics && report.complete){
  const bodies=JSON.parse(await readFile(root+'/received-public.json','utf8'));
  const distinct=new Set(bodies.map(eventHash)).size;
  report.metrics.serializedBodyDuplicateWireEvents=report.metrics.duplicateWireEvents;
  report.metrics.duplicateWireEvents=report.metrics.wireEvents-distinct;
  report.metrics.duplicatesPerWantedNew=report.metrics.wantedNew?report.metrics.duplicateWireEvents/report.metrics.wantedNew:null;
  report.eventIdentitySemantics='native event fields, object key order ignored; reconstructed from complete retained raw body variants';
  report.derivedDuplicateCorrection={rawBodies:bodies.length,nativeBodies:distinct,serializationVariants:bodies.length-distinct};
}
report.assessment='Derived from frozen workload, copied harness/call arguments, guard denials and observed target URLs; raw report is unchanged';
await writeFile(root+'/scorecard.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({scorecard:root+'/scorecard.json',frozen:report.candidateScopeFrozen,outside:report.candidateScopeOutside}));
