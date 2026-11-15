#!/bin/sh
# The merged worktree owns the authoritative contract. No Git/network operation.
set -eu
node --input-type=module -e "import ts from 'typescript'; if (!ts.createSourceFile) process.exit(1)"
test -f web/src/engine/protocol.ts
