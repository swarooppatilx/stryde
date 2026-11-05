import { services } from '@repo/shared';
import { getPlatform } from '@/platform';
import { createEventLog } from '@/utils/eventLog';
import { type IndexReader, pollUntilIndexed } from '@/utils/indexPoll';
import { createTimeToIndexed } from '@/utils/timeToIndexed';

/** Reads the search index (the subgraph): null when this network has none. */
const subgraphReader: IndexReader = {
  async isVisible(activityHash, owner) {
    const found = await services.subgraph.getActivitiesFromSubgraph(
      owner as `0x${string}`,
      activityHash
    );
    if (found === null) return null;
    const wanted = activityHash.toLowerCase();
    return found.some((a) => a.activityHash.toLowerCase() === wanted);
  },
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done);
  });

let instance: ReturnType<typeof build> | null = null;

function build() {
  const { clock, connectivity } = getPlatform();
  const log = createEventLog(clock);
  const deps = { reader: subgraphReader, clock, sleep, isOnline: () => connectivity.isOnline() };
  const tracker = createTimeToIndexed({
    clock,
    log,
    poll: (hash, owner, signal) => pollUntilIndexed(hash, owner, signal, deps),
  });
  return { log, tracker };
}

/** The one in-memory event log and save-to-search timer of this run. */
export const getTimeToIndexed = () => {
  instance ??= build();
  return instance;
};
