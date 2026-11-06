import type { ZoneTime } from '@/utils/heartRateZones';
import { ZoneBars } from './zone-bars';

interface Props {
  zones: readonly ZoneTime[];
  maxHr: number;
  /** When known, zones are by heart-rate reserve and the note says so. */
  restingHr?: number;
}

/** Time spent in each heart-rate zone, as bars sized by share. */
export function HeartRateZones({ zones, maxHr, restingHr }: Props) {
  const note = restingHr
    ? `Zones use your resting rate of ${restingHr} and a maximum of ${maxHr} bpm.`
    : `Zones use a maximum of ${maxHr} bpm.`;
  return <ZoneBars zones={zones} note={note} />;
}
