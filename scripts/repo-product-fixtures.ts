import fs from 'node:fs/promises';
import path from 'node:path';

export type RepoProblem = { file: string; message: string };

const PRODUCT_EXTS = new Set(['.js', '.svelte', '.ts']);
const FORBIDDEN_IMPORT_MESSAGE =
  'product source must not import test fixtures or mock data';

export async function checkProductFixtureImports(
  root: string,
  files: readonly string[],
): Promise<RepoProblem[]> {
  const problems: RepoProblem[] = [];
  for (const file of files) {
    const rel = path.relative(root, file);
    if (!isProductSource(rel)) continue;
    const text = await fs.readFile(file, 'utf8');
    for (const specifier of importSpecifiers(text)) {
      if (!isForbiddenSpecifier(rel, specifier)) continue;
      problems.push({ file: rel, message: FORBIDDEN_IMPORT_MESSAGE });
      break;
    }
  }
  return problems;
}

function isProductSource(rel: string): boolean {
  return rel.startsWith(`src${path.sep}`) && PRODUCT_EXTS.has(path.extname(rel));
}

function importSpecifiers(text: string): string[] {
  const specs: string[] = [];
  const pattern =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of text.matchAll(pattern)) {
    const specifier = match[1] ?? match[2];
    if (specifier) specs.push(specifier);
  }
  return specs;
}

function isForbiddenSpecifier(rel: string, specifier: string): boolean {
  const normalized = specifier.replaceAll('\\', '/');
  const target = normalized.startsWith('.')
    ? path
        .normalize(path.join(path.dirname(rel), normalized))
        .replaceAll(path.sep, '/')
    : normalized;
  return importsTests(target) || importsFixtureSegment(target);
}

function importsTests(target: string): boolean {
  return target === 'tests' || target.startsWith('tests/') || target.includes('/tests/');
}

function importsFixtureSegment(target: string): boolean {
  return target
    .split('/')
    .some((segment) =>
      /^(?:__fixtures__|fixtures?|__mocks__|mocks?|mock-data|sample-data|dummy-data)$/i.test(
        segment,
      ),
    );
}
