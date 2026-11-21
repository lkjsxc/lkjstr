import type { NoteRow } from '../engine/protocol.ts';
import { noteTime } from '../shared/format.ts';
import type { Child } from '../shared/h.ts';
import { getLang, t } from '../shared/i18n.ts';
import { threadTime } from './note-thread.ts';
import type { ViewEnv } from './registry.ts';

export const timeOf = (row: NoteRow, env: ViewEnv, dated: boolean): Child => {
  if (row.pending) return t(row.connecting ? 'note.connecting' : 'note.sending');
  if (row.unconfirmed) return t('note.unconfirmed');
  const relative = env.settings.get().relativeTime;
  if (row.thread && !relative) return threadTime(row.at);
  // Absolute dates compare with the divider's local day; relative ages use the current time.
  const now = dated && !relative ? (row.repostedBy?.at ?? row.at) : Date.now();
  return noteTime(row.at, now, { relative, lang: getLang() });
};
export const deliveryMark = (row: NoteRow): string | undefined => {
  if (row.pending) return row.connecting ? 'connecting' : 'sending';
  if (row.unconfirmed) return 'unconfirmed';
};
