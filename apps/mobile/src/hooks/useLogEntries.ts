import { useSyncExternalStore } from 'react';
import type { LogEntry } from '@/utils/logBuffer';
import { logBuffer } from '@/utils/logger';

export function useLogEntries(): readonly LogEntry[] {
  return useSyncExternalStore(logBuffer.subscribe, logBuffer.entries);
}
