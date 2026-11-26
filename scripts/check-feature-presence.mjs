// Guard against saving a capability refusal or hiding a feature while engine data is incomplete.
import { readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import ts from 'typescript';

const sourceDir = new URL('../web/src/', import.meta.url);
const capability = /^(?:supported|refused|unsupported|unavailable|capability|capabilities)$/i;
const capabilityKey = /(?:^|[:_-])(?:rails?|caps?|capabilities|support(?:ed)?)(?:$|[:_-])/i;
const completeness =
  /^(?:supported|refused|unsupported|complete|completeness|incomplete|partial|truncated|hydrated|restored|restoring|exact|counted|coverage|cacheComplete|hasCoverage|hasExactCounts|canCount)$/i;
const dataLengths = /^(?:months|days|clock|positions|rows|notes|events|records)$/i;

function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function assignedValues(file, checker) {
  const assigned = new Map();
  walk(file, (node) => {
    if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
        !ts.isIdentifier(node.left)) return;
    const symbol = checker.getSymbolAtLocation(node.left);
    if (!symbol) return;
    if (!assigned.has(symbol)) assigned.set(symbol, []);
    assigned.get(symbol).push(node.right);
  });
  return assigned;
}

function carries(node, checker, assigned, matches, seen = new Set()) {
  if (!node || seen.has(node)) return false;
  seen.add(node);
  if (matches(node)) return true;
  if (ts.isIdentifier(node)) {
    const symbol = checker.getSymbolAtLocation(node);
    const definitions = symbol?.declarations ?? [];
    const values = definitions.flatMap((definition) => {
      if (ts.isVariableDeclaration(definition)) return [definition.initializer];
      if (ts.isFunctionDeclaration(definition)) return [definition.body];
      return [];
    });
    values.push(...(assigned.get(symbol) ?? []));
    if (values.some((value) => carries(value, checker, assigned, matches, seen))) return true;
  }
  return !!ts.forEachChild(node, (child) => carries(child, checker, assigned, matches, seen) || undefined);
}

const literalFalse = (node) =>
  node?.kind === ts.SyntaxKind.FalseKeyword ||
  (node && ts.isStringLiteralLike(node) && node.text === 'false');

function refusal(node) {
  return (
    (ts.isStringLiteralLike(node) && /^(?:refused|unsupported)$/i.test(node.text)) ||
    (ts.isIdentifier(node) && capability.test(node.text))
  );
}

function savedRefusal(key, value, checker, assigned) {
  if (literalFalse(value) || carries(value, checker, assigned, refusal)) return true;
  const storesCapability = carries(
    key,
    checker,
    assigned,
    (node) => ts.isStringLiteralLike(node) && capabilityKey.test(node.text),
  );
  return storesCapability && carries(value, checker, assigned, literalFalse);
}

function missingData(node) {
  if (ts.isIdentifier(node)) return completeness.test(node.text);
  if (!ts.isPropertyAccessExpression(node) || node.name.text !== 'length') return false;
  return ts.isPropertyAccessExpression(node.expression) && dataLengths.test(node.expression.name.text);
}

function effects(node) {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) && node.left.name.text === 'hidden')
    return ['hidden', node.right];
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return [];
  const { expression: receiver, name } = node.expression;
  const [key, value] = node.arguments;
  if ((receiver.getText() === 'kv' && name.text === 'set') ||
      (/(?:^|\.)localStorage$/.test(receiver.getText()) && name.text === 'setItem'))
    return ['storage', value, key];
  if (name.text === 'toggleAttribute' && key && ts.isStringLiteralLike(key) && key.text === 'hidden')
    return ['hidden', value];
  return [];
}

export function presenceViolations(paths) {
  const program = ts.createProgram(paths, { noResolve: true, noLib: true });
  const checker = program.getTypeChecker();
  const reports = [];
  for (const path of paths) {
    const file = program.getSourceFile(path);
    const lines = file.text.split('\n');
    const assigned = assignedValues(file, checker);
    walk(file, (node) => {
      const [effect, value, key] = effects(node);
      if (!effect) return;
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      const end = file.getLineAndCharacterOfPosition(node.getEnd()).line;
      if (lines.slice(line, end + 1).some((text) => /\/\/\s*absent-by-view:\s*\S/.test(text))) return;
      const forbidden = effect === 'storage'
        ? savedRefusal(key, value, checker, assigned)
        : carries(value, checker, assigned, missingData);
      if (forbidden) {
        const why = effect === 'storage'
          ? 'keep capability refusals out of persistent storage'
          : 'keep the feature visible while engine data is incomplete';
        reports.push(`${relative(process.cwd(), path)}:${line + 1}: ${why}`);
      }
    });
  }
  return reports;
}

if (import.meta.main) {
  const files = readdirSync(sourceDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && extname(entry.name) === '.ts')
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort();
  const violations = presenceViolations(files);
  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  }
}
