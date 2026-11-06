import { describe, expect, it } from 'vitest';
import { CoachRequestLog } from '../coachRequests.js';
import type { ZeroGReceipt } from '../zeroG.js';

const receipt = (over: Partial<ZeroGReceipt> = {}): ZeroGReceipt => ({
  requestId: 'req_1',
  model: 'glm-5.3',
  costUsdMicro: 900,
  teeVerified: null,
  trustMode: 'verified',
  provider: '0xabc',
  ...over,
});

describe('CoachRequestLog', () => {
  it('records each call with its request id, model, TEE result and cost', () => {
    const log = new CoachRequestLog();
    log.record('0xAA', 'debrief', [
      receipt({
        requestId: 'stt',
        model: 'whisper-large-v3',
        teeVerified: true,
        costUsdMicro: 300,
      }),
      receipt({ requestId: 'note' }),
    ]);
    expect(log.list('0xaa')).toEqual([
      {
        at: expect.any(Number),
        kind: 'debrief',
        calls: [
          {
            requestId: 'stt',
            model: 'whisper-large-v3',
            teeVerified: true,
            trustMode: 'verified',
            costUsdMicro: 300,
          },
          {
            requestId: 'note',
            model: 'glm-5.3',
            teeVerified: null,
            trustMode: 'verified',
            costUsdMicro: 900,
          },
        ],
        costUsdMicro: 1200,
        adjusted: false,
      },
    ]);
  });

  it('keeps wallets apart, whatever the address casing', () => {
    const log = new CoachRequestLog();
    log.record('0xAAA', 'plan', [receipt({ requestId: 'a' })]);
    log.record('0xBBB', 'plan', [receipt({ requestId: 'b' })]);
    expect(log.list('0xaaa').map((e) => e.calls[0]?.requestId)).toEqual(['a']);
    expect(log.list('0xBBB').map((e) => e.calls[0]?.requestId)).toEqual(['b']);
    expect(log.list('0xCCC')).toEqual([]);
  });

  it('lists newest first and keeps the latest 50', () => {
    const log = new CoachRequestLog();
    for (let i = 0; i < 60; i++) {
      log.record('0xaa', 'review', [receipt({ requestId: `r${i}` })], { now: i });
    }
    const list = log.list('0xaa');
    expect(list).toHaveLength(50);
    expect(list[0]?.calls[0]?.requestId).toBe('r59');
    expect(list.at(-1)?.calls[0]?.requestId).toBe('r10');
  });

  it('marks an adjusted plan, and has a null cost when no call reported one', () => {
    const log = new CoachRequestLog();
    log.record('0xaa', 'plan', [receipt({ costUsdMicro: null })], { adjusted: true });
    expect(log.list('0xaa')[0]).toMatchObject({ adjusted: true, costUsdMicro: null });
  });

  it('records nothing for no receipts', () => {
    const log = new CoachRequestLog();
    log.record('0xaa', 'plan', []);
    expect(log.list('0xaa')).toEqual([]);
  });

  it('returns a copy, so a caller cannot edit the log', () => {
    const log = new CoachRequestLog();
    log.record('0xaa', 'plan', [receipt()]);
    log.list('0xaa').length = 0;
    expect(log.list('0xaa')).toHaveLength(1);
  });
});
