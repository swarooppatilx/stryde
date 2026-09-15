#!/bin/bash
set -euo pipefail

# One command for the whole local stack: anvil, the contracts, the API against that chain, and Metro.
# Usage: yarn dev:local            (from the repo root)
#        NO_METRO=1 yarn dev:local (everything but Metro)
# Then, on the phone: Developer tools > Profile > Local > Reload to apply.
#
# The API is pointed at anvil through environment variables set here. They win over anything in
# packages/api/.env, so this never uses (or reads) the Sepolia relayer key from that file.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ANVIL_PORT="${ANVIL_PORT:-8545}"
API_PORT="${API_PORT:-3000}"
METRO_PORT="${METRO_PORT:-8081}"
ANVIL_RPC="http://127.0.0.1:$ANVIL_PORT"
# Anvil's well-known first account: public, funded on every anvil, worthless anywhere else.
ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
YARN="${YARN:-yarn}"

PIDS=()
cleanup() {
  echo ""
  echo "=== Stopping the local stack ==="
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

if lsof -i ":$ANVIL_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $ANVIL_PORT is already in use. Stop whatever is using it (another anvil?) and retry." >&2
  exit 1
fi

echo "=== Anvil on port $ANVIL_PORT ==="
anvil --port "$ANVIL_PORT" --silent &
PIDS+=("$!")
for _ in $(seq 1 30); do
  cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1 && break
  sleep 0.5
done
cast block-number --rpc-url "$ANVIL_RPC" >/dev/null 2>&1 || { echo "Anvil did not start." >&2; exit 1; }

echo "=== Contracts ==="
ANVIL_EXTERNAL=1 ANVIL_PORT="$ANVIL_PORT" bash "$SCRIPT_DIR/deploy-local.sh"

echo "=== API on port $API_PORT (chain: anvil) ==="
(
  cd "$REPO_ROOT/packages/api"
  RELAYER_CHAIN_ID=31337 \
  RELAYER_RPC_URL="$ANVIL_RPC" \
  RELAYER_PRIVATE_KEY="$ANVIL_KEY" \
  PORT="$API_PORT" \
  exec node --env-file=.env --env-file-if-exists=.env.local --import tsx src/dev.ts
) &
PIDS+=("$!")

if command -v adb >/dev/null 2>&1 && [ -n "$(adb devices | awk 'NR>1 && $2=="device"')" ]; then
  echo "=== adb reverse (phone to this computer) ==="
  for port in "$ANVIL_PORT" "$API_PORT" "$METRO_PORT"; do adb reverse "tcp:$port" "tcp:$port" >/dev/null; done
else
  echo "(no adb device found: skip the port forwarding, or run adb reverse yourself)"
fi

if [ "${NO_METRO:-0}" = "1" ]; then
  echo "=== Ready: anvil $ANVIL_RPC, API http://127.0.0.1:$API_PORT. Ctrl-C to stop. ==="
  wait
else
  echo "=== Metro on port $METRO_PORT ==="
  cd "$REPO_ROOT/apps/mobile"
  EXPO_PUBLIC_API_URL="http://127.0.0.1:$API_PORT" $YARN expo start --dev-client --port "$METRO_PORT"
fi
