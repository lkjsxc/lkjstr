// Protocol 3 semantics through the real Worker. Fixtures stay on loopback.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
export async function rich({page,send,wait,check,note,signer,lines,fake}) {
  check('ready retains protocol 3 features',await page.evaluate(()=>window.messages.some(m=>m.t==='ready'&&m.version>=3)));
  await page.evaluate(()=>{
    window.richRows={};window.richFresh={};window.richState={};
    const previous=window.worker.onmessage;
    window.worker.onmessage=e=>{
      previous(e);const m=e.data;
      if(!m.sub?.startsWith('rich-'))return;
      if(m.t==='state')window.richState[m.sub]=m.state;
      if(m.t==='fresh')window.richFresh[m.sub]=m.count;
      if(m.t==='rows')window.richRows[m.sub]=m.rows.slice();
      if(m.t==='patch')for(const o of m.ops){
        const rows=window.richRows[m.sub]??=[];
        if(o.op==='remove'){const at=rows.findIndex(r=>r.key===o.key);if(at>=0)rows.splice(at,1);}
        if(o.op==='update'){const at=rows.findIndex(r=>r.key===o.row.key);if(at>=0)rows[at]=o.row;}
        if(o.op==='insert'){let at=o.before===null?rows.length:rows.findIndex(r=>r.key===o.before);rows.splice(at<0?rows.length:at,0,...o.rows);}
      }
    };
  });
  const sign=async(kind,created_at,content='',tags=[])=>{
    signer.stdin.write(`${JSON.stringify({pubkey:note.pubkey,kind,created_at,content,tags})}\n`);
    return JSON.parse((await lines.next()).value);
  };
  const other=spawn('cargo',['run','-q','-p','lkjstr-core','--example','engine-fixtures'],{stdio:['pipe','pipe','pipe']});
  other.stderr.resume();
  const secondary=createInterface({input:other.stdout})[Symbol.asyncIterator]();
  const owner=JSON.parse((await secondary.next()).value).note;
  let serial=0;
  const open=async(query,expected)=>{
    const sub=`rich-${serial++}`;
    await send({t:'open',sub,query});
    await send({t:'hint',hint:{visibleSubs:[sub],pageHidden:false,idle:false,saveData:false}});
    try { await wait(({sub,expected})=>window.richRows[sub]?.length===expected&&(expected>0||['live','done'].includes(window.richState[sub]?.phase)),{sub,expected}); }
    catch { throw new Error(`${sub} ${query.source}/${query.show??''} expected ${expected}: ${await page.evaluate(sub=>JSON.stringify({rows:window.richRows[sub]?.length,state:window.richState[sub]}),sub)}`); }
    return {sub,rows:await page.evaluate(sub=>window.richRows[sub],sub)};
  };
  const close=async sub=>send({t:'close',sub});
  try {
    const good=await sign(1,1700200010,'rich-flow 猫 blue 静かな 朝 https://example.test/rich.png https://example.test/page');
    const spam=await sign(1,1700200020,`${good.content} SPAM`);
    const reply=await sign(1,1700200030,'rich-flow reply',['e'].map(()=>['e',good.id,'','reply']));
    const repost=await sign(16,1700200040,'',[['e',good.id]]);
    const reaction=await sign(7,1700200050,'rich-flow +',[['e',good.id],['p',owner.pubkey]]);
    for(const e of [good,spam,reply,repost,reaction])fake.add(e);
    const q={source:'search',text:'blue 猫',phrases:['静かな 朝'],exclude:['spam'],from:['Contract fixture'],has:['image','link'],since:1700200000000,until:1700200060000};
    const match=await open(q,1);
    check('protocol 3 combines words, exact phrases, exclusions, from and has',match.rows[0].id===good.id);await close(match.sub);
    await page.route('https://rich.engine.test/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({names:{aoi:note.pubkey}})}));
    const named=await open({...q,from:['aoi@rich.engine.test']},1);
    check('protocol 3 NIP-05 from resolves HTTP evidence and replans',named.rows[0].id===good.id);await close(named.sub);
    for(const [name,query] of [
      ['unknown from matches nothing',{...q,from:['nobody-known']}],
      ['missing video matches nothing',{...q,has:['video']}],
      ['inclusive millisecond since excludes preceding second',{...q,since:1700200010001}],
      ['until before cache is empty without failure',{...q,until:1600000000000}],
      ['phrase-only search remains a search',{source:'search',phrases:['静かな 朝'],exclude:['spam'],since:1700200000000}],
      ['has-only search remains a search',{source:'search',has:['image'],exclude:['spam'],since:1700200000000}],
    ]){
      const result=await open(query,name.includes('remains')?1:0);
      check(`protocol 3 ${name}`,true);await close(result.sub);
    }
    for(const [show,ids] of [['posts',[spam.id,good.id]],['replies',[reply.id]],['reposts',[good.id]],['reactions',[good.id]],['media',[spam.id,good.id]]]){
      const result=await open({source:'profile',pubkey:note.pubkey,show,since:1700200000000,until:1700200060000},ids.length+1);
      check(`protocol 3 profile ${show}`,result.rows[0].kind==='profile'&&JSON.stringify(result.rows.slice(1).map(r=>r.id))===JSON.stringify(ids));
      if(show==='reposts')check('profile kind 16 uses actor and repost time',result.rows[1].repostedBy.actors[0].pubkey===note.pubkey&&result.rows[1].repostedBy.at===repost.created_at*1000);
      await close(result.sub);
    }
    const empty=await open({source:'profile',pubkey:owner.pubkey,show:'media'},1);
    await wait(sub=>window.messages.some(m=>m.t==='rows'&&m.sub===sub&&m.atBottom),empty.sub);
    check('empty profile kind has a header and truthful atBottom',true);await close(empty.sub);
    // This account follows the fixture author, so Home and Global can be compared.
    other.stdin.write(`${JSON.stringify({pubkey:owner.pubkey,kind:3,created_at:1700200000,content:'',tags:[['p',note.pubkey]]})}\n`);
    fake.add(JSON.parse((await secondary.next()).value));
    const news=await open({source:'notifications',account:owner.pubkey,text:'rich-flow',since:1700200000000},1);
    for(const source of ['global','home']){
      const mixed=await open({source,account:owner.pubkey,notifications:true,text:'rich-flow',since:1700200000000},source==='home'?5:4);
      check(`${source} inserts identical notifications in time order`,mixed.rows.some(r=>r.key===news.rows[0].key&&r.at===reaction.created_at*1000));
      // Hold below the top; a new notification must increment fresh without insertion.
      await send({t:'window',sub:mixed.sub,anchor:{key:good.id},before:0,after:20});
      await wait(({sub,id})=>window.richRows[sub]?.[0]?.id===id,{sub:mixed.sub,id:good.id});
      const newer=await sign(7,1700200070+serial,'rich-flow new',[['p',owner.pubkey],['e',good.id]]);fake.add(newer);
      const arrival=`rich-arrival-${serial}`;
      await send({t:'open',sub:arrival,query:{source:'notifications',account:owner.pubkey,text:'rich-flow new'}});
      await wait(({sub,at})=>window.richRows[sub]?.some(r=>r.at===at),{sub:arrival,at:newer.created_at*1000});
      await close(arrival);
      await wait(sub=>window.richFresh[sub]===4,mixed.sub);
      check(`${source} fresh counts grouped notification rows`,true);
      check(`${source} holds the notification arrival below top`,await page.evaluate(sub=>window.richRows[sub].every(r=>r.kind!=='notification'),mixed.sub));
      await send({t:'window',sub:mixed.sub,anchor:'top',before:0,after:20});
      await wait(({sub,at})=>window.richRows[sub]?.[0]?.at===at,{sub:mixed.sub,at:newer.created_at*1000});
      check(`${source} reveals notification on returning to top`,true);
      await close(mixed.sub);
      const plain=await open({source,account:owner.pubkey,text:'rich-flow',since:1700200000000},3);
      check(`${source} reopening with notifications off removes them`,plain.rows.every(r=>r.kind==='note'));await close(plain.sub);
    }
    await close(news.sub);
  } finally { other.stdin.end(); }
}
