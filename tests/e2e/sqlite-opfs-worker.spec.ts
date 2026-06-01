import { expect, test } from '@playwright/test';

type WorkerResponse = {
  readonly outcome: string;
  readonly rows: readonly Record<string, unknown>[];
  readonly rowsAffected: number;
  readonly diagnostics: Record<string, unknown>;
};

test('SQLite OPFS worker loads official assets and executes SQL', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const worker = new Worker('/sqlite-opfs-worker.js', { type: 'module' });
    let nextId = 0;
    const send = (op: unknown): Promise<WorkerResponse> =>
      new Promise((resolve, reject) => {
        const requestId = `sqlite-e2e-${(nextId += 1)}`;
        const timer = setTimeout(
          () => reject(new Error('worker timeout')),
          8_000,
        );
        const message = (
          event: MessageEvent<WorkerResponse & { requestId: string }>,
        ) => {
          if (event.data.requestId !== requestId) return;
          worker.removeEventListener('message', message);
          clearTimeout(timer);
          resolve(event.data);
        };
        worker.addEventListener('message', message);
        worker.addEventListener(
          'error',
          () => reject(new Error('worker error')),
          {
            once: true,
          },
        );
        worker.postMessage({ requestId, deadlineMs: 8_000, op });
      });

    try {
      const databaseName = `lkjstr-e2e-${crypto.randomUUID()}.sqlite3`;
      const open = await send({
        kind: 'open',
        database: {
          databaseName,
          preferredVfs: 'opfs',
          allowSahpool: false,
          allowTransient: false,
        },
      });
      const schema = await send({
        kind: 'apply-schema',
        schemaHash: 'sqlite-opfs-e2e',
        statements: [
          'CREATE TABLE IF NOT EXISTS smoke (id TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT',
        ],
      });
      const insert = await send({
        kind: 'execute',
        statement: 'INSERT INTO smoke (id, value) VALUES (?, ?)',
        params: ['one', 'stored'],
      });
      const query = await send({
        kind: 'query',
        statement: 'SELECT value FROM smoke WHERE id = ?',
        params: ['one'],
        rowLimit: 1,
      });
      const close = await send({ kind: 'close' });
      return {
        crossOriginIsolated,
        secure: isSecureContext,
        open,
        schema,
        insert,
        query,
        close,
      };
    } finally {
      worker.terminate();
    }
  });

  expect(result.secure).toBe(true);
  expect(result.crossOriginIsolated).toBe(true);
  expect(result.open.outcome).toBe('ok');
  expect(result.open.diagnostics.vfs).toBe('opfs');
  expect(result.schema.outcome).toBe('ok');
  expect(result.insert.rowsAffected).toBe(1);
  expect(result.query.rows).toEqual([{ value: 'stored' }]);
  expect(result.close.outcome).toBe('ok');
});
