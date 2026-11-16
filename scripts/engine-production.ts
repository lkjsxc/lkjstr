// Production packages contain no callable conformance controls. Inspect, never instantiate.
import ts from 'typescript';

const handleMethods = [
  'advance_time',
  'set_test_relays',
  'prime_private_stop',
  'replay_stopped_input',
  'private_stop_counts',
  'hold_public_sign',
  'public_sign_queued',
  'release_public_sign',
  'renew_queued_bunker',
] as const;
const forbidden = new Set([
  'benchmark',
  ...handleMethods.map((name) => `workerhandle_${name}`),
  ...['prime_private_stop', 'replay_stopped_input', 'private_stop_counts'].map(
    (name) => `sharedworkerhandle_${name}`,
  ),
]);
const entries = ['start', 'start_port_host', 'start_shared'] as const;
const handles = ['WorkerHandle', 'SharedWorkerHandle'] as const;

function memberName(name: ts.PropertyName | undefined): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text;
  }
  return undefined;
}

export function assertProductionEngine(bytes: Uint8Array, bindings: string): void {
  let exports: WebAssembly.ModuleExportDescriptor[];
  try {
    // Module construction validates the binary but executes neither imports nor a start function.
    exports = WebAssembly.Module.exports(new WebAssembly.Module(Uint8Array.from(bytes)));
  } catch {
    throw new Error('production engine is not valid WebAssembly');
  }
  const blocked = exports.filter((entry) => forbidden.has(entry.name)).map((entry) => entry.name);
  if (blocked.length) throw new Error(`test-only engine exports: ${blocked.sort().join(', ')}`);
  const functions = new Set(
    exports.filter((entry) => entry.kind === 'function').map((entry) => entry.name),
  );
  const required = [...entries, 'workerhandle_stop', 'sharedworkerhandle_stop'];
  if (required.some((name) => !functions.has(name))) {
    throw new Error('production engine is missing its Worker entry points');
  }

  // Bindgen emits exported function/class declarations. Parsing avoids comment/string matches.
  const file = ts.createSourceFile(
    'lkjstr_engine.js',
    bindings,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const declared = new Set<string>();
  const stale: string[] = [];
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text;
      if (name === 'benchmark') stale.push(name);
      if (name && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        declared.add(name);
      }
    }
    if (!ts.isClassDeclaration(statement) || !statement.name) continue;
    const name = statement.name.text;
    if (!handles.some((handle) => handle === name)) continue;
    if (statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      declared.add(name);
    for (const member of statement.members) {
      const method = memberName(member.name);
      if (method && handleMethods.some((candidate) => candidate === method)) {
        stale.push(`${name}.${method}`);
      }
    }
  }
  if (stale.length) throw new Error(`test-only engine bindings: ${stale.sort().join(', ')}`);
  if ([...entries, ...handles].some((name) => !declared.has(name))) {
    throw new Error('production engine bindings are missing their Worker entry points');
  }
}
