import { describe, expect, it, vi } from 'vitest';
import {
  createReportService,
  MAX_REPORTS_PER_DAY,
  ReportError,
  type ReportRecord,
  type ReportStore,
} from '../reports.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const NOW = 1_000_000;
const SIGNATURE = '0xsigned' as const;

function memoryStore(): ReportStore & { records: ReportRecord[]; notes: string[] } {
  const records: ReportRecord[] = [];
  const notes: string[] = [];
  return {
    records,
    notes,
    async removeAllFor(reporter) {
      const gone = records.filter((r) => r.reporter === reporter);
      for (const record of gone) records.splice(records.indexOf(record), 1);
      return gone.length;
    },
    async find(reporter, targetKind, targetId) {
      return (
        records.find(
          (r) => r.reporter === reporter && r.targetKind === targetKind && r.targetId === targetId
        ) ?? null
      );
    },
    async create(input) {
      await Promise.resolve();
      const record = {
        entityKey: `key-${records.length + 1}`,
        reporter: input.reporter,
        targetKind: input.targetKind,
        targetId: input.targetId,
        reason: input.reason,
        createdAt: input.createdAt,
      };
      records.push(record);
      notes.push(input.note);
      return record;
    },
    async countSince(reporter, since) {
      return records.filter((r) => r.reporter === reporter && r.createdAt >= since).length;
    },
  };
}

function setup(verify: (...args: never[]) => Promise<boolean> = async () => true) {
  const store = memoryStore();
  const service = createReportService({ store, verify: verify as never, now: () => NOW });
  return { store, service };
}

const intent = (overrides: Record<string, unknown> = {}) => ({
  reporter: ME,
  targetKind: 'user' as const,
  targetId: THEM,
  reason: 'spam' as const,
  note: '',
  deadline: NOW + 60,
  ...overrides,
});

const code = async (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error) => (error instanceof ReportError ? error.code : 'other')
  );

describe('reporting', () => {
  it('records a report of a user once the signature checks out', async () => {
    const { service, store } = setup();

    const result = await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(result).toEqual({ reported: true, created: true });
    expect(store.records).toEqual([
      {
        entityKey: 'key-1',
        reporter: ME,
        targetKind: 'user',
        targetId: THEM,
        reason: 'spam',
        createdAt: NOW,
      },
    ]);
  });

  it.each([
    ['activity', 'act_123'],
    ['comment', '0x4d2f9c'],
  ] as const)('records a report of a %s by its id', async (targetKind, targetId) => {
    const { service, store } = setup();

    await service.apply({ intent: intent({ targetKind, targetId }), signature: SIGNATURE });

    expect(store.records[0]).toMatchObject({ targetKind, targetId });
  });

  it('keeps a trimmed note with the report', async () => {
    const { service, store } = setup();

    await service.apply({ intent: intent({ note: '  sells things  ' }), signature: SIGNATURE });

    expect(store.notes).toEqual(['sells things']);
  });

  it('treats a missing note as empty', async () => {
    const { service, store } = setup();
    const { note: _note, ...withoutNote } = intent();

    await service.apply({ intent: withoutNote, signature: SIGNATURE });

    expect(store.notes).toEqual(['']);
  });

  it('writes once when the same person reports the same target again, even with another reason', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    const again = await service.apply({
      intent: intent({ reason: 'abusive' }),
      signature: SIGNATURE,
    });

    expect(again).toEqual({ reported: true, created: false });
    expect(store.records).toHaveLength(1);
  });

  it('writes once when two identical requests arrive at the same moment', async () => {
    const { service, store } = setup();

    await Promise.all([
      service.apply({ intent: intent(), signature: SIGNATURE }),
      service.apply({ intent: intent(), signature: SIGNATURE }),
    ]);

    expect(store.records).toHaveLength(1);
  });

  it('treats the same wallet in a different letter case as the same person', async () => {
    const { service, store } = setup();
    await service.apply({ intent: intent(), signature: SIGNATURE });

    await service.apply({
      intent: intent({ reporter: ME.toUpperCase().replace('0X', '0x') }),
      signature: SIGNATURE,
    });

    expect(store.records).toHaveLength(1);
  });

  it('lets different people report the same target, and one person report different targets', async () => {
    const { service, store } = setup();

    await service.apply({ intent: intent(), signature: SIGNATURE });
    await service.apply({ intent: intent({ reporter: THEM, targetId: ME }), signature: SIGNATURE });
    await service.apply({
      intent: intent({ targetKind: 'comment', targetId: 'c1' }),
      signature: SIGNATURE,
    });

    expect(store.records).toHaveLength(3);
  });
});

describe('what is refused', () => {
  it('a signature that does not verify, without touching the store', async () => {
    const { service, store } = setup(async () => false);

    expect(await code(service.apply({ intent: intent(), signature: SIGNATURE }))).toBe(
      'bad_signature'
    );
    expect(store.records).toHaveLength(0);
  });

  it('an intent whose deadline has passed', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ deadline: NOW - 1 }), signature: SIGNATURE }))
    ).toBe('expired');
  });

  it('a deadline set far in the future', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ deadline: NOW + 3600 }), signature: SIGNATURE }))
    ).toBe('expired');
  });

  it('reporting yourself', async () => {
    const { service } = setup();

    expect(
      await code(service.apply({ intent: intent({ targetId: ME }), signature: SIGNATURE }))
    ).toBe('self_report');
  });

  it.each([
    ['an unknown target kind', { targetKind: 'club' }],
    ['an unknown reason', { reason: 'boring' }],
    ['a user target that is not a wallet', { targetId: 'bob' }],
    ['an empty activity id', { targetKind: 'activity', targetId: '' }],
    ['an over-long id', { targetKind: 'activity', targetId: 'a'.repeat(101) }],
    ['an id with odd characters', { targetKind: 'comment', targetId: 'a b/c' }],
    ['a note that is not text', { note: 5 }],
    ['a note over the limit', { note: 'x'.repeat(201) }],
    ['a note with a line break', { note: 'one\ntwo' }],
    ['a note with a control character', { note: 'bad\u0007' }],
    ['a non-numeric deadline', { deadline: 'soon' }],
    ['a malformed reporter', { reporter: 'me' }],
  ])('%s', async (_name, override) => {
    const { service } = setup();

    expect(await code(service.apply({ intent: intent(override), signature: SIGNATURE }))).toBe(
      'invalid'
    );
  });

  it('a missing intent or signature', async () => {
    const { service } = setup();

    expect(await code(service.apply({ intent: null, signature: SIGNATURE }))).toBe('invalid');
    expect(await code(service.apply({ intent: intent(), signature: '' as never }))).toBe('invalid');
  });

  it('passes exactly the signed fields to the signature check', async () => {
    const verify = vi.fn(async () => true);
    const { service } = setup(verify);

    await service.apply({ intent: intent(), signature: SIGNATURE });

    expect(verify).toHaveBeenCalledWith(intent(), SIGNATURE);
  });

  it('stops one person filing without bound in a day, but lets a repeat report through', async () => {
    const { service, store } = setup();
    for (let i = 0; i < MAX_REPORTS_PER_DAY; i++) {
      await service.apply({
        intent: intent({ targetKind: 'activity', targetId: `a${i}` }),
        signature: SIGNATURE,
      });
    }
    expect(
      await code(
        service.apply({
          intent: intent({ targetKind: 'activity', targetId: 'one-more' }),
          signature: SIGNATURE,
        })
      )
    ).toBe('rate_limited');
    expect(store.records).toHaveLength(MAX_REPORTS_PER_DAY);
    const again = await service.apply({
      intent: intent({ targetKind: 'activity', targetId: 'a0' }),
      signature: SIGNATURE,
    });
    expect(again).toEqual({ reported: true, created: false });
  });
});
