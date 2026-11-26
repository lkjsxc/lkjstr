import { verifiedRecord } from './smoke-rail-history.mjs';

const DAY = 86400;
const RECENT = 2504;
const RANGE = 16;
const TAIL = 9;

export async function livedInArchive(sign, pubkey, peer) {
  const newest = Math.floor(Date.now() / 1000) - 120;
  const add = (kind, offset, content, tags = [], author = pubkey) =>
    sign({ pubkey: author, kind, created_at: newest - offset, content, tags });
  const channel = await add(40, 5 * DAY, '{"name":"Rail fixture channel"}');
  const notes = [];
  for (let index = 0; index < RECENT; index++) {
    const offset = index * 45;
    const body = `Rail history ${index} #rail-history`;
    const tags = [['t', 'rail-history']];
    if (index % 19 === 0) notes.push(await add(1984, offset, body));
    else if (index % 19 === 1) notes.push(await add(30023, offset, body, [['d', String(index)]]));
    else if (index % 19 === 2)
      notes.push(await add(42, offset, body, [['e', channel.id, '', 'root']]));
    else if (index % 19 === 3)
      notes.push(await add(1, offset, body, [...tags, ['p', pubkey]], peer));
    else notes.push(await add(1, offset, body, tags));
  }
  const range = [];
  for (let index = 0; index < RANGE; index++)
    range.push(await add(1, 3 * DAY + index * 45, `Evicted interval ${index}`));
  const tail = [];
  for (let index = 0; index < TAIL; index++)
    tail.push(await add(1, (120 + index * 62) * DAY, `Sparse archive ${index}`));
  const follows = await add(3, DAY, '', [['p', pubkey]], peer);
  const records = [...notes, channel, follows, ...range, ...tail].map(verifiedRecord);
  return {
    records,
    evicted: range.map((event) => event.id),
    sample: [notes[0].id, notes[1].id, channel.id, ...tail.map((event) => event.id)],
    channel: channel.id,
    expected: records.length - RANGE,
    shape: {
      kinds: [...new Set(records.map((record) => record.kind))].sort((a, b) => a - b),
      oldEvents: TAIL,
      oldRange: [tail.at(-1).created_at, tail[0].created_at],
      evictedRange: [range.at(-1).created_at, range[0].created_at],
      evictedEvents: RANGE,
    },
  };
}
