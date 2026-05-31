import fs from 'node:fs/promises';
import path from 'node:path';
import { storageTableSpecs } from '../src/lib/storage/schema/table-manifest';

export type RepoProblem = { file: string; message: string };

type DocsRow = {
  readonly table: string;
  readonly dataClass: string;
  readonly group: string;
};

const docsFile = path.join(
  'docs',
  'architecture',
  'data',
  'storage',
  'data-classes',
  'table-manifest.md',
);

export async function checkStorageManifestDocs(
  root: string,
): Promise<RepoProblem[]> {
  const text = await fs.readFile(path.join(root, docsFile), 'utf8');
  const docsRows = tableRows(text);
  const problems: RepoProblem[] = [];
  const docsByTable = new Map(docsRows.map((row) => [row.table, row]));
  for (const spec of storageTableSpecs) {
    const row = docsByTable.get(spec.name);
    if (!row) {
      problems.push({ file: docsFile, message: `missing ${spec.name}` });
      continue;
    }
    if (row.dataClass !== spec.dataClass)
      problems.push({
        file: docsFile,
        message: `${spec.name} class ${row.dataClass} != ${spec.dataClass}`,
      });
    if (row.group !== spec.inventoryGroup)
      problems.push({
        file: docsFile,
        message: `${spec.name} group ${row.group} != ${spec.inventoryGroup}`,
      });
  }
  for (const row of docsRows) {
    if (!storageTableSpecs.some((spec) => spec.name === row.table))
      problems.push({ file: docsFile, message: `extra ${row.table}` });
  }
  return problems;
}

function tableRows(text: string): DocsRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('| `'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map((cells) => ({
      table: code(cells[1] ?? ''),
      dataClass: code(cells[2] ?? ''),
      group: code(cells[3] ?? ''),
    }))
    .filter((row) => row.table.length > 0);
}

function code(cell: string): string {
  const match = /^`([^`]+)`/.exec(cell);
  return match?.[1] ?? '';
}
