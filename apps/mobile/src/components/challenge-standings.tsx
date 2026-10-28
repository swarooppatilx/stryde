import { StyleSheet, View } from 'react-native';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDistance, type UnitSystem } from '@/utils/format';
import { progressFraction } from '@/utils/progress';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface Side {
  name: string;
  distance: number;
  isMe: boolean;
}

interface Props {
  challenger: Side;
  opponent: Side;
  /** The distance the challenge is about, in meters; the bars fill toward the larger of this and either side. */
  target: number;
  unitSystem: UnitSystem;
}

function Row({ side, scale, unitSystem }: { side: Side; scale: number; unitSystem: UnitSystem }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <ThemedText type="smallBold" numberOfLines={1} style={styles.name}>
          {side.isMe ? 'You' : side.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDistance(side.distance, unitSystem)}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${progressFraction(side.distance, scale) * 100}%`,
              backgroundColor: side.isMe ? theme.brand.primary : theme.textSecondary,
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Who is ahead right now, as two bars on one shared scale. */
export function ChallengeStandings({ challenger, opponent, target, unitSystem }: Props) {
  const theme = useTheme();
  const scale = Math.max(target, challenger.distance, opponent.distance);
  return (
    <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="sectionTitle">Standings</ThemedText>
      <Row side={challenger} scale={scale} unitSystem={unitSystem} />
      <Row side={opponent} scale={scale} unitSystem={unitSystem} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.md, padding: Spacing.three, gap: Spacing.three },
  row: { gap: Spacing.one + 2 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  name: { flex: 1 },
  track: { height: 8, borderRadius: BorderRadius.full, overflow: 'hidden' },
  fill: { height: 8, borderRadius: BorderRadius.full },
});
