import { useSyncExternalStore } from 'react';
import { type SensorHubSnapshot, sensorHub } from '@/services/sensorHub';

const subscribe = (onChange: () => void) => sensorHub.subscribe(onChange);
const getSnapshot = (): SensorHubSnapshot => sensorHub.getSnapshot();

/** Which sensors are connected and their latest readings; updates on each reading. */
export function useSensorHub(): SensorHubSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
