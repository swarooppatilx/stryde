import { describe, expect, it, vi } from 'vitest';
import { RejectedError } from '@/backends/outbox/outbox';
import { createReportHandler, type ReportIntent } from '@/services/reportIntents';

const wallet = {} as never;
const payload: ReportIntent = {
  targetKind: 'comment',
  targetId: 'c1',
  reason: 'abusive',
  note: '',
};
const apiError = (status: number) => Object.assign(new Error('nope'), { status });

describe('createReportHandler', () => {
  it('sends the report as it was filed', async () => {
    const send = vi.fn(async () => ({}));

    await createReportHandler({ wallet: () => wallet, send })(payload);

    expect(send).toHaveBeenCalledWith(wallet, payload);
  });

  it('waits and tries again when there is no wallet yet', async () => {
    const send = vi.fn();

    await expect(
      createReportHandler({ wallet: () => null, send })(payload)
    ).rejects.not.toBeInstanceOf(RejectedError);
    expect(send).not.toHaveBeenCalled();
  });

  it('gives up for good when the server refuses it', async () => {
    const send = vi.fn().mockRejectedValue(apiError(400));

    await expect(
      createReportHandler({ wallet: () => wallet, send })(payload)
    ).rejects.toBeInstanceOf(RejectedError);
  });

  it('tries again later when the server is down or the phone is offline', async () => {
    for (const failure of [apiError(503), new TypeError('Network request failed')]) {
      const send = vi.fn().mockRejectedValue(failure);

      await expect(
        createReportHandler({ wallet: () => wallet, send })(payload)
      ).rejects.not.toBeInstanceOf(RejectedError);
    }
  });
});
