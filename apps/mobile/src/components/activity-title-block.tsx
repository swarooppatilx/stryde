import { Input } from '@ant-design/react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { ActivityWeather } from '@/components/activity-weather';
import { ChainSyncRetry } from '@/components/chain-sync-retry';
import { IconBadge } from '@/components/icon-badge';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSportIcon } from '@/constants/activity';
import { Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { useChainRetry } from '@/hooks/useChainRetry';
import { useGearStore } from '@/stores/gearStore';
import type { Activity } from '@/types';
import { formatTimeOfDay, formatWeekdayDay } from '@/utils/dates';
import { activityTitle } from '@/utils/format';

interface Props {
  activity: Activity;
  isOwner: boolean;
  isEditingName: boolean;
  editedName: string;
  onChangeName: (name: string) => void;
  onSaveName: () => void;
  onStartEditName: () => void;
}

/** "Mon 3 Nov at 7:02 · Pegasus 41 · Apple Watch": when, with which shoes, and the watch it was recorded with. */
function headerLine(when: string, gearName: string | undefined, withWatch: boolean | undefined) {
  return [when, gearName, withWatch ? 'Apple Watch' : undefined].filter(Boolean).join(' · ');
}

/** Sport badge, the name (editable by its owner), when and with what gear it happened. */
export function ActivityTitleBlock({
  activity,
  isOwner,
  isEditingName,
  editedName,
  onChangeName,
  onSaveName,
  onStartEditName,
}: Props) {
  const theme = useTheme();
  const gearName = useGearStore((s) => s.gear.find((g) => g.id === activity.gearId)?.name);
  const chainRetry = useChainRetry(activity.id);
  // A saved run may be named long after it ended; the first GPS fix is when it began.
  const date = new Date(activity.stream?.startedAt ?? activity.createdAt);

  return (
    <ThemedView style={styles.header}>
      <ThemedView style={styles.headerLeft}>
        <IconBadge size="md" backgroundColor={theme.brand.primaryTint}>
          <Ionicons
            name={getSportIcon(activity.activityType)}
            size={20}
            color={theme.brand.primary}
          />
        </IconBadge>
        <ThemedView style={styles.headerText}>
          {isEditingName ? (
            <Input
              value={editedName}
              onChangeText={onChangeName}
              onBlur={onSaveName}
              onSubmitEditing={onSaveName}
              autoFocus
              selectTextOnFocus
              inputStyle={styles.nameInput}
            />
          ) : (
            <Tappable
              onPress={onStartEditName}
              disabled={!isOwner}
              activeOpacity={0.7}
              // The name row renders 20dp tall; +14 top/bottom reaches the 48dp floor.
              hitSlop={{ top: 14, bottom: 14, left: 12, right: 40 }}
              accessibilityRole={isOwner ? 'button' : 'header'}
              accessibilityLabel={
                isOwner ? `${activityTitle(activity)}. Edit the name` : activityTitle(activity)
              }
            >
              <ThemedText type="headline">{activityTitle(activity)}</ThemedText>
            </Tappable>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            {headerLine(
              `${formatWeekdayDay(date)} at ${formatTimeOfDay(date)}`,
              gearName,
              activity.recordedWithWatch
            )}
          </ThemedText>
          <ActivityWeather polyline={activity.polyline} startedAt={date} />
          {isOwner && chainRetry.canRetry && (
            <ChainSyncRetry busy={chainRetry.busy} onRetry={chainRetry.retry} />
          )}
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerText: { flex: 1 },
  nameInput: {
    ...textStyle(TypeScale.sectionTitle),
    borderBottomWidth: 1,
    paddingBottom: Spacing.half,
  },
});
