// Each process exits before the next browser starts; later stages reuse frozen hour assets/helpers.
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const args=process.argv.slice(2),stamp=Date.now();
const option=(name,fallback)=>args.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3)??fallback;
const run=(script,argv)=>new Promise((done,reject)=>{
  const child=spawn(process.execPath,[script,...argv],{stdio:'inherit',env:process.env});
  const handlers=['SIGINT','SIGTERM'].map(signal=>[signal,()=>child.kill(signal)]);
  for(const [signal,handler] of handlers)process.on(signal,handler);
  const cleanup=()=>{for(const [signal,handler] of handlers)process.removeListener(signal,handler)};
  child.once('error',error=>{cleanup();reject(error)});
  child.once('exit',(code,signal)=>{cleanup();code===0?done():reject(Error(script+' failed '+(signal??code)))});
});
const hourOutput=resolve(option('output','tmp/real-hour-'+stamp));
await run('scripts/real-hour.mjs',[...args.filter(v=>!v.startsWith('--race-')&&!v.startsWith('--score-')&&!v.startsWith('--output=')),
  '--output='+hourOutput]);
const build=hourOutput+'/dist',helper=hourOutput+'/bin/engine-public-verify';
const score=['--build='+build,'--verify-helper='+helper,
  '--output='+option('score-output','tmp/real-hour-read-score-'+stamp)];
for(const name of ['replay','candidate-scope','seconds'])if(option('score-'+name))score.push('--'+name+'='+option('score-'+name));
for(const name of ['account','engine-revision'])if(option(name))score.push('--'+name+'='+option(name));
if(option('race-host-route'))score.push('--host-route='+option('race-host-route'));
await run('scripts/read-score-public.mjs',score);
const race=['--build='+build,'--verify-helper='+helper,'--output='+option('race-output','tmp/real-hour-open-race-'+stamp)];
if(option('account'))race.push('--account='+option('account'));
if(option('race-host-route'))race.push('--host-route='+option('race-host-route'));
await run('scripts/race-open.mjs',race);
