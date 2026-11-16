// Real Worker NIP-49 checks. This is the public NIP-49 test vector, never an owner's key.
const VECTOR = 'ncryptsec1qgg9947rlpvqu76pj5ecreduf9jxhselq2nae2kghhvd5g7dgjtcxfqtd67p9m0w57lspw8gsq6yphnm8623nsl8xn9j4jdzz84zm3frztj3z7s35vpzmqf6ksu8r89qk5z2zxfmu5gv8th8wclt0h4p';
export async function vault({page,send,wait,check,act,kinds,origin}) {
  const latest = () => page.evaluate(() => window.messages.filter(m=>m.t==='accounts').at(-1));
  const previous = (await latest())?.active;
  const run = async action => {kinds?.add(action.a); return act(action);};
  check('encrypted import refuses wrong password',
    (await run({a:'account.importEncrypted',key:VECTOR,password:'wrong'})).error?.code==='rejected');
  check('encrypted import unlocks only after committed storage',
    (await run({a:'account.importEncrypted',key:VECTOR,password:'nostr'})).ok);
  const imported = await latest(), pubkey=imported.active;
  let account=imported.accounts.find(a=>a.author.pubkey===pubkey);
  check('encrypted account advertises protection and session state',account?.encrypted===true&&account.locked===false);
  const disk = await page.evaluate(async ({pubkey,vector}) => {
    const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
    try {
      const raw=await new Promise((resolve,reject)=>{const r=db.transaction('kv').objectStore('kv').get('engine-accounts');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
      const entry=JSON.parse(raw).entries.find(a=>a.pubkey===pubkey);
      return entry?.encrypted_key===vector&&!entry.secret&&!Object.hasOwn(entry,'unlocked_key');
    } finally {db.close();}
  },{pubkey,vector:VECTOR});
  check('encrypted import never writes its plaintext key to IndexedDB',disk);
  check('export refuses excessive KDF memory before derivation',
    (await run({a:'account.exportEncrypted',pubkey,password:'backup',logN:19})).error?.code==='too-large');
  const exported=await run({a:'account.exportEncrypted',pubkey,password:'backup',logN:16});
  check('explicit encrypted export returns only the additive encrypted field',
    exported.ok&&exported.encryptedKey?.startsWith('ncryptsec1')&&exported.encryptedKey.length===162&&!exported.key);
  check('encrypted account locks explicitly',(await run({a:'account.lock',pubkey})).ok);
  check('locked account refuses raw backup',(await act({a:'account.key',pubkey})).error?.code==='signer-missing');
  check('locked account refuses signing',(await act({a:'publish',as:pubkey,what:{k:'note',draft:{text:'must never publish while locked'}}})).error?.code==='signer-missing');
  check('wrong unlock password stays locked',(await run({a:'account.unlock',pubkey,password:'wrong'})).error?.code==='rejected');
  account=(await latest()).accounts.find(a=>a.author.pubkey===pubkey);
  check('failed unlock keeps the locked state',account.locked===true);
  check('correct password unlocks the current session',(await run({a:'account.unlock',pubkey,password:'nostr'})).ok);
  const ready=await page.evaluate(()=>window.messages.filter(m=>m.t==='ready').length);
  await page.evaluate(()=>{
    window.worker.terminate();
    window.worker=new Worker('/worker.js',{type:'module'});
    window.worker.onmessage=e=>window.messages.push(e.data);
    window.worker.onerror=e=>window.messages.push({type:'worker-error',message:e.message});
  });
  await wait(n=>window.messages.filter(m=>m.t==='ready').length>n,ready);
  await wait(key=>window.messages.filter(m=>m.t==='accounts').at(-1)?.accounts.some(a=>a.author.pubkey===key&&a.encrypted&&a.locked),pubkey);
  check('Worker restart never restores a decrypted session key',true);
  check('restarted vault can unlock',(await run({a:'account.unlock',pubkey,password:'nostr'})).ok);
  check('encrypted account removal commits',(await act({a:'account.remove',pubkey})).ok);
  if(previous)check('vault tests restore the prior fixture account',(await act({a:'account.use',pubkey:previous})).ok);
  await send({t:'relays',relays:[{url:origin.replace('http:','ws:'),read:true,write:true,search:true}]});
  return ['account.importEncrypted','account.unlock','account.lock','account.exportEncrypted'];
}
