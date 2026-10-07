import { useEffect, useRef, useState } from 'react';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { retryDeliveries, useOutboxEntries } from '@/hooks/useOutbox';
import { baselineSeen, planOutboxToasts, type SeenMap } from '@/utils/outboxToastPlan';
import { Toast } from '@/utils/toast';

/** Mount once: one status toast per change the athlete queued, from sending to done. Changes already queued at launch stay quiet until they change. */
export function useOutboxToasts(): void {
  const entries = useOutboxEntries();
  const seen = useRef<SeenMap | null>(null);
  const clears = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stopped = false;
    const outbox = getOutbox();
    void outbox.hydrate().then(() => {
      if (stopped) return;
      seen.current = baselineSeen(outbox.entries());
      clears.current = outbox.clearCount();
      setReady(true);
    });
    return () => {
      stopped = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || seen.current === null) return;
    const outbox = getOutbox();
    const cleared = outbox.clearCount() !== clears.current;
    clears.current = outbox.clearCount();
    const plan = planOutboxToasts(
      seen.current,
      entries,
      (key) => outbox.consumeRejection(key),
      cleared
    );
    seen.current = plan.seen;
    for (const { key, toast } of plan.commands) {
      if (toast === null) {
        Toast.removeStage(`outbox:${key}`);
        continue;
      }
      Toast.stage(`outbox:${key}`, toast.content, toast.kind, toast.duration, {
        onPress: toast.retry ? () => void retryDeliveries([key]) : undefined,
      });
    }
  }, [entries, ready]);
}
