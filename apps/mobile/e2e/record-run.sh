#!/usr/bin/env bash
# End-to-end smoke test of the core workflow on a real Android device:
#   arm a scripted run -> record it -> finish -> save -> the activity and its reward are on the chain.
#
# This is the top of the test pyramid: slow (about two minutes), few, and about one thing that must never
# break. Everything below it (units, integration with fakes, anvil suites) runs without a phone.
#
# Needs, all already running:
#   - one USB device with the dev client installed, the Local profile selected and a registered athlete
#     signed in (Developer tools > Profile > Local, then sign in as a persona);
#   - the local stack (anvil + contracts + API + Metro, see `yarn dev:local` in the README);
#   - foundry's `cast` and `adb` on PATH.
#
#   ATHLETE=0x... apps/mobile/e2e/record-run.sh
#
# Env: ATHLETE (required, the signed-in athlete's address), RPC (default http://127.0.0.1:8545),
#      ACTIVITY_REGISTRY / MOVE_TO_EARN_TOKEN (default: anvil's deterministic local deployment),
#      RUN_SECONDS (default 70, about one lap of the 380 m loop at run pace), ANDROID_SERIAL.
set -euo pipefail

: "${ATHLETE:?Set ATHLETE to the address of the signed-in athlete}"
RPC="${RPC:-http://127.0.0.1:8545}"
ACTIVITY_REGISTRY="${ACTIVITY_REGISTRY:-0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512}"
MOVE_TO_EARN_TOKEN="${MOVE_TO_EARN_TOKEN:-0xa513E6E4b8f2a923D98304ec87F64353C4D5C853}"
RUN_SECONDS="${RUN_SECONDS:-70}"
# sed reads the whole list: stopping awk early would close the pipe and trip `pipefail`.
SERIAL="${ANDROID_SERIAL:-$(adb devices | awk 'NR>1 && $2=="device"{print $1}' | sed -n 1p)}"
[ -n "$SERIAL" ] || { echo "FAIL: no adb device"; exit 1; }
ADB=(adb -s "$SERIAL")
OUT="${E2E_OUT:-/tmp/stryde-e2e}"
mkdir -p "$OUT"

step() { printf '\n== %s\n' "$*"; }
fail() {
  echo "FAIL: $*"
  "${ADB[@]}" exec-out screencap -p >"$OUT/failure.png" 2>/dev/null || true
  echo "screenshot: $OUT/failure.png"
  exit 1
}

# The screen as text: every label and visible string, one per line.
screen() {
  "${ADB[@]}" shell uiautomator dump /sdcard/e2e.xml >/dev/null 2>&1 || true
  "${ADB[@]}" shell cat /sdcard/e2e.xml | grep -o '\(text\|content-desc\)="[^"]\+"' | sed 's/^[a-z-]*="//; s/"$//'
}
has() { screen | grep -qxF -- "$1"; }

# Taps the first element whose label or text is exactly $1; false when there is none.
tap() {
  "${ADB[@]}" shell uiautomator dump /sdcard/e2e.xml >/dev/null 2>&1 || true
  local xml bounds
  xml="$("${ADB[@]}" shell cat /sdcard/e2e.xml)"
  bounds="$(printf '%s' "$xml" | grep -o "\(text\|content-desc\)=\"$1\"[^>]*bounds=\"\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]\"" | head -1 | grep -o '[0-9]\+' | tail -4 | tr '\n' ' ')"
  set -- $bounds
  [ -n "${1:-}" ] || return 1
  "${ADB[@]}" shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2))
  sleep 1.5
}

# Polls up to $2 seconds for a label to appear.
wait_for() {
  local deadline=$((SECONDS + $2))
  while [ $SECONDS -lt "$deadline" ]; do
    has "$1" && return 0
    sleep 2
  done
  return 1
}

# Taps a point given as fractions of the screen. UiAutomator cannot dump a screen that never goes idle, and a
# live recording never does (the timer and the map animate), so the one control pressed mid-run is tapped by
# position. Everything else is found by its label.
tap_rel() {
  local size w h
  size="$("${ADB[@]}" shell wm size | grep -o '[0-9]\+x[0-9]\+' | tail -1)"
  w="${size%x*}"
  h="${size#*x}"
  "${ADB[@]}" shell input tap "$(python3 -c "print(int($w * $1))")" "$(python3 -c "print(int($h * $2))")"
  sleep 2
}

open() { "${ADB[@]}" shell am start -a android.intent.action.VIEW -d "$1" >/dev/null 2>&1; sleep 3; }

activities() { cast call "$ACTIVITY_REGISTRY" 'getActivityCount(address)(uint256)' "$ATHLETE" --rpc-url "$RPC" | awk '{print $1}'; }
strd() { cast call "$MOVE_TO_EARN_TOKEN" 'balanceOf(address)(uint256)' "$ATHLETE" --rpc-url "$RPC" | awk '{print $1}'; }

step "Preconditions"
cast block-number --rpc-url "$RPC" >/dev/null || fail "no chain at $RPC"
for port in 8545 3000 8081; do "${ADB[@]}" reverse "tcp:$port" "tcp:$port" >/dev/null; done
BEFORE_ACTIVITIES="$(activities)"
BEFORE_STRD="$(strd)"
echo "athlete $ATHLETE: $BEFORE_ACTIVITIES activities, $BEFORE_STRD wei STRD"

step "Arm a scripted run (Developer tools > Replay: 380 m loop at run pace)"
open "stryde://dev-tools"
tap "Replay" || fail "no Replay tab in Developer tools (is this a dev build?)"
tap "Route: Loop 380 m" || fail "no 380 m route"
tap "Speed: Run 6 m/s" || fail "no run speed"
tap "Arm for next recording" || fail "could not arm the replay"
wait_for "Armed: it plays when a recording starts." 8 || fail "the replay did not arm"

step "Record"
open "stryde://record"
tap "Start Run" || fail "no Start Run button on the Record tab"
# With no fix yet the app asks whether to start anyway; that is the gate working, so accept it.
sleep 3
tap "Continue" || true
wait_for "Finish activity" 1 || true
echo "recording for ${RUN_SECONDS}s"
sleep "$RUN_SECONDS"

step "Finish"
# The Pause button sits bottom-left of the live screen (see tap_rel for why this one is by position).
tap_rel 0.39 0.94
wait_for "Finish activity" 10 || fail "pausing did not show the Finish control"
tap "Finish activity" || fail "no Finish control once paused"
wait_for "Save Activity" 15 || fail "the Save screen did not open"

step "Save"
tap "Save" || fail "no Save button"
# A run that closes a loop asks for World ID before it claims territory. That modal hides the page behind
# it from the accessibility tree, so it is dismissed first (declining is a normal answer).
deadline=$((SECONDS + 90))
until has "ACTIVITY SAVED" || has "Verify to claim territory"; do
  [ $SECONDS -lt $deadline ] || fail "the activity was not reported saved"
  sleep 2
done
if has "Verify to claim territory"; then tap "Not now" || fail "could not dismiss the World ID prompt"; fi
wait_for "ACTIVITY SAVED" 10 || fail "the activity was not reported saved"

step "The chain agrees"
sleep 5
AFTER_ACTIVITIES="$(activities)"
AFTER_STRD="$(strd)"
echo "athlete now has $AFTER_ACTIVITIES activities, $AFTER_STRD wei STRD"
[ "$AFTER_ACTIVITIES" -eq $((BEFORE_ACTIVITIES + 1)) ] || fail "expected exactly one new activity on-chain ($BEFORE_ACTIVITIES -> $AFTER_ACTIVITIES)"
python3 - "$BEFORE_STRD" "$AFTER_STRD" <<'PY' || fail "no STRD reward arrived"
import sys
sys.exit(0 if int(sys.argv[2]) > int(sys.argv[1]) else 1)
PY

"${ADB[@]}" exec-out screencap -p >"$OUT/saved.png"
echo
echo "PASS: recorded, finished and saved a run; one activity and its reward are on-chain."
echo "screenshot: $OUT/saved.png"
