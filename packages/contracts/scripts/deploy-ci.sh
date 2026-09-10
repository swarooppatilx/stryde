#!/usr/bin/env bash
set -euo pipefail

# Deploy contracts to Sepolia and output addresses for constants update
# Usage: bash scripts/deploy-ci.sh
# Requires: PRIVATE_KEY, ETHERSCAN_API_KEY in environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
CHAIN_ID=11155111

echo "=== Deploying contracts to Sepolia ==="

OUTPUT=$(forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --chain-id "$CHAIN_ID" 2>&1)

echo "$OUTPUT"

# Extract deployed addresses.
# DeployAll.s.sol logs a machine-readable summary block of lines like:
#   profileRegistry= 0x1234...
#   activityRegistry= 0x1234...
# (camelCase key matching packages/shared/src/constants.ts, "=", a space, then the address)
ADDRESSES=$(echo "$OUTPUT" | grep -oP '^[a-zA-Z][a-zA-Z0-9]*= 0x[a-fA-F0-9]{40}$' || true)

if [ -z "$ADDRESSES" ]; then
  echo "ERROR: Could not extract contract addresses from deploy output"
  exit 1
fi

echo ""
echo "=== Deployed Addresses ==="
echo "$ADDRESSES"

# Output as key=0xADDRESS (no space), one per line, for CI consumption
echo "$ADDRESSES" | sed -E 's/= 0x/=0x/' > "$SCRIPT_DIR/../.deployed-addresses.env"

echo ""
echo "Addresses saved to .deployed-addresses.env"
echo "Update packages/shared/src/constants.ts with these addresses"