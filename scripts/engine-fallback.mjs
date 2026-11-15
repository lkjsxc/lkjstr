// Real Web Locks + BroadcastChannel ownership and recovery, in two browser pages.
export async function fallback({context,origin,fake,check}) {
  const first=await context.newPage(),second=await context.newPage();
  async function open(page) {
    await page.goto(origin);
    await page.evaluate(async(relay)=>{
      const {workerTransport}=await import('/transport/transport.js');
      window.fallbackMessages=[];
      window.transport=workerTransport({dedicated:true});
      window.transport.listen(m=>window.fallbackMessages.push(m));
      window.transport.post({t:'relays',relays:[{url:relay,read:true,write:true,search:true}]});
      window.transport.post({t:'open',sub:'fallback',query:{source:'global'}});
      window.transport.post({t:'window',sub:'fallback',anchor:'top',before:0,after:10});
      window.transport.post({t:'hint',hint:{visibleSubs:['fallback'],pageHidden:false,idle:false,saveData:false}});
    },origin.replace('http:','ws:'));
    await page.waitForFunction(()=>window.fallbackMessages.some(m=>m.t==='ready'));
    await page.waitForFunction(()=>window.fallbackMessages.some(m=>m.t==='rows'&&m.sub==='fallback'));
  }
  await open(first);await open(second);
  for(let i=0;i<100&&fake.connections()!==1;i++)await second.waitForTimeout(25);
  check('dedicated fallback elects one Web Locks leader',fake.connections()===1);
  await first.close();
  await second.waitForFunction(()=>window.fallbackMessages.some(m=>m.t==='reconnect'));
  await second.waitForFunction(()=>window.fallbackMessages.filter(m=>m.t==='ready').length>=2);
  for(let i=0;i<100&&fake.connections()!==1;i++)await second.waitForTimeout(25);
  check('leader loss reopens follower queries without duplicate sockets',fake.connections()===1);
  await second.evaluate(()=>window.transport.close());
  await second.close();
  for(let i=0;i<100&&fake.connections();i++)await new Promise(ok=>setTimeout(ok,25));
  check('fallback disposal releases relay work',fake.connections()===0);
}
