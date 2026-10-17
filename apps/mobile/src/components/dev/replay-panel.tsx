import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { AppButton } from '@/components/button';
import { Segmented } from '@/components/form-controls';
import { ThemedText } from '@/components/themed-text';
import { REPLAY_ROUTES, REPLAY_SPEEDS } from '@/constants/replayRoutes';
import { Spacing } from '@/constants/theme';
import { useNow } from '@/hooks/useNow';
import { getDevLocation } from '@/platform/devLocation';
import { formatDistance } from '@/utils/format';

/** Walk a scripted route so a whole recording can be driven from a desk. */
export function ReplayPanel() {
  const location = getDevLocation();
  const [routeId, setRouteId] = useState<(typeof REPLAY_ROUTES)[number]['id']>('loop');
  const [speed, setSpeed] = useState<number>(REPLAY_SPEEDS[0].value);
  // Re-read the replay's progress every second while this panel is open.
  useNow(1000);

  const route = REPLAY_ROUTES.find((r) => r.id === routeId) ?? REPLAY_ROUTES[0];
  const progress = location?.progress();

  if (!location) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={styles.scroll}>
        Route replay is only available in development builds.
      </ThemedText>
    );
  }

  const replayControls = () => {
    if (location.replaying) {
      return (
        <AppButton variant="secondary" onPress={() => location.stopReplay()}>
          Stop replay
        </AppButton>
      );
    }
    if (location.armed) {
      return (
        <>
          <ThemedText type="small">Armed: it plays when a recording starts.</ThemedText>
          <AppButton variant="secondary" onPress={() => location.disarmReplay()}>
            Cancel
          </AppButton>
        </>
      );
    }
    return (
      <>
        <AppButton onPress={() => location.armReplay(route.points, { speedMps: speed })}>
          Arm for next recording
        </AppButton>
        <AppButton
          variant="secondary"
          onPress={() => location.startReplay(route.points, { speedMps: speed })}
        >
          Start now
        </AppButton>
      </>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedText type="caption" themeColor="textSecondary">
        Arm a replay, then tap Start on the Record tab: the recording receives these positions
        instead of the phone&apos;s GPS, in real time. (Start now plays it straight away, for
        watching the route without recording.) Pick the speed tier matching your sport: faster than
        the sport&apos;s speed cap, the tracker discards every fix as an outlier and the run records
        0 m. Walk, hike, row or skate use Walk; run uses Run; ride uses Ride.
      </ThemedText>
      <Segmented
        label="Route"
        value={routeId}
        options={REPLAY_ROUTES.map((r) => ({ value: r.id, label: r.label }))}
        onChange={setRouteId}
      />
      <ThemedText type="caption" themeColor="textSecondary">
        {route.note}
      </ThemedText>
      <Segmented
        label="Speed"
        value={speed}
        options={REPLAY_SPEEDS.map((s) => ({ value: s.value, label: s.label }))}
        onChange={setSpeed}
      />

      {replayControls()}

      {progress && (location.replaying || progress.done) && (
        <ThemedText type="small">
          {progress.done ? 'Finished: ' : 'Walked '}
          {formatDistance(progress.distanceM)} of {formatDistance(progress.totalM)}
        </ThemedText>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.four, gap: Spacing.three },
});
