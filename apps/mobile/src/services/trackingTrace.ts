import { lazyService } from '@/platform';
import { logger } from '@/utils/logger';
import { createTrackingTrace, type TrackingTrace } from '@/utils/trackingTrace';

/** On in development builds; a release build opts in with EXPO_PUBLIC_TRACKING_TRACE=1. */
const TRACE_ENABLED =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_TRACKING_TRACE === '1';

/** The app-wide tracking trace, written to the app's documents under tracking-traces/. */
export const trackingTrace: TrackingTrace = lazyService(({ files, clock }) =>
  createTrackingTrace({
    store: {
      append: (path, content) => files.appendDocument(path, content),
      list: (folder) => files.listDocuments(folder),
      remove: (uri) => files.remove(uri),
    },
    now: () => clock.now(),
    enabled: TRACE_ENABLED,
    onError: (error) =>
      logger.warn('[TrackingTrace] Writing the trace failed; tracing stopped', error),
  })
);
