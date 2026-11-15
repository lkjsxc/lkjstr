// Manual, read-only public review. Deliberately absent from every test/gate.
// Only REQ/CLOSE are sent. Public signed events and profile data stay in tmp/.
import bundle from 'playwright-core/lib/utilsBundle';
import { mkdir, writeFile } from 'node:fs/promises';
const relay = process.argv[2] ?? 'wss://relay.damus.io';
const notes=[], profiles=[], completed=new Set();
const ws=new bundle.ws(relay);
ws.on('error',()=>{});
const query = (id,filter,collect,limit,timeout) => new Promise((resolve,reject)=>{
  const timer=setTimeout(done,timeout);
  function done(){clearTimeout(timer);ws.off('message',message);if(ws.readyState===1)ws.send(JSON.stringify(['CLOSE',id]));resolve();}
  function message(raw){
    const m=JSON.parse(String(raw));
    if(m[1]!==id)return;
    if(m[0]==='EVENT'&&collect.length<limit&&!collect.some(e=>e.id===m[2].id))collect.push(m[2]);
    if(m[0]==='EOSE'){completed.add(id);done();}
    if(m[0]==='CLOSED'){done();}
  }
  ws.on('message',message);ws.send(JSON.stringify(['REQ',id,filter]));
});
try {
  await new Promise((ok,bad)=>{ws.once('open',ok);ws.once('error',bad);setTimeout(()=>bad(new Error('public relay connection timeout')),15000).unref();});
  await query('sample',{kinds:[1],limit:200},notes,200,15000);
  const authors=[...new Set(notes.map(n=>n.pubkey))];
  for(let i=0;i<authors.length;i+=100)await query(`profiles${i}`,{kinds:[0],authors:authors.slice(i,i+100),limit:100},profiles,1000,15000);
  await mkdir('tmp/public-sample',{recursive:true});
  const sample={relay,notes,profiles,completed:[...completed],sampledAt:new Date().toISOString()};
  await writeFile('tmp/public-sample/events.json',JSON.stringify(sample));
  console.log(JSON.stringify({notes:notes.length,profiles:profiles.length,completed:[...completed]}));
} finally {ws.close();}
