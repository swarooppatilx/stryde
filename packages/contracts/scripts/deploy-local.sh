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
echo "--- TerritoryNFT ---"
OUTPUT=$(forge script script/DeployTerritoryNFT.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
TERRITORY_NFT_ADDRESS=$(echo "$OUTPUT" | grep -oP 'TerritoryNFT deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("territoryNFT=$TERRITORY_NFT_ADDRESS")

echo ""
echo "--- MoveToEarnToken ---"
OUTPUT=$(forge script script/DeployMoveToEarnToken.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
MOVE_TO_EARN_ADDRESS=$(echo "$OUTPUT" | grep -oP 'MoveToEarnToken deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("moveToEarnToken=$MOVE_TO_EARN_ADDRESS")

echo ""
echo "--- GroupRegistry ---"
OUTPUT=$(forge script script/DeployGroupRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
GROUP_ADDRESS=$(echo "$OUTPUT" | grep -oP 'GroupRegistry deployed at: \K0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("groupRegistry=$GROUP_ADDRESS")

echo ""
echo "=== Local Deployment Complete ==="
echo ""
echo "Contract Addresses:"
for addr in "${CONTRACT_ADDRESSES[@]}"; do
  echo "  $addr"
done

echo ""
echo "=== Auto-updating constants.ts ==="

SHARED_CONSTANTS="$SCRIPT_DIR/../../shared/src/constants.ts"

python3 -c "
import re

with open('$SHARED_CONSTANTS', 'r') as f:
    content = f.read()

addresses = {}
raw = '''$(printf '%s\n' "${CONTRACT_ADDRESSES[@]}")'''
for line in raw.strip().split('\n'):
    if '=' in line:
        k, v = line.split('=', 1)
        addresses[k.strip()] = v.strip()

# Replace addresses in the local: section
pattern = r'(local: \{[^}]*contracts: \{)([^}]*)(\}\s*,?\s*\})'

def replace_addresses(match):
    prefix, old_body, suffix = match.groups()
    new_body = old_body
    for key, addr in addresses.items():
        new_body = re.sub(
            rf'({re.escape(key)}:\s*\x27)[^\x27]*\x27',
            r'\g<1>' + addr + r'\x27',
            new_body
        )
    return prefix + new_body + suffix

new_content = re.sub(pattern, replace_addresses, content, flags=re.DOTALL)

with open('$SHARED_CONSTANTS', 'w') as f:
    f.write(new_content)

print('Updated local addresses in constants.ts')
"

echo ""
echo "To use these addresses, set CHAIN_MODE=local in your .env file"
