#!/bin/bash
set -e

# Deploy all Stryde contracts to a target chain
# Usage: ./scripts/deploy-all.sh <rpc-url> <private-key>

RPC_URL="${1:?Usage: ./scripts/deploy-all.sh <rpc-url> <private-key>}"
PRIVATE_KEY="${2:?Usage: ./scripts/deploy-all.sh <rpc-url> <private-key>}"

echo "Deploying Stryde contracts to: $RPC_URL"

export PRIVATE_KEY
export RPC_URL

echo ""
echo "=== Deploying ProfileRegistry ==="
forge script script/DeployProfileRegistry.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify 2>&1 | tee /tmp/deploy-profile.log

echo ""
echo "=== Deploying ActivityRegistry ==="
forge script script/DeployActivityRegistry.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify 2>&1 | tee /tmp/deploy-activity.log

echo ""
echo "=== Deploying TerritoryRegistry ==="
forge script script/DeployTerritoryRegistry.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify 2>&1 | tee /tmp/deploy-territory.log

echo ""
echo "=== Deploying SeasonManager ==="
forge script script/DeploySeasonManager.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify 2>&1 | tee /tmp/deploy-season.log

echo ""
echo "=== Deploying AchievementRegistry ==="
forge script script/DeployAchievementRegistry.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify 2>&1 | tee /tmp/deploy-achievement.log

echo ""
echo "=== Deploying ChallengeRegistry ==="
forge script script/DeployChallengeRegistry.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --verify 2>&1 | tee /tmp/deploy-challenge.log

echo ""
echo "=== Deployment Complete ==="
echo "Check /tmp/deploy-*.log for transaction hashes"
