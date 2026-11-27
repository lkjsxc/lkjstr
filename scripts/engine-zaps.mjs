import { assertOwnership } from '../web/tests/signer-ownership-fixture.ts';
// All zap HTTP is intercepted; no wallet or public-relay publication occurs.
import { zapSignerFailures } from './engine-zap-signers.mjs';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {resolve} from 'node:path';
export async function zaps({page,send,check,note,signer,lines,origin,bunker,fake,act,kinds,signerDeadline=false}) {
  const child=spawn(resolve(process.env.CARGO_TARGET_DIR??'target','debug/examples/zap-fixtures'),[],{stdio:['pipe','pipe','pipe']});
  const output=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  let diagnostics='',local,previous,release,held=false,callbackMode='normal',chain=Promise.resolve(),closed=false;
  child.stderr.on('data',b=>{diagnostics=(diagnostics+b).slice(-4000);});
  const childError=new Promise((_,reject)=>child.once('error',reject));
  childError.catch(()=>{});
  const routeErrors=[];
  const next=async()=>{let timer;try {const n=await Promise.race([output.next(),childError,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('zap fixture timeout')),5000);})]);if(n.done)throw new Error('zap fixture stopped: '+diagnostics);return JSON.parse(n.value);}finally{clearTimeout(timer);}};
  const rpc=value=>{const result=chain.then(()=>{child.stdin.write(JSON.stringify(value)+'\n');return next();});chain=result.catch(()=>{});return result;};
  const all=()=>page.evaluate(()=>window.messages);
  async function until(test,ms=25_000) {
    const deadline=Date.now()+ms;
    while(Date.now()<deadline){const m=await all();if(test(m))return m;await page.waitForTimeout(25);}
    throw new Error('zap conformance deadline');
  }
  const result=req=>until(m=>m.some(x=>x.t==='result'&&x.req===req)).then(m=>m.find(x=>x.t==='result'&&x.req===req));
  let serial=0;
  const requests=[],receipts=[];
  const routePattern='https://zap.fixture.invalid/**';
  let seed;
  const handler=async route=>{
    const url=new URL(route.request().url()),headers=route.request().headers();
    requests.push({path:url.pathname,anonymous:!headers.cookie&&!headers.authorization&&!headers.referer});
    try {
      let body;
      if(url.pathname.startsWith('/.well-known/lnurlp/')) {
        body={tag:'payRequest',allowsNostr:true,nostrPubkey:seed.provider,
          callback:'https://zap.fixture.invalid/callback?fixture=1',minSendable:1000,maxSendable:1_000_000_000,
          commentAllowed:128,metadata:JSON.stringify([['text/plain','Zap fixture'],['text/identifier','receiver@zap.fixture.invalid']])};
      } else if(url.pathname==='/callback') {
        const committed=url.searchParams.get('nostr');
        if(!committed)throw new Error('missing signed zap request');
        const request=JSON.parse(committed);
        check('zap callback carries a signed HTTP-only kind9734 request',request.kind===9734&&request.tags.some(t=>t[0]==='P'&&t[1]===seed.provider));
        body=await rpc({op:'invoice',request:callbackMode==='bad-hash'?' '+committed:committed});
        receipts.push(body.fixtureReceipt);
        delete body.fixtureReceipt;
        if(callbackMode==='hold'){held=true;await new Promise(resolve=>{release=resolve;});}
      } else return route.abort();
      if(!closed) await route.fulfill({status:200,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
    } catch(error) {
      if(!closed) await route.abort().catch(()=>{});
      if(!closed && !(callbackMode==='hold' && route.request().failure()?.errorText)) routeErrors.push(error);
    }
  };
  const answer=async request=>{
    check('zap extension request uses the selected fixture account',request.pubkey===note.pubkey&&JSON.parse(request.event).kind===9734);
    signer.stdin.write(request.event+'\n');
    const signed=JSON.parse((await lines.next()).value);
    await send({t:'signed',req:request.req,event:JSON.stringify(signed)});
  };
  async function invoice(account,mode='normal') {
    callbackMode=mode;
    const req='zap-invoice-'+(++serial),start=(await all()).length;
    kinds.add('zap.invoice');
    await send({t:'act',req,action:{a:'zap.invoice',as:account,intent:{target:{k:'event',id:seed.note.id},amountMsat:21_000,comment:'fixture zap'}}});
    const handled=new Set(),deadline=Date.now()+95_000;
    await until(m=>{
      // This predicate is synchronous; signer work is awaited below.
      return m.slice(start).some(x=>(x.t==='result'&&x.req===req)||(x.t==='sign'&&x.actionReq===req));
    });
    while(Date.now()<deadline) {
      const m=await all(),done=m.slice(start).find(x=>x.t==='result'&&x.req===req);
      if(done)return done;
      for(const request of m.slice(start).filter(x=>x.t==='sign'&&x.actionReq===req&&!handled.has(x.req))){
        assertOwnership('zap',request,{req:request.req,actionReq:req,runtime:true});
        check('native zap ownership fixture matches Worker',true);
        handled.add(request.req);await answer(request);
      }
      await page.waitForTimeout(25);
      if(handled.size>32)throw new Error('unbounded zap signatures');
    }
    throw new Error('zap invoice conformance deadline');
  }
  try {
    seed=await next();
    previous=(await all()).filter(m=>m.t==='accounts').at(-1)?.active;
    await page.context().route(routePattern,handler);
    fake.add(seed.metadata);fake.add(seed.note);
    check('zap recipient read-only fixture account opens',(await act({a:'account.add',how:'key',key:seed.npub})).ok);
    await send({t:'relays',relays:[{url:origin.replace('http:','ws:'),read:true,write:true,search:true}]});
    const query={target:{k:'event',id:seed.note.id},amountMsat:21_000};
    await send({t:'zap.quote',req:'zap-quote',query});
    const quoted=await until(m=>m.some(x=>x.t==='zap.quote'&&x.req==='zap-quote'&&x.quote.phase!=='loading'));
    const quote=quoted.filter(x=>x.t==='zap.quote'&&x.req==='zap-quote').at(-1).quote;
    check('zap quote discovers the verified recipient LNURL provider',quote.phase==='ready'&&quote.recipients[0]?.provider===seed.provider);
    const before=fake.published.length;
    const extension=await invoice(note.pubkey);
    check('zap extension invoice is validated and explicitly unpaid',extension.ok&&extension.zapIntent?.state==='unpaid'&&extension.zapIntent.invoices[0].amountMsat===21_000);
    const receipt=receipts.at(-1);
    const duplicate=await rpc({op:'duplicate',receipt});
    const forged=await rpc({op:'duplicate',receipt,provider:5});
    for(const event of [receipt,duplicate,forged])fake.add(event);
    await send({t:'zap.receipts',req:'zap-people',query:{target:query.target,limit:20}});
    const list=await until(m=>m.some(x=>x.t==='zap.receipts'&&x.req==='zap-people'&&x.page.page?.rows.length===1));
    const view=list.filter(x=>x.t==='zap.receipts'&&x.req==='zap-people').at(-1).page;
    check('trusted zapper list excludes duplicate invoices and untrusted providers',
      view.page.rows.length===1&&view.page.total.sats===21&&view.page.rows[0].sender.pubkey===note.pubkey&&view.page.total.unverified===1);
    await send({t:'open',sub:'zap-note',query:{source:'thread',account:seed.recipient,id:seed.note.id}});
    await send({t:'window',sub:'zap-note',anchor:'top',before:0,after:20});
    await send({t:'reading',sub:'zap-note',key:seed.note.id});
    await send({t:'hint',hint:{visibleSubs:['zap-note'],pageHidden:false,idle:false,saveData:false}});
    const count=await until(m=>m.filter(x=>x.sub==='zap-note').flatMap(x=>x.rows??x.ops?.flatMap(o=>o.row?[o.row]:o.rows??[])??[])
      .some(r=>r.id===seed.note.id&&r.counts?.zaps===21&&r.counts.zapUnverified===1));
    check('visible zap counts use the trusted lower bound without inflating 9735 amounts',Boolean(count));
    await send({t:'open',sub:'zap-notifications',query:{source:'notifications',account:seed.recipient}});
    await send({t:'window',sub:'zap-notifications',anchor:'top',before:0,after:20});
    const notified=await until(m=>m.filter(x=>x.sub==='zap-notifications').flatMap(x=>x.rows??x.ops?.flatMap(o=>o.row?[o.row]:o.rows??[])??[])
      .some(r=>r.type==='zap'&&r.key===receipt.id&&r.actors[0]?.pubkey===note.pubkey&&r.zapReceipt?.verification==='provider-authorized'));
    check('zap notification actor is the verified request signer',Boolean(notified));
    check('incorrect invoice description commitment is refused',!(await invoice(note.pubkey,'bad-hash')).ok);
    check('zap local fixture account creates',(await act({a:'account.add',how:'create'})).ok);
    local=(await all()).filter(m=>m.t==='accounts').at(-1).active;
    check('zap local signer obtains a validated unpaid invoice',(await invoice(local)).ok);
    check('zap bunker fixture connects',(await act({a:'account.add',how:'key',key:'bunker://'+bunker.pubkey+'?relay='+encodeURIComponent(origin.replace('http:','ws:')+'/bunker')})).ok);
    check('zap remote signer obtains a validated unpaid invoice',(await invoice(bunker.pubkey)).ok);
    await zapSignerFailures({page,send,check,until,result,answer,invoice,account:note.pubkey,
      readonly:seed.recipient,bunker,query,callbacks:()=>requests.filter(r=>r.path==='/callback').length,
      deadline:signerDeadline});
    const cancelled='zap-cancelled',start=(await all()).length;
    await send({t:'act',req:cancelled,action:{a:'zap.invoice',as:note.pubkey,intent:{...query,comment:'cancel before HTTP'}}});
    await send({t:'act',req:cancelled,action:{a:'zap.invoice',as:note.pubkey,intent:{...query,comment:'cancel before HTTP'}}});
    await send({t:'zap.quote',req:cancelled,query});
    const sign=await until(m=>m.slice(start).some(x=>x.t==='sign'&&x.actionReq===cancelled));
    const oldSign=sign.slice(start).find(x=>x.t==='sign'&&x.actionReq===cancelled),callbacks=requests.filter(r=>r.path==='/callback').length;
    await page.waitForTimeout(100);
    const duplicates=(await all()).slice(start);
    check('duplicate pending zap owner has one signer and no premature terminal failure',
      duplicates.filter(x=>x.t==='sign'&&x.actionReq===cancelled).length===1&&
      !duplicates.some(x=>(x.t==='result'||x.t==='zap.quote')&&x.req===cancelled));
    await send({t:'zap.close',req:cancelled});
    check('zap close acknowledges cancellation',(await result(cancelled)).cancelled===true);
    await answer(oldSign);await page.waitForTimeout(200);
    check('late extension reply cannot call the invoice endpoint',requests.filter(r=>r.path==='/callback').length===callbacks);
    const backup=await act({a:'account.exportEncrypted',pubkey:local,password:'zap fixture password',logN:16});
    check('zap lock fixture stores an encrypted test key',(await act({a:'account.importEncrypted',key:backup.encryptedKey,password:'zap fixture password'})).ok);
    callbackMode='hold';
    const locked='zap-locked';
    await send({t:'act',req:locked,action:{a:'zap.invoice',as:local,intent:{...query,comment:'locked during callback'}}});
    await until(()=>held);
    check('zap local key lock commits',(await act({a:'account.lock',pubkey:local})).ok);
    release?.();release=undefined;
    const revoked=await result(locked);
    check('lock revokes an already requested invoice without disclosing it',!revoked.ok&&!revoked.zapIntent);
    check('zap path never publishes requests or pays invoices',fake.published.slice(before).every(e=>e.kind!==9734&&e.kind!==9735));
    check('provider and callback fetches omit credentials and referrers',requests.length>2&&requests.every(r=>r.anonymous));
    check('zap HTTP fixtures complete without hidden handler failures',routeErrors.length===0);
  } finally {
    release?.();closed=true;
    try {
      await page.context().unroute(routePattern,handler);
      const cleanup=[];
      for(const sub of ['zap-note','zap-notifications'])cleanup.push(send({t:'close',sub}));
      for(const req of ['zap-quote','zap-people'])cleanup.push(send({t:'zap.close',req}));
      await Promise.allSettled(cleanup);
      for(const key of [local,seed?.recipient,bunker.pubkey].filter(Boolean))
        await act({a:'account.remove',pubkey:key}).catch(()=>{});
      if(previous)await act({a:'account.use',pubkey:previous}).catch(()=>{});
    } finally {
      child.stdin.end();
      if(child.pid && child.exitCode===null && child.signalCode===null) {
        const exited=once(child,'exit');
        child.kill('SIGTERM');
        const force=setTimeout(()=>child.kill('SIGKILL'),1000);
        try {await exited;} finally {clearTimeout(force);}
      }
    }
  }
}
