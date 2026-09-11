#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$CONTRACTS_DIR/src/abis"

mkdir -p "$OUT_DIR"

CONTRACTS=(
  ProfileRegistry
  ActivityRegistry
  TerritoryRegistry
  SeasonManager
  AchievementRegistry
  ChallengeRegistry
  TerritoryNFT
  MoveToEarnToken
  GroupRegistry
)

for contract in "${CONTRACTS[@]}"; do
  echo "Generating ABI for $contract..."
  forge inspect "$contract" abi --json > "$OUT_DIR/$contract.json"
done

echo "ABIs written to $OUT_DIR"
