import { useCallback, useState } from 'react';
import { getOutbox } from '@/backends/outbox/appOutbox';
import { SEND_REPORT } from '@/services/reportIntents';
import { useBlockStore } from '@/stores/blockStore';
import {
  type ReportReason,
  type ReportTarget,
  reportKey,
  reportNoteProblem,
} from '@/utils/reporting';
import { Toast } from '@/utils/toast';

/** Files a report through the outbox and hides the reported item at once. */
async function fileReport(target: ReportTarget, reason: ReportReason, note: string): Promise<void> {
  const outbox = getOutbox();
  await outbox.enqueue({
    kind: SEND_REPORT,
    key: reportKey(target),
    payload: { targetKind: target.kind, targetId: target.id, reason, note: note.trim() },
  });
  useBlockStore.getState().hideReported(target);
  Toast.success('Thanks, we will take a look');
  void outbox.drain();
}

/** What a screen needs to offer reporting: `ask` opens the sheet for a target, `props` feed the sheet. */
export function useReportSheet() {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const close = useCallback(() => setTarget(null), []);
  const submit = useCallback(
    async (reason: ReportReason, note: string) => {
      if (!target || reportNoteProblem(note)) return;
      close();
      await fileReport(target, reason, note);
    },
    [target, close]
  );
  return { ask: setTarget, props: { target, onClose: close, onSubmit: submit } };
}
