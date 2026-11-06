import { AnalysisCard } from '@/components/activity-detail/analysis-card';
import { ZoneBars } from '@/components/zone-bars';
import { formatPace, type UnitSystem } from '@/utils/format';
import type { ZoneTime } from '@/utils/heartRateZones';

interface Props {
  zones: readonly ZoneTime[];
  /** Metres per second. */
  threshold: number;
  unitSystem: UnitSystem;
}

/** Time in each pace zone, measured against the athlete's own recent threshold pace; hidden without data. */
export function ActivityPaceZonesSection({ zones, threshold, unitSystem }: Props) {
  if (zones.length === 0) return null;
  const pace = formatPace(threshold, 1000, unitSystem);
  return (
    <AnalysisCard title="Pace zones">
      <ZoneBars
        zones={zones}
        note={`Zones use a threshold pace of ${pace}, from your recent best efforts.`}
      />
    </AnalysisCard>
  );
}
