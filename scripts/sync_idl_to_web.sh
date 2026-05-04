#!/usr/bin/env bash
# Sync the Anchor build artifacts into the web/ tree.
#
# After every `anchor build` that changes the program surface (new instruction,
# new event, account-shape change), run this to keep the frontend's IDL +
# generated TS types in sync with the deployed program.
#
# The frontend imports from web/src/lib/idl/ (committed) rather than from
# target/ (gitignored) so that npm builds succeed without first running
# `anchor build`.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f target/idl/kommit.json ]; then
  echo "ERROR: target/idl/kommit.json not found. Run 'anchor build' first."
  exit 1
fi
if [ ! -f target/types/kommit.ts ]; then
  echo "ERROR: target/types/kommit.ts not found. Run 'anchor build' first."
  exit 1
fi

mkdir -p web/src/lib/idl
cp target/idl/kommit.json web/src/lib/idl/kommit.json
cp target/types/kommit.ts web/src/lib/idl/kommit.ts

echo "Synced:"
echo "  target/idl/kommit.json   -> web/src/lib/idl/kommit.json"
echo "  target/types/kommit.ts   -> web/src/lib/idl/kommit.ts"
echo
echo "Diff against last commit:"
git diff --stat web/src/lib/idl/ 2>/dev/null || true
