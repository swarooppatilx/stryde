import { useBlockStore } from '@/stores/blockStore';
import type { ReportedHidden } from '@/utils/reporting';

/** The activities and comments the athlete reported; stable until one is added or the list is wiped. */
export function useReportedHidden(): ReportedHidden {
  return useBlockStore((s) => s.reportedHidden);
}
