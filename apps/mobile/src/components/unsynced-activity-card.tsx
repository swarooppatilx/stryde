import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { getSportIcon } from '@/constants/activity';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useChainRetry } from '@/hooks/useChainRetry';
import type { Activity } from '@/types';
import { Card } from './card';
import { ChainSyncRetry } from './chain-sync-retry';
import { ThemedText } from './themed-text';

/** A feed row for an activity saved on this device that the chain does not hold yet. */
export function UnsyncedActivityCard({ activity }: { activity: Activity }) {
  const theme = useTheme();
  const { busy, retry } = useChainRetry(activity.id);
  return (
    <Card padding={Spacing.three}>
      <View style={styles.header}>
        <Ionicons
          name={getSportIcon(activity.activityType)}
          size={18}
          color={theme.textSecondary}
        />
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {activity.name ?? 'Activity'}
        </ThemedText>
      </View>
      <ChainSyncRetry sync={activity.sync} busy={busy} onRetry={retry} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  name: { flex: 1 },
});
