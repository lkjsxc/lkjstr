// Generate validators directly from the worktree TypeScript AST; no hand-copied shapes.
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const text = await readFile('web/src/engine/protocol.ts', 'utf8');
const file = ts.createSourceFile('protocol.ts', text, ts.ScriptTarget.Latest, true);
const aliases = new Map(file.statements.filter(ts.isTypeAliasDeclaration).map((s) => [s.name.text, s.type]));
function shape(node) {
  if (ts.isParenthesizedTypeNode(node) || ts.isTypeOperatorNode(node)) return shape(node.type);
  if (ts.isTypeReferenceNode(node)) {
    if (node.typeName.getText(file) === 'ArrayBuffer') return { buffer: true };
    const target = aliases.get(node.typeName.getText(file));
    if (!target) throw new Error(`unhandled type ${node.getText(file)}`);
    return shape(target);
  }
  if (ts.isIndexedAccessTypeNode(node)) {
    const index = node.indexType;
    // Only one short literal property of a known object; never widen to unknown.
    if (ts.isLiteralTypeNode(index) && ts.isStringLiteral(index.literal) && index.literal.text.length <= 256) {
      const property = Object.getOwnPropertyDescriptor(shape(node.objectType).object ?? {}, index.literal.text)?.value;
      if (property && !property.optional) return property.shape;
    }
    throw new Error(`unhandled indexed type ${node.getText(file)}`);
  }
  if (ts.isUnionTypeNode(node)) return { union: node.types.map(shape) };
  if (ts.isIntersectionTypeNode(node)) return { intersection: node.types.map(shape) };
  if (ts.isArrayTypeNode(node)) return { array: shape(node.elementType) };
  if (ts.isTypeLiteralNode(node)) return { object: Object.fromEntries(node.members.map((m) => [m.name.text, { optional: !!m.questionToken, shape: shape(m.type) }])) };
  if (ts.isLiteralTypeNode(node)) {
    if (node.literal.kind === ts.SyntaxKind.NullKeyword) return { literal: null };
    return { literal: node.literal.text };
  }
  const primitive = new Map([[ts.SyntaxKind.StringKeyword, 'string'], [ts.SyntaxKind.NumberKeyword, 'number'], [ts.SyntaxKind.BooleanKeyword, 'boolean']]).get(node.kind);
  if (primitive) return { primitive };
  throw new Error(`unhandled type ${node.getText(file)}`);
}
function valid(s, v) {
  if (s.union) return s.union.some((t) => valid(t, v));
  if (s.intersection) return s.intersection.every((t) => valid(t, v));
  if ('literal' in s) return v === s.literal;
  if (s.primitive) return typeof v === s.primitive && (s.primitive !== 'number' || Number.isFinite(v));
  if (s.array) return Array.isArray(v) && v.every((x) => valid(s.array, x));
  if (s.buffer) return v instanceof ArrayBuffer;
  if (s.object) return v !== null && typeof v === 'object' && Object.entries(s.object).every(([k, t]) => (t.optional && v[k] === undefined) || valid(t.shape, v[k]));
  return false;
}
export const protocolVersion=Number(text.match(/PROTOCOL_VERSION\s*=\s*(\d+)/)?.[1]);
if(!Number.isInteger(protocolVersion))throw new Error('missing protocol number');
const schema = shape(aliases.get('FromEngine'));
export function validateReplies(messages) {
  for (const msg of messages) if (!valid(schema, msg)) throw new Error('protocol shape mismatch (payload redacted)');
}
function tags(alias, key) {
  return shape(aliases.get(alias)).union.map((s) => s.object?.[key]?.shape.literal).filter(Boolean);
}
export const sources = tags('Source', 'source');
export const actionKinds = [...new Set(tags('Action', 'a'))];
export const messageKinds = tags('ToEngine', 't');
export const sourceKinds = shape(aliases.get('Source')).union.map((s) => s.literal);
export function assertCoverage(actual, expected, name) {
  const absent = expected.filter((k) => !actual.has(k));
  if (absent.length) throw new Error(`missing ${name} scenarios: ${absent.join(', ')}`);
}

const mock = await readFile('web/src/engine/mock/engine.ts','utf8');
export const mockMessageKinds=[...new Set([...mock.matchAll(/msg\.t\s*===\s*'([^']+)'/g)].map(m=>m[1]))];
const actions=await readFile('web/src/engine/mock/actions.ts','utf8');
const zaps=await readFile('web/src/engine/mock/zaps.ts','utf8');
export const mockActionKinds=[...new Set([...actions.matchAll(/case\s+'([^']+)'/g)].map(m=>m[1]).concat(/action\.a\s*!==\s*'zap\.invoice'/.test(zaps)?['zap.invoice']:[]))];
