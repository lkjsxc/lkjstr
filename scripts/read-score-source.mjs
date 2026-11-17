// Actual source bytes, including uncommitted product modules, exclude test/harness code.
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
export const digest = data => createHash('sha256').update(data).digest('hex');
export async function productSources() {
  const paths=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard',
    'crates','Cargo.toml','Cargo.lock','.cargo/config.toml'],{encoding:'utf8'}).split('\0')
    .filter(path=>path && (path.includes('/src/') || /(?:Cargo\.(?:toml|lock)|build\.rs|\.cargo\/config\.toml)$/.test(path)));
  const files=[];
  for(const path of [...new Set(paths)].sort())files.push({path,sha256:digest(await readFile(path))});
  return {productSourceHash:digest(JSON.stringify(files)),productSources:files};
}
