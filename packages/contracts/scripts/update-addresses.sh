#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONSTANTS_FILE="$(cd "$SCRIPT_DIR/../../shared/src" && pwd)/constants.ts"

# Read the local addresses from the most recent deploy output
# This script is called by deploy-local.sh after deployment

if [[ ! -f "$CONSTANTS_FILE" ]]; then
  echo "ERROR: constants.ts not found at $CONSTANTS_FILE"
  exit 1
fi

echo "Updating local addresses in $CONSTANTS_FILE"