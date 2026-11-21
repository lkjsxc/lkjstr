// Signed newest-first pages served over a dedicated loopback relay.
import { setTimeout as delay } from 'node:timers/promises';
import { fakeRelay } from './browser-relay.mjs';

const pivotSecond = 1690013300;
const pivot = pivotSecond * 1000 + 999;
const firstSecond = pivotSecond + 1;

export function newerTimeRelay() {
  const pages = [];
  let followed;
  const relay = fakeRelay({request(ws, sub, filters) {
    const filter = filters.find(f => f.authors?.includes(followed) && f.kinds?.[0] === 1 && f.since === firstSecond);
    if (!filter) return false;
    if (pages.length >= 16) throw Error('absolute relay fixture received too many pages');
    pages.push({ws, sub, filter});
    return true;
  }});
  return {relay, pages, follow: pubkey => { followed = pubkey; }};
}

function reply(page, events) {
  const {filter, ws, sub} = page;
  const selected = events.filter(e => e.created_at >= filter.since && e.created_at <= filter.until)
    .sort((a, b) => b.created_at - a.created_at || b.id.localeCompare(a.id)).slice(0, filter.limit);
  for (const event of selected) ws.send(JSON.stringify(['EVENT', sub, event]));
  ws.send(JSON.stringify(['EOSE', sub]));
  return selected;
}

async function waitPage(pages, index) {
  for (let i = 0; i < 250; i++) {
    if (pages[index]) return pages[index];
    await delay(20);
  }
  throw Error(`absolute relay page ${index + 1} missing`);
}

export async function newerTimeWindow({page,send,wait,check,signer,lines,timeRelay,origin}) {
  const request = async fields => {
    signer.stdin.write(`${JSON.stringify(fields)}\n`);
    return JSON.parse((await lines.next()).value);
  };
  const owner = await request({fixtureActor:true});
  const actor = await request({fixtureActor:true});
  const sign = (pubkey, kind, offset, content, tags = []) =>
    request({pubkey, kind, tags, content, created_at:pivotSecond + offset});
  const {relay, pages, follow} = timeRelay;
  const notes = [];
  for (const [offset, label] of [[1,'near-a'],[1,'near-b'],[10,'overlap'],[20,'far-b'],[30,'far-a']]) {
    notes.push(await sign(actor.pubkey, 1, offset, label));
  }
  const older = await sign(actor.pubkey, 1, 0, 'pivot');
  const tags = [['p',actor.pubkey]];
  const list = await sign(owner.pubkey, 3, 31, '', tags);
  relay.add(list);
  relay.add(older);
  follow(actor.pubkey);

  const sub = 'absolute-newer-window';
  const url = origin.replace('http:', 'ws:');
  const configure = (relayUrl, write) => send({t:'relays',relays:[{url:relayUrl,read:true,write,search:write}]});
  const seek = (at, before, after = 1) => send({t:'window',sub,anchor:{at},before,after});
  const report = () => page.evaluate(sub => window.messages.findLast(m=>m.t==='timeWindow'&&m.sub===sub), sub);
  const proof = (at, id, newer, older = 'end') => wait(({sub,at,id,newer,older}) => {
    const m = window.messages.findLast(m => m.t==='timeWindow' && m.sub===sub);
    return m?.at===at && m.followList?.id===id && m.newer===newer && m.older===older;
  },{sub,at,id,newer,older});
  try {
    await configure(url + '/absolute-time', false);
    await send({t:'open',sub,visible:false,query:{source:'their-home',pubkey:owner.pubkey}});
    await seek(pivot, 0);
    await send({t:'hint',hint:{visibleSubs:[sub],pageHidden:false,idle:false,saveData:false}});
    await proof(pivot, list.id, 'cache-only');
    const beforeSeek = Math.floor(Date.now()/1000);
    await seek(pivot - 1, 1, 0);
    const first = await waitPage(pages, 0);
    const afterSeek = Math.floor(Date.now()/1000);
    check('newer relay span pins a finite second and excludes the pivot second',
      first.filter.since===firstSecond && first.filter.until>=beforeSeek &&
      first.filter.until<=afterSeek && first.filter.limit===3);
    const head = reply(first, notes);
    const second = await waitPage(pages, 1);
    await seek(pivot - 1, 1, 0);
    await proof(pivot - 1, list.id, 'loading', 'cache-only');
    await wait(({sub,id}) => window.messages.findLast(m=>m.t==='rows'&&m.sub===sub)?.rows[0]?.key===id, {sub,id:notes[2].id});
    check('full newest-first relay page narrows while provisional rows stay visible without a seat',
      head.length===3 && !head.includes(notes[0]) && !head.includes(notes[1]) &&
      second.filter.until===notes[2].created_at && second.sub!==first.sub && !(await report()).key);
    reply(second, notes);
    const ties = notes.slice(0, 2).sort((a,b) => b.id.localeCompare(a.id));
    const third = await waitPage(pages, 2);
    check('inclusive newer cursor rechecks the nearest tie boundary', third.filter.until===firstSecond);
    reply(third, notes);
    await proof(pivot - 1, list.id, 'end', 'cache-only');
    check('settled newer coverage seats the nearest eligible row', (await report()).key===ties[1].id);
    await seek(pivot - 1, 5);
    await wait(({sub,ids}) => window.messages.findLast(m=>m.t==='rows'&&m.sub===sub)?.rows.map(r=>r.key).join()===ids.join(),
      {sub,ids:[notes[4],notes[3],notes[2],...ties,older].map(e=>e.id)});
    check('signed relay-only newer rows grow in reading-time order with no duplicate ties', pages.length===3);

    await seek(pivot, 1);
    const stale = await waitPage(pages, 3);
    await seek(pivot - 2, 1);
    const moved = await waitPage(pages, 4);
    reply(stale, []);
    await proof(pivot - 2, list.id, 'loading');
    const replacement = await sign(owner.pubkey, 3, 32, '', tags);
    relay.add(replacement);
    const current = await waitPage(pages, 5);
    reply(moved, []);
    await proof(pivot - 2, replacement.id, 'loading');
    check('late newer EOSE cannot settle a different exact pivot or a replacement signed follow list',
      stale.filter.since===moved.filter.since && moved.filter.since===current.filter.since &&
      stale.sub!==moved.sub && moved.sub!==current.sub);
    current.ws.send(JSON.stringify(['CLOSED',current.sub,'error: fixture refused newer']));
    await proof(pivot - 2, replacement.id, 'stalled');
    const observed = await report();
    const falseEnd = await page.evaluate(({sub,at}) => window.messages.some(m=>
      m.t==='timeWindow' && m.sub===sub && m.at===at && m.newer==='end'), {sub,at:pivot - 2});
    check('a refused newer route leaves the completed older edge settled without false completion',
      observed.newer==='stalled' && observed.older==='end' && !falseEnd);
    await seek(pivot - 2, 1, 0);
    await proof(pivot - 2, replacement.id, 'stalled', 'cache-only');
    check('a newer-only stalled window with retained rows still omits the seat', !(await report()).key);
  } finally {
    await send({t:'close',sub});
    await configure(url, true);
  }
}
