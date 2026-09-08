#!/usr/bin/env bash
set -euo pipefail

source .env

RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"

echo "Verifying contracts on Etherscan..."

# ProfileRegistry
forge verify-contract $PROFILE_REGISTRY_ADDRESS src/ProfileRegistry.sol:ProfileRegistry \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --constructor-args "$(cast abi-encode 'constructor(address)' $DEPLOYER_ADDRESS)"

# ActivityRegistry
forge verify-contract $ACTIVITY_REGISTRY_ADDRESS src/ActivityRegistry.sol:ActivityRegistry \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

# TerritoryRegistry
forge verify-contract $TERRITORY_REGISTRY_ADDRESS src/TerritoryRegistry.sol:TerritoryRegistry \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

# TerritoryNFT
forge verify-contract $TERRITORY_NFT_ADDRESS src/TerritoryNFT.sol:TerritoryNFT \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

# SeasonManager
forge verify-contract $SEASON_MANAGER_ADDRESS src/SeasonManager.sol:SeasonManager \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

# AchievementRegistry
forge verify-contract $ACHIEVEMENT_REGISTRY_ADDRESS src/AchievementRegistry.sol:AchievementRegistry \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

# ChallengeRegistry
forge verify-contract $CHALLENGE_REGISTRY_ADDRESS src/ChallengeRegistry.sol:ChallengeRegistry \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

# MoveToEarnToken
forge verify-contract $MOVE_TO_EARN_TOKEN_ADDRESS src/MoveToEarnToken.sol:MoveToEarnToken \
  --chain-id 11155111 \
  --etherscan-api-key "$ETHERSCAN_API_KEY"

echo "Verification complete!"
