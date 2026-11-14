// Public URLs use NIP-19. Unaddressed views are restored through local layout.
export function publicCode(prefix, hex) {
  const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  let value = 0, bits = 0;
  const words = [];
  for (const byte of Buffer.from(hex, 'hex')) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { bits -= 5; words.push((value >>> bits) & 31); }
  }
  if (bits) words.push((value << (5 - bits)) & 31);
  let checksum = 1;
  const step = word => {
    const top = checksum >>> 25;
    checksum = ((checksum & 0x1ffffff) << 5) ^ word;
    [0x3b6a57b2,0x26508e6d,0x1ea119fa,0x3d4233dd,0x2a1462b3].forEach((g,i)=> { if ((top >>> i) & 1) checksum ^= g; });
  };
  [...prefix].forEach(c=>step(c.charCodeAt(0)>>>5)); step(0);
  [...prefix].forEach(c=>step(c.charCodeAt(0)&31)); words.forEach(step);
  for (let i=0;i<6;i++) step(0);
  checksum ^= 1;
  return prefix+'1'+[...words,...Array.from({length:6},(_,i)=>(checksum >>> (5*(5-i)))&31)].map(i=>alphabet[i]).join('');
}

export function viewPath(view) {
  if (view.kind==='thread') return '/n/'+publicCode('note',view.id);
  if (view.kind==='profile') return '/p/'+publicCode('npub',view.pubkey);
  if (view.kind==='search') return '/search?q='+encodeURIComponent(view.query ?? '');
  return '/'+view.kind;
}

export async function navigateView(page, url, view) {
  if (!['image','link','launcher'].includes(view.kind)) {
    await page.goto(new URL(viewPath(view),url).href);
    return;
  }
  await page.waitForTimeout(650);
  await page.evaluate(async view => {
    const db=await new Promise((ok,fail)=>{const r=indexedDB.open('lkjstr-wasm');r.onsuccess=()=>ok(r.result);r.onerror=fail;});
    const get=key=>new Promise((ok,fail)=>{const r=db.transaction('kv').objectStore('kv').get(key);r.onsuccess=()=>ok(r.result);r.onerror=fail;});
    const spaces=JSON.parse(await get('spaces'));
    const ws=spaces.desks[spaces.active];
    const find=node=>node.type==='pane' ? node : (node.children ?? []).map(find).find(Boolean);
    // The serialized enum is externally tagged by `type` in this layout.
    const panes=[];
    const walk=node=>{if(node.tabs)panes.push(node); for(const child of node.children ?? [])walk(child);};
    walk(ws.root);
    const pane=panes.find(p=>p.id===ws.focus) ?? find(ws.root);
    ws.tabs[pane.active]=view;
    await new Promise((ok,fail)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(JSON.stringify(spaces),'spaces');tx.objectStore('kv').put(JSON.stringify(ws),'workspace');tx.oncomplete=ok;tx.onerror=fail;});
    db.close();
    window.addEventListener("pagehide",e=>e.stopImmediatePropagation(),{capture:true,once:true});
  },view);
  await page.goto(url);
}
