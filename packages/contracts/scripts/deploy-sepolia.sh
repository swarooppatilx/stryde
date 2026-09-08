#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/deploy-sepolia.sh
# Requires: PRIVATE_KEY and ETHERSCAN_API_KEY in .env

source .env

RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
CHAIN_ID=11155111

echo "Deploying contracts to Sepolia..."

forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --verify \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --chain-id "$CHAIN_ID"

echo "Deployment complete!"
echo "Verify on Etherscan: https://sepolia.etherscan.io"
