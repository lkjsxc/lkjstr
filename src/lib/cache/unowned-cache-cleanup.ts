import { ensureEventGraphSchema } from '../storage/sqlite-opfs/event-schema';
import { sendSqliteStorage } from '../storage/sqlite-opfs/kernel-client';

export async function deleteUnownedCacheRows(): Promise<number> {
  if (!(await ensureEventGraphSchema())) return 0;
  const [relayRows, tagRows] = await Promise.all([
    deleteRows(
      'DELETE FROM event_relays WHERE event_id NOT IN (SELECT id FROM events);',
    ),
    deleteRows(
      'DELETE FROM event_tags WHERE event_id NOT IN (SELECT id FROM events);',
    ),
  ]);
  return relayRows + tagRows;
}

async function deleteRows(statement: string): Promise<number> {
  const response = await sendSqliteStorage({ kind: 'execute', statement });
  return response.outcome === 'ok' ? response.rowsAffected : 0;
}
