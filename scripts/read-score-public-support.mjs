import { spawnSync } from 'node:child_process';
import { queryRelay } from './real-hour-public.mjs';
import { controlBudget } from './real-hour-budget.mjs';
import { publicIdentity } from './race-report.mjs';
export function verify(helper, events, account, profiles, context = []) {
  const queries = {home:{query:{source:'home',account:account.pubkey}},
    notifications:{query:{source:'notifications',account:account.pubkey}}};
  profiles.forEach((pubkey,i)=>{queries['profile'+i]={query:{source:'profile',account:account.pubkey,pubkey}};});
  const result = spawnSync(helper,{input:JSON.stringify({events,context,queries,ordered:true}),
    encoding:'utf8',maxBuffer:32*1024*1024,timeout:60000});
  if (result.status!==0) throw Error('Native signature/eligibility verification failed: '+String(result.stderr).slice(0,500));
  return JSON.parse(result.stdout);
}
export async function controls(account, profiles, relays, until) {
  const since=until-24*3600, filters=[];
  const authors=[...new Set([account.pubkey,...account.follows])];
  for(let n=0;n<authors.length;n+=128) filters.push({kinds:[1,6],authors:authors.slice(n,n+128),since,until,limit:200});
  filters.push({kinds:[1,6,7,9735],'#p':[account.pubkey],since,until,limit:200});
  for(const pubkey of profiles) filters.push({kinds:[1,6],authors:[pubkey],since,until,limit:100});
  const budget=controlBudget({milliseconds:60000,events:5000,frames:20000,bytes:16*1024*1024});
  const probes=[];
  for(let n=0;n<filters.length;n+=4) {
    probes.push(...await Promise.all(relays.map(relay=>queryRelay(relay,filters.slice(n,n+4),12000,{budget}))));
  }
  return {since,until,probes,budget:budget.snapshot(),
    universeKnown:false,reason:'Finite capped relay witnesses; EOSE does not prove all public history'};
}
export async function prepareViews(browser, account, profiles, relays, base) {
  await browser.context.addInitScript(({account,profiles,relays,base})=>{
    if(location.origin!==new URL(base).origin)return;
    const put=(key,value)=>localStorage.setItem('lkjstr:'+key,JSON.stringify(value));
    const pane=(id,tab)=>({type:'pane',id,tabs:[tab],active:tab});
    put('layout:main',{type:'split',id:'score-root',dir:'col',sizes:[.5,.5],
      children:[pane('score-home','home'),{type:'split',id:'score-rest',dir:'row',sizes:[.25,.25,.25,.25],
        children:[pane('score-notifications','notifications'),...profiles.map((_,i)=>pane('score-profile'+i,'profile~score'+i))]}]});
    profiles.forEach((profile,i)=>put('view:main1:profile~score'+i,{ref:profile.npub,pubkey:profile.pubkey}));
    const entries=relays.map(url=>({url,read:true,write:false,search:false}));
    put('relays:',entries);put('relays:'+account.pubkey,entries);
    const marks=globalThis.__readScoreViews={};
    const seen=new Set(); let last=0;
    function sample(at){
      if(at-last<75){requestAnimationFrame(sample);return}last=at;
      for(const el of document.querySelectorAll('.pane .view')){
        const kind=el.dataset.kind;
        const rows=[...el.querySelectorAll('.note[data-note]')];
        const id=kind==='profile'?[...document.querySelectorAll('.view[data-kind=profile]')].indexOf(el):kind;
        const key=kind+':'+id;
        const visible=el.getClientRects().length>0;
        const box=el.getBoundingClientRect();
        const screen=rows.filter(n=>{const r=n.getBoundingClientRect();return r.bottom>box.top&&r.top<box.bottom});
        const hydrated=screen.length>0&&screen.every(n=>{const name=n.querySelector('.name')?.textContent??'';
          const img=n.querySelector('.av img');return name&&!/^(npub1|[a-f0-9]{64}$)/.test(name)&&img?.complete&&img.naturalWidth>0});
        if(hydrated&&visible&&!marks[key]) marks[key]={at,kind,count:screen.length,ids:screen.map(n=>n.dataset.note)};
        for(const row of rows){if(seen.size<20000)seen.add(row.dataset.note)}
      }
      globalThis.__readScoreSeen=[...seen];requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  },{account,profiles:profiles.map(p=>publicIdentity(p)),relays,base});
}
export async function captureStore(page) {
  return page.evaluate(()=>new Promise((done,reject)=>{
    const open=indexedDB.open('lkjstr-wasm');
    open.onerror=()=>reject(Error('Public event store inspection failed'));
    open.onsuccess=()=>{
      const db=open.result,tx=db.transaction('events'),req=tx.objectStore('events').getAllKeys();
      req.onsuccess=()=>{done(req.result);db.close()};
      req.onerror=()=>{db.close();reject(Error('Public event IDs unavailable'))};
    };
  }));
}
