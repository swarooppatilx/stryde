#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
SHARED_DIR="$(cd "$CONTRACTS_DIR/../shared" && pwd)"

echo "=== Step 1: Generating ABI JSON files ==="
bash "$SCRIPT_DIR/generate-abis.sh"

echo ""
echo "=== Step 2: Generating inline ABI TypeScript ==="
bash "$SHARED_DIR/scripts/generate-abis-inline.sh"

echo ""
echo "=== All generation complete ==="