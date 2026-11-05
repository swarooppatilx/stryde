import { describe, expect, it } from 'vitest';
import { ReportSchema, reportAttributes, reportFromEntity } from '../arkivReportStore.js';

const ME = '0xA9e9Bcaa4Fb2BD6C3C770e88eCB085f2E92B10cb';
const record = {
  reporter: ME.toLowerCase() as `0x${string}`,
  targetKind: 'comment' as const,
  targetId: '0xc0ffee',
  reason: 'abusive' as const,
  createdAt: 1_700_000_000,
};

describe('reportAttributes', () => {
  it('is its own named schema, so only reports are matched', () => {
    expect(ReportSchema.name).toBe('report');
  });

  it('stores who reported what, why and when', () => {
    const attributes = reportAttributes(record);

    expect(attributes.kind).toMatchObject({ type: 'str', value: 'comment' });
    expect(attributes.target).toMatchObject({ type: 'str', value: '0xc0ffee' });
    expect(attributes.reason).toMatchObject({ type: 'str', value: 'abusive' });
    expect(attributes.created_at).toMatchObject({ type: 'u64', value: 1_700_000_000n });
    expect(attributes.reporter).toMatchObject({ type: 'addr' });
  });

  it('stores the same reporter whatever letter case the wallet arrives in', () => {
    expect(reportAttributes({ ...record, reporter: ME as `0x${string}` })).toEqual(
      reportAttributes(record)
    );
  });

  it('keeps the free-text note out of the searchable attributes', () => {
    expect(Object.keys(reportAttributes(record))).not.toContain('note');
  });
});

describe('reportFromEntity', () => {
  const entity = {
    key: '0xkey',
    attributes: {
      reporter: { type: 'addr', value: ME },
      kind: { type: 'str', value: 'user' },
      target: { type: 'str', value: '0xabc' },
      reason: { type: 'str', value: 'spam' },
      created_at: { type: 'u64', value: 1_700_000_000n },
    },
  };

  it('reads the report back, reporter in lowercase', () => {
    expect(reportFromEntity(entity)).toEqual({
      entityKey: '0xkey',
      reporter: ME.toLowerCase(),
      targetKind: 'user',
      targetId: '0xabc',
      reason: 'spam',
      createdAt: 1_700_000_000,
    });
  });

  it('skips an entity with an unknown kind or reason', () => {
    expect(
      reportFromEntity({
        ...entity,
        attributes: { ...entity.attributes, kind: { type: 'str', value: 'club' } },
      })
    ).toBeNull();
    expect(
      reportFromEntity({
        ...entity,
        attributes: { ...entity.attributes, reason: { type: 'str', value: 'boring' } },
      })
    ).toBeNull();
  });

  it('skips an entity whose reporter is not a wallet or whose target is missing', () => {
    expect(
      reportFromEntity({
        ...entity,
        attributes: { ...entity.attributes, reporter: { type: 'str', value: 'bob' } },
      })
    ).toBeNull();
    const { target: _t, ...rest } = entity.attributes;
    expect(reportFromEntity({ key: '0xkey', attributes: rest })).toBeNull();
  });
});
