import { useRouter } from 'expo-router';
import { AnalysisCard } from '@/components/activity-detail/analysis-card';
import { HeartRateZones } from '@/components/heart-rate-zones';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Zones = Parameters<typeof HeartRateZones>[0]['zones'];

interface Props {
  zones: Zones;
  maxHr: number | null | undefined;
  restingHr: number | null | undefined;
  hasHeartRate: boolean;
  isOwner: boolean;
}

/** Zone breakdown when a max heart rate is known; otherwise the owner is pointed at where to set one. */
export function ActivityHeartRateSection({
  zones,
  maxHr,
  restingHr,
  hasHeartRate,
  isOwner,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  if (maxHr) {
    return zones.length > 0 ? (
      <AnalysisCard title="Heart rate zones">
        <HeartRateZones zones={zones} maxHr={maxHr} restingHr={restingHr ?? undefined} />
      </AnalysisCard>
    ) : null;
  }
  if (!isOwner || !hasHeartRate) return null;
  return (
    <Tappable
      onPress={() => router.push('/body')}
      accessibilityRole="link"
      accessibilityLabel="Add your birthday or max heart rate on the Body screen to see heart-rate zones"
      hitSlop={8}
    >
      <ThemedText type="small" style={{ color: theme.accentText }}>
        Add your birthday or max heart rate to see heart-rate zones
      </ThemedText>
    </Tappable>
  );
}
