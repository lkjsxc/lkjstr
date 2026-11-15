#!/bin/sh
# Isolated fetch: linked-worktree Git metadata is outside the allowed write root.
set -eu
mkdir -p tmp/frontend-contract tmp/frontend-protocol/web/src/engine
if [ ! -d tmp/frontend-contract/.git ]; then git init -q tmp/frontend-contract; fi
python3 - <<'PY'
import subprocess
url=subprocess.check_output(['git','remote','get-url','origin'],text=True).strip()
subprocess.run(['git','-C','tmp/frontend-contract','fetch','--quiet',url,'web/next-20261114'],check=True)
PY
git -C tmp/frontend-contract show FETCH_HEAD:web/src/engine/protocol.ts > tmp/frontend-protocol/web/src/engine/protocol.ts
git -C tmp/frontend-contract show FETCH_HEAD:web/src/engine/mock/engine.ts > tmp/frontend-mock.ts
git -C tmp/frontend-contract show FETCH_HEAD:web/src/engine/mock/actions.ts > tmp/frontend-actions.ts
git apply --directory=tmp/frontend-protocol docs/protocol-additions.patch
cp tmp/frontend-protocol/web/src/engine/protocol.ts tmp/protocol-added.ts
# Pin the AST API; newer native TypeScript releases omit this API.
if [ ! -f tmp/type-tools/node_modules/typescript/lib/typescript.js ]; then
  npm install --prefix tmp/type-tools --cache tmp/npm-cache --silent --no-audit --no-fund typescript@5.9.3
fi
