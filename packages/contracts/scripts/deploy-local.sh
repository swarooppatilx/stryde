#!/bin/bash
set -e

# Start local Anvil node and deploy all Stryde contracts
# Usage: ./scripts/deploy-local.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

ANVIL_PORT="${ANVIL_PORT:-8545}"
ANVIL_RPC="http://127.0.0.1:$ANVIL_PORT"
PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

# ANVIL_EXTERNAL=1: a node is already running on the port (see dev-local.sh), so neither start nor stop one.
if [ "${ANVIL_EXTERNAL:-0}" = "1" ]; then
  echo "=== Using the Anvil already running on port $ANVIL_PORT ==="
else
  echo "=== Starting Anvil on port $ANVIL_PORT ==="
  anvil --port "$ANVIL_PORT" --silent &
  ANVIL_PID=$!

  cleanup() {
    echo "=== Stopping Anvil (PID: $ANVIL_PID) ==="
    kill "$ANVIL_PID" 2>/dev/null || true
  }
  trap cleanup EXIT

  sleep 2
fi

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
PROFILE_ADDRESS=$(echo "$OUTPUT" | grep -oE 'ProfileRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("profileRegistry=$PROFILE_ADDRESS")

echo ""
echo "--- ActivityRegistry ---"
OUTPUT=$(forge script script/DeployActivityRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
ACTIVITY_ADDRESS=$(echo "$OUTPUT" | grep -oE 'ActivityRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("activityRegistry=$ACTIVITY_ADDRESS")

echo ""
echo "--- TerritoryRegistry ---"
OUTPUT=$(forge script script/DeployTerritoryRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
TERRITORY_ADDRESS=$(echo "$OUTPUT" | grep -oE 'TerritoryRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("territoryRegistry=$TERRITORY_ADDRESS")

echo ""
echo "--- SeasonManager ---"
OUTPUT=$(forge script script/DeploySeasonManager.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
SEASON_ADDRESS=$(echo "$OUTPUT" | grep -oE 'SeasonManager deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("seasonManager=$SEASON_ADDRESS")

echo ""
echo "--- AchievementRegistry ---"
OUTPUT=$(forge script script/DeployAchievementRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
ACHIEVEMENT_ADDRESS=$(echo "$OUTPUT" | grep -oE 'AchievementRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("achievementRegistry=$ACHIEVEMENT_ADDRESS")

echo ""
echo "--- ChallengeRegistry ---"
OUTPUT=$(forge script script/DeployChallengeRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
CHALLENGE_ADDRESS=$(echo "$OUTPUT" | grep -oE 'ChallengeRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("challengeRegistry=$CHALLENGE_ADDRESS")

echo ""
echo "--- TerritoryNFT ---"
OUTPUT=$(forge script script/DeployTerritoryNFT.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
TERRITORY_NFT_ADDRESS=$(echo "$OUTPUT" | grep -oE 'TerritoryNFT deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("territoryNFT=$TERRITORY_NFT_ADDRESS")

echo ""
echo "--- MoveToEarnToken ---"
OUTPUT=$(forge script script/DeployMoveToEarnToken.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
MOVE_TO_EARN_ADDRESS=$(echo "$OUTPUT" | grep -oE 'MoveToEarnToken deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("moveToEarnToken=$MOVE_TO_EARN_ADDRESS")

echo ""
echo "--- GroupRegistry ---"
OUTPUT=$(forge script script/DeployGroupRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
GROUP_ADDRESS=$(echo "$OUTPUT" | grep -oE 'GroupRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("groupRegistry=$GROUP_ADDRESS")

echo ""
echo "--- SocialRegistry ---"
OUTPUT=$(forge script script/DeploySocialRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
SOCIAL_ADDRESS=$(echo "$OUTPUT" | grep -oE 'SocialRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("socialRegistry=$SOCIAL_ADDRESS")
echo "--- EventRegistry ---"
OUTPUT=$(forge script script/DeployEventRegistry.s.sol \
  --rpc-url "$ANVIL_RPC" \
  --broadcast 2>&1)
echo "$OUTPUT"
EVENT_ADDRESS=$(echo "$OUTPUT" | grep -oE 'EventRegistry deployed at: 0x[a-fA-F0-9]{40}' | grep -oE '0x[a-fA-F0-9]{40}')
CONTRACT_ADDRESSES+=("eventRegistry=$EVENT_ADDRESS")

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
            rf'({re.escape(key)}:\s*)(ZERO_ADDRESS|\x27[^\x27]*\x27)',
            lambda m, a=addr: m.group(1) + chr(39) + a + chr(39),
            new_body
        )
    return prefix + new_body + suffix

new_content = re.sub(pattern, replace_addresses, content, flags=re.DOTALL)

with open('$SHARED_CONSTANTS', 'w') as f:
    f.write(new_content)

print('Updated local addresses in constants.ts')
"

# The API relayer keeps its own copy of the local map — if it lags behind
# constants.ts, relayed writes hit the wrong (or no) contract.
echo "=== Auto-updating api chainConfig.ts ==="

API_CHAIN_CONFIG="$SCRIPT_DIR/../../api/src/lib/chainConfig.ts"

python3 -c "
import re

with open('$API_CHAIN_CONFIG', 'r') as f:
    content = f.read()

addresses = {}
raw = '''$(printf '%s\n' "${CONTRACT_ADDRESSES[@]}")'''
for line in raw.strip().split('\n'):
    if '=' in line:
        k, v = line.split('=', 1)
        addresses[k.strip()] = v.strip()

pattern = r'(LOCAL_CONTRACTS[^=]*= \{)([^}]*)(\})'

def replace_addresses(match):
    prefix, body, suffix = match.groups()
    for key, addr in addresses.items():
        if re.search(rf'\b{re.escape(key)}:', body):
            body = re.sub(rf'({re.escape(key)}:\s*)\x27[^\x27]*\x27', lambda m, a=addr: m.group(1) + chr(39) + a + chr(39), body)
        else:
            body = body.rstrip() + '\n  ' + key + ': ' + chr(39) + addr + chr(39) + ',\n'
    return prefix + body + suffix

new_content, n = re.subn(pattern, replace_addresses, content, flags=re.DOTALL)
if n != 1:
    raise SystemExit('LOCAL_CONTRACTS block not found in chainConfig.ts')

with open('$API_CHAIN_CONFIG', 'w') as f:
    f.write(new_content)

print('Updated local addresses in api chainConfig.ts')
"

echo ""
echo "To use these addresses, set CHAIN_MODE=local in your .env file"
