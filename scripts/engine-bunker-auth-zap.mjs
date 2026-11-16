// Split-zap remaining-budget proof. All HTTPS is fulfilled locally; no invoice is paid.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {resolve,join} from 'node:path';
export async function authorizationZapDeadline({c,fixture,fake,origin,account,check}) {
  const path=process.env.LKJSTR_ZAP_FIXTURE_BIN??join(resolve(process.env.CARGO_TARGET_DIR??'target'),'debug/examples/zap-fixtures');
  const child=spawn(path,[],{stdio:['pipe','pipe','pipe']});child.stderr.resume();
  const ended=new Promise(ok=>{child.once('close',ok);child.once('error',ok);});
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  async function next(){let timer;try{const value=await Promise.race([lines.next(),new Promise((_,bad)=>{timer=setTimeout(()=>bad(Error('owned zap fixture timeout')),5000);})]);if(value.done)throw Error('owned zap fixture ended');return JSON.parse(value.value);}finally{clearTimeout(timer);}}
  let chain=Promise.resolve(),seed,callbacks=0,closed=false;
  const failures=[];
  const call=input=>{const result=chain.then(async()=>{child.stdin.write(JSON.stringify(input)+'\n');return next();});chain=result.catch(()=>{});return result;};
  const pattern='https://zap.fixture.invalid/**';
  const handler=async route=>{
    try{
      const url=new URL(route.request().url());let body;
      if(url.pathname.startsWith('/.well-known/lnurlp/')) {
        body={tag:'payRequest',allowsNostr:true,nostrPubkey:seed.provider,
          callback:'https://zap.fixture.invalid/callback',minSendable:1000,maxSendable:1_000_000,
          commentAllowed:128,metadata:JSON.stringify([['text/plain','Owned split deadline fixture'],
            ['text/identifier',url.pathname.split('/').at(-1)+'@zap.fixture.invalid']])};
      }else if(url.pathname==='/callback'){
        callbacks++;
        const request=url.searchParams.get('nostr');if(!request)throw Error('missing owned signed request');
        body=await call({op:'invoice',request});delete body.fixtureReceipt;
      }else return route.abort();
      if(!closed)await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
    }catch{if(!closed){failures.push('owned zap HTTP fixture failed');await route.abort().catch(()=>{});}}
  };
  try{
    seed=await next();await c.page.context().route(pattern,handler);
    const first=await call({op:'event',author:2,kind:0,content:JSON.stringify({lud16:'one@zap.fixture.invalid'}),tags:[]});
    const second=await call({op:'event',author:3,kind:0,content:JSON.stringify({lud16:'two@zap.fixture.invalid'}),tags:[]});
    const note=await call({op:'event',author:2,kind:1,content:'owned split deadline target',tags:[['zap',first.pubkey,'','1'],['zap',second.pubkey,'','1']]});
    for(const event of [first,second,note])fake.add(event);
    const target={k:'event',id:note.id};
    await c.send(0,{t:'zap.quote',req:'auth-split-quote',query:{target,amountMsat:2000}});
    const quoted=await c.until(ms=>ms.some(m=>m.t==='zap.quote'&&m.req==='auth-split-quote'&&m.quote.phase!=='loading'));
    const quote=quoted.filter(m=>m.t==='zap.quote'&&m.req==='auth-split-quote').at(-1).quote;
    check('both split recipients pass provider preflight before signing',quote.phase==='ready'&&quote.recipients.length===2);
    if(quote.phase!=='ready'||quote.recipients.length!==2)throw Error('owned split preflight '+JSON.stringify({phase:quote.phase,error:quote.error,recipients:quote.recipients.map(r=>({phase:r.phase,error:r.error}))}));
    fixture.configure(origin,['sign_event']);
    const count=async()=> (await c.all(0)).filter(m=>m.t==='signer.auth').length;
    const before=await count(),published=fake.published.length;
    const req=await c.begin({a:'zap.invoice',as:account,intent:{target,amountMsat:2000,comment:'owned remaining deadline'}});
    const initial=await c.challenge(before),firstHeld=fixture.pending().at(-1);
    const shifted=await c.control('fixture.clock',{ms:55_000});
    check('the first signer stays inside its original sixty-second wait',shifted.now<initial.expiresAt);
    fixture.release(firstHeld);
    const later=await c.challenge(before+1),secondHeld=fixture.pending().at(-1);
    const current=(await c.control('fixture.clock',{ms:0})).now;
    check('later split authorization advertises only the original remaining budget',
      later.actionReq===req&&later.expiresAt<=initial.expiresAt+30_000&&later.expiresAt-current>0&&later.expiresAt-current<=35_000);
    await fixture.challenge(secondHeld,later.url);
    await c.page.waitForTimeout(60);
    check('a repeated split challenge cannot extend the same deadline',
      (await count())===before+2&&(await c.all(0)).filter(m=>m.t==='signer.auth').at(-1).expiresAt===later.expiresAt);
    await c.control('fixture.clock',{ms:36_000});
    await c.send(0,{t:'heartbeat'});
    const result=await c.result(req);
    await c.until(()=>!fixture.open(secondHeld));
    check('the original invoice deadline cancels pending authorization without partial invoices',
      !result.ok&&!result.zapIntent&&!fixture.release(secondHeld));
    check('the split operation made one unpaid callback and never published a zap request',
      callbacks===1&&fake.published.slice(published).every(e=>e.kind!==9734)&&!failures.length);
    await c.send(0,{t:'zap.close',req:'auth-split-quote'});
  }finally{
    closed=true;await c.page.context().unroute(pattern,handler);
    child.stdin.end();let timer;
    try{await Promise.race([ended,new Promise(ok=>{timer=setTimeout(()=>{child.kill('SIGKILL');ok();},2000);})]);}
    finally{clearTimeout(timer);await ended;}
  }
}
