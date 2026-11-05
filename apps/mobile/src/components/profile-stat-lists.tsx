import { List } from '@ant-design/react-native';
import type { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { SPORT_ICONS } from '@/constants/activity';
import { Spacing } from '@/constants/theme';
import { TypeScale, textStyle } from '@/constants/typography';
import { useTheme } from '@/hooks/use-theme';
import { effortLabel } from '@/utils/effortLabel';
import {
  formatArea,
  formatDistance,
  formatDuration,
  formatPace,
  type SportStats,
  type UnitSystem,
} from '@/utils/format';
import { countOf } from '@/utils/plural';
import type { PersonalRecords } from '@/utils/profile';
import { ListIcon } from './list-icon';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Props {
  records: PersonalRecords;
  sportStats: readonly SportStats[];
  unitSystem: UnitSystem;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactElement | React.ReactElement[];
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="eyebrow" style={[styles.title, { color: theme.textSecondary }]}>
        {title}
      </ThemedText>
      <List>{children}</List>
    </ThemedView>
  );
}

function Value({ main, sub }: { main: string; sub?: string }) {
  return (
    <ThemedView style={styles.value}>
      <ThemedText type="small" style={styles.main}>
        {main}
      </ThemedText>
      {sub ? (
        <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
          {sub}
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

/** The profile's "More" tab lists: personal records, distance by sport, and totals. */
export function ProfileStatLists({ records, sportStats, unitSystem }: Props) {
  const recordRows: Array<{
    key: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
  }> = [];
  if (records.longestDistance) {
    recordRows.push({
      key: 'longest-distance',
      icon: 'resize-outline',
      label: 'Longest Distance',
      value: formatDistance(records.longestDistance.distance, unitSystem),
    });
  }
  for (const effort of records.bestEfforts) {
    recordRows.push({
      key: `best-${effort.distance}`,
      icon: 'stopwatch-outline',
      label: `Fastest ${effortLabel(effort.distance)}`,
      value: `${formatDuration(effort.movingTime)} · ${formatPace(effort.distance, effort.movingTime, unitSystem)}`,
    });
  }
  if (records.fastestPace) {
    recordRows.push({
      key: 'fastest-pace',
      icon: 'speedometer-outline',
      label: 'Fastest Pace',
      value: formatPace(records.fastestPace.distance, records.fastestPace.duration, unitSystem),
    });
  }
  if (records.largestTerritory && records.largestTerritory.territoryArea > 0) {
    recordRows.push({
      key: 'largest-territory',
      icon: 'map-outline',
      label: 'Largest Territory',
      value: formatArea(records.largestTerritory.territoryArea, unitSystem),
    });
  }

  return (
    <>
      {recordRows.length > 0 && (
        <Section title="Personal Records">
          {recordRows.map((row) => (
            <List.Item
              key={row.key}
              thumb={<ListIcon name={row.icon} />}
              extra={
                <View style={styles.record}>
                  <ThemedText style={styles.recordValue}>{row.value}</ThemedText>
                </View>
              }
            >
              {row.label}
            </List.Item>
          ))}
        </Section>
      )}

      {sportStats.length > 0 && (
        <Section title="By Sport">
          {sportStats.map((stat) => (
            <List.Item
              key={stat.type}
              thumb={<ListIcon name={SPORT_ICONS[stat.type] || 'walk-outline'} />}
              extra={
                <Value
                  main={formatDistance(stat.totalDistance, unitSystem)}
                  sub={countOf(stat.count, 'activity', 'activities')}
                />
              }
            >
              {stat.type.charAt(0).toUpperCase() + stat.type.slice(1)}
            </List.Item>
          ))}
        </Section>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  title: { marginBottom: Spacing.one },
  record: { alignItems: 'flex-end' },
  recordValue: textStyle(TypeScale.calloutBold),
  value: { alignItems: 'flex-end', gap: Spacing.half },
  main: { fontWeight: '600' },
});
