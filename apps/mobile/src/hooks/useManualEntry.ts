import { useState } from 'react';
import type { ActivityType } from '@/types';
import { metersPerDistanceUnit } from '@/utils/distanceUnits';
import type { UnitSystem } from '@/utils/format';
import { validateManualEntry } from '@/utils/manualActivity';

/** The typed-in numbers and day for an activity that was not recorded, checked as they change. */
export function useManualEntry(activityType: ActivityType, unitSystem: UnitSystem) {
  const [distanceInput, setDistanceInput] = useState('');
  const [minutesInput, setMinutesInput] = useState('');
  const [day, setDay] = useState(() => new Date());
  const entry = validateManualEntry({
    sport: activityType,
    distanceInput,
    minutesInput,
    metersPerUnit: metersPerDistanceUnit(unitSystem),
  });
  return {
    distanceInput,
    setDistanceInput,
    minutesInput,
    setMinutesInput,
    day,
    setDay,
    entry,
    startInFuture: day.getTime() > Date.now(),
    typedSomething: distanceInput.trim() !== '' || minutesInput.trim() !== '',
    distance: entry.ok ? entry.distance : 0,
    duration: entry.ok ? entry.duration : 0,
  };
}

export type ManualEntry = ReturnType<typeof useManualEntry>;
