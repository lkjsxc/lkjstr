import { expect, it } from 'vitest';
import { projectHidden } from '../src/engine/mock/hidden.ts';
import { noteRow } from '../src/engine/mock/rows.ts';
import { createWorld, idOf } from '../src/engine/mock/world.ts';
import type { NoteRow } from '../src/engine/protocol.ts';
import native from './fixtures/native-note-rows.json';

type Case = 'standard' | 'generic' | 'list' | 'covered';
type JsonShape<T> = T extends string
  ? string
  : T extends object
    ? { [K in keyof T]: JsonShape<T[K]> }
    : T;
type JsonNoteRow = JsonShape<NoteRow>;
const golden: Record<Case, JsonNoteRow> = native;

function mocks(): Record<Case, NoteRow> {
  const world = createWorld(Date.UTC(2026, 0, 1));
  world.linkPreviews = false;
  const row = (id: string) => {
    const note = world.byId.get(id);
    if (!note) throw new Error(`missing mock fixture ${id}`);
    const frame = projectHidden({
      t: 'rows',
      sub: 'golden',
      rows: [noteRow(world, note, { me: '' })],
      atTop: true,
      atBottom: true,
    });
    if (frame.t !== 'rows' || frame.rows[0]?.kind !== 'note') throw new Error('note row');
    // Undefined optional fields are not JSON wire keys.
    return JSON.parse(JSON.stringify(frame.rows[0])) as NoteRow;
  };
  const covered = world.notes.find((note) => note.hidden === 'machine-payload');
  if (!covered) throw new Error('missing covered mock fixture');
  return {
    standard: row(idOf(9600)),
    generic: row(idOf(9700)),
    list: row(idOf(9703)),
    covered: row(covered.id),
  };
}

// The mock has synthetic IDs, profile metadata and copy links. Check their types
// and presence separately; compare everything else, including nested fields,
// discriminants and absent keys, exactly rather than projecting a key allowlist.
function comparable(row: JsonNoteRow) {
  const { id, key, at, bech32, author, copyLink, shareEvent, ...body } = row;
  const { pubkey, npub, name, verified, picture, nip05, ...authorBody } = author;
  for (const value of [id, key, bech32, pubkey, npub, name]) expect(typeof value).toBe('string');
  expect(typeof at).toBe('number');
  expect(typeof verified).toBe('boolean');
  expect(id).toBe(key);
  for (const value of [picture, nip05, copyLink, shareEvent])
    if (value !== undefined) expect(typeof value).toBe('string');
  if (row.hidden) {
    expect(bech32).toBe('');
    expect(name).toBe(pubkey);
    expect(verified).toBe(false);
    expect(copyLink).toBeUndefined();
    expect(shareEvent).toBeUndefined();
    expect(picture).toBeUndefined();
    expect(nip05).toBeUndefined();
  }
  return { ...body, author: authorBody };
}

function compare(kind: Case, actual: NoteRow, native: JsonNoteRow) {
  if (kind !== 'covered') {
    expect(native.copyLink).toEqual(expect.any(String));
    expect(native.shareEvent).toEqual(expect.any(String));
  }
  // The mock only provides a synthetic copyLink for its generic review fixture.
  // Its unsigned fixture IDs do not support native shareEvent hints.
  if (kind === 'generic') expect(actual.copyLink).toEqual(expect.any(String));
  else expect(actual.copyLink).toBeUndefined();
  expect(actual.shareEvent).toBeUndefined();

  const expected = comparable(native);
  if (kind === 'generic') {
    if (!expected.face) throw new Error('missing native generic face');
    // The mock supplies alt as a face property but omits the redundant raw alt tag.
    const [alt, ...tags] = expected.face.tags;
    expect(alt).toEqual({ name: 'alt', text: expected.face.alt });
    expected.face = { ...expected.face, tags };
  }
  expect(comparable(actual)).toStrictEqual(expected);
}

it('matches the native NoteRow golden for the existing mock projections', () => {
  const rows = mocks();
  expect(Object.keys(golden).sort()).toEqual(Object.keys(rows).sort());
  for (const kind of Object.keys(rows) as Case[]) compare(kind, rows[kind], golden[kind]);
});

it('rejects a missing list face and a mutated covered-row field', () => {
  const rows = mocks();
  const { face: _face, ...missing } = rows.list;
  expect(() => compare('list', missing, golden.list)).toThrow();
  const covered = rows.covered;
  if (!covered.hidden) throw new Error('missing covered fixture');
  const changed = { ...covered, hidden: { ...covered.hidden, revealable: false } };
  expect(() => compare('covered', changed, golden.covered)).toThrow();
});
