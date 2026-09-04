#!/bin/bash
set -e

# Start local Anvil node and deploy all Stryde contracts
# Usage: ./scripts/deploy-local.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

ANVIL_PORT="${ANVIL_PORT:-8545}"
ANVIL_RPC="http://127.0.0.1:$ANVIL_PORT"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo "=== Starting Anvil on port $ANVIL_PORT ==="
anvil --port "$ANVIL_PORT" --silent &
ANVIL_PID=$!

cleanup() {
  echo "=== Stopping Anvil (PID: $ANVIL_PID) ==="
  kill "$ANVIL_PID" 2>/dev/null || true
}
trap cleanup EXIT

sleep 2

echo "=== Deploying contracts to local Anvil ==="
export PRIVATE_KEY
export RPC_URL="$ANVIL_RPC"

CONTRACT_ADDRESSES=()

echo ""
echo "--- ProfileRegistry ---"
OUTPUT=$(forge script script/DeployProfileRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
PROFILE_ADDRESS=$(echo "$OUTPUT" | grep -oP 'ProfileRegistry deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("profileRegistry=$PROFILE_ADDRESS")

echo ""
echo "--- ActivityRegistry ---"
OUTPUT=$(forge script script/DeployActivityRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
ACTIVITY_ADDRESS=$(echo "$OUTPUT" | grep -oP 'ActivityRegistry deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("activityRegistry=$ACTIVITY_ADDRESS")

echo ""
echo "--- TerritoryRegistry ---"
OUTPUT=$(forge script script/DeployTerritoryRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
TERRITORY_ADDRESS=$(echo "$OUTPUT" | grep -oP 'TerritoryRegistry deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("territoryRegistry=$TERRITORY_ADDRESS")

echo ""
echo "--- SeasonManager ---"
OUTPUT=$(forge script script/DeploySeasonManager.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
SEASON_ADDRESS=$(echo "$OUTPUT" | grep -oP 'SeasonManager deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("seasonManager=$SEASON_ADDRESS")

echo ""
echo "--- AchievementRegistry ---"
OUTPUT=$(forge script script/DeployAchievementRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
ACHIEVEMENT_ADDRESS=$(echo "$OUTPUT" | grep -oP 'AchievementRegistry deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("achievementRegistry=$ACHIEVEMENT_ADDRESS")

echo ""
echo "--- ChallengeRegistry ---"
OUTPUT=$(forge script script/DeployChallengeRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
CHALLENGE_ADDRESS=$(echo "$OUTPUT" | grep -oP 'ChallengeRegistry deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("challengeRegistry=$CHALLENGE_ADDRESS")

echo ""
echo "=== Local Deployment Complete ==="
echo ""
echo "Contract Addresses:"
for addr in "${CONTRACT_ADDRESSES[@]}"; do
  echo "  $addr"
done

echo ""
echo "To use these addresses, update packages/shared/src/constants.ts"
echo "Or set CHAIN_MODE=local in your .env file"
