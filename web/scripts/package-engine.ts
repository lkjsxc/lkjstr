// Inspect only bytes from the exact validated tar. Never reopen mutable dist files.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertProductionEngine } from '../../scripts/engine-production.ts';

type Member = { name: string; offset: number; size: number };
type Checked = { members: Member[]; parents: Record<string, string[]> };

export function assertPackageEngine(raw: Uint8Array): void {
  const checked = JSON.parse(
    execFileSync(
      'python3',
      ['-I', fileURLToPath(new URL('./package-check.py', import.meta.url)), '--members'],
      {
        input: raw,
        encoding: 'utf8',
        maxBuffer: 4 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'inherit'],
      },
    ),
  ) as Checked;
  if (!Array.isArray(checked.members) || checked.members.length > 4096) {
    throw new Error('invalid validated archive member count');
  }
  const members = new Map<string, Member>();
  for (const member of checked.members) {
    if (
      typeof member.name !== 'string' ||
      members.has(member.name) ||
      !Number.isSafeInteger(member.offset) ||
      !Number.isSafeInteger(member.size) ||
      member.offset < 0 ||
      member.size <= 0 ||
      member.offset + member.size > raw.byteLength
    )
      throw new Error('invalid validated archive member range');
    members.set(member.name, member);
  }
  // The generated app has one engine. Do not guess a trusted file from its basename,
  // ignore an extra orphan binary, or accept two possible loader/WASM pairings.
  const binaries = checked.members.filter((member) => member.name.toLowerCase().endsWith('.wasm'));
  const wasm = binaries[0];
  if (binaries.length !== 1 || !wasm)
    throw new Error('production package requires exactly one engine WASM');
  const parents = checked.parents[wasm.name]?.filter((name) => name.endsWith('.js')) ?? [];
  const binding = parents.length === 1 ? members.get(parents[0] ?? '') : undefined;
  if (!binding) throw new Error('production package requires one reachable engine binding pair');
  const bytes = (member: Member) => raw.subarray(member.offset, member.offset + member.size);
  assertProductionEngine(
    bytes(wasm),
    new TextDecoder('utf-8', { fatal: true }).decode(bytes(binding)),
  );
}
