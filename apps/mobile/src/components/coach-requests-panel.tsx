import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Card } from '@/components/card';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listCoachRequests, shortRequestId } from '@/services/coachService';
import type { HumanAuth } from '@/services/humanPassService';
import {
  type CoachRequestEntry,
  entryCost,
  entryTime,
  entryTitle,
  entryTrust,
  newestFirst,
} from '@/utils/coachRequests';
import { Toast } from '@/utils/toast';

/** Every 0G request id behind the coach's results, collapsed until opened; tap one to copy it. */
export function CoachRequestsPanel({ auth }: { auth: HumanAuth | null }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CoachRequestEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const { requests } = await listCoachRequests(auth);
      setEntries(newestFirst(requests));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the request log.');
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) void load();
  };

  return (
    <Card style={styles.card}>
      <Tappable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="0G request IDs"
        style={styles.header}
      >
        <Ionicons name="finger-print-outline" size={16} color={theme.brand.primary} />
        <ThemedText type="smallBold" style={styles.flex}>
          0G request IDs
        </ThemedText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textSecondary}
        />
      </Tappable>

      {open ? (
        <ThemedView style={styles.list}>
          {loading ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Loading…
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText type="caption" themeColor="textSecondary">
              {error}
            </ThemedText>
          ) : null}
          {!loading && !error && entries?.length === 0 ? (
            <ThemedText type="caption" themeColor="textSecondary">
              Nothing yet. Plan your day or review a run and its 0G request IDs appear here.
            </ThemedText>
          ) : null}
          {(entries ?? []).map((entry) => {
            const trust = entryTrust(entry);
            const cost = entryCost(entry);
            return (
              <ThemedView key={`${entry.at}-${entry.kind}`} style={styles.entry}>
                <ThemedText type="smallBold">{entryTitle(entry)}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {[entryTime(entry.at, new Date()), trust?.label, cost]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
                {entry.calls.map((call, i) => (
                  <Tappable
                    key={`${call.requestId ?? 'none'}-${i}`}
                    onPress={async () => {
                      if (!call.requestId) return;
                      await Clipboard.setStringAsync(call.requestId);
                      Toast.success('0G request id copied', 1);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${call.model}. Request ${call.requestId ?? 'unknown'}. Copy the request id`}
                    hitSlop={8}
                  >
                    <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                      {call.model} · {shortRequestId(call.requestId)}
                    </ThemedText>
                  </Tappable>
                ))}
              </ThemedView>
            );
          })}
        </ThemedView>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  list: { gap: Spacing.three },
  entry: { gap: Spacing.half },
});
