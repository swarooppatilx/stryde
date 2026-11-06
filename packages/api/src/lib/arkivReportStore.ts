import { eq, gte } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, str, u64 } from '@arkiv-network/sdk/schema';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type EntityLike,
  secondsAttribute,
  textAttribute,
  walletAttribute,
} from './arkivEntityStore.js';
import {
  REPORT_REASONS,
  REPORT_TARGET_KINDS,
  type ReportRecord,
  type ReportStore,
} from './reports.js';

export const ReportSchema = defineSchema('report', {
  reporter: addr().indexed(),
  kind: str().indexed(),
  target: str().indexed(),
  reason: str(),
  created_at: u64().indexed(),
  data: bytes(),
});
/** Enough to tell the daily cap has been reached without reading every report. */
const COUNT_LIMIT = 100;

export function reportAttributes(
  report: Pick<ReportRecord, 'reporter' | 'targetKind' | 'targetId' | 'reason' | 'createdAt'>
) {
  return {
    reporter: addr(report.reporter),
    kind: str(report.targetKind),
    target: str(report.targetId),
    reason: str(report.reason),
    created_at: u64(report.createdAt),
  };
}

export function reportFromEntity(entity: EntityLike): ReportRecord | null {
  const reporter = walletAttribute(entity, 'reporter');
  const targetKind = REPORT_TARGET_KINDS.find((kind) => kind === textAttribute(entity, 'kind'));
  const reason = REPORT_REASONS.find((r) => r === textAttribute(entity, 'reason'));
  const targetId = textAttribute(entity, 'target');
  if (!reporter || !targetKind || !reason || !targetId) return null;
  return {
    entityKey: entity.key,
    reporter,
    targetKind,
    targetId,
    reason,
    createdAt: secondsAttribute(entity, 'created_at'),
  };
}

/** Reports as Arkiv entities written by this server's signer; only that signer's entities count. */
export function createArkivReportStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): ReportStore {
  const entities = createEntityStore(publicClient, walletClient, ReportSchema);

  return {
    async find(reporter, targetKind, targetId) {
      const { entities: found } = await entities.query(
        [eq('reporter', addr(reporter)), eq('kind', str(targetKind)), eq('target', str(targetId))],
        1
      );
      for (const entity of found) {
        const record = reportFromEntity(entity);
        if (record) return record;
      }
      return null;
    },

    async create({ reporter, targetKind, targetId, reason, note, signature, deadline, createdAt }) {
      const entityKey = await entities.create(
        { note, signature, deadline },
        reportAttributes({ reporter, targetKind, targetId, reason, createdAt })
      );
      return { entityKey, reporter, targetKind, targetId, reason, createdAt };
    },

    removeAllFor: (reporter) => entities.removeAll([eq('reporter', addr(reporter))]),

    countSince: (reporter, since) =>
      entities.count([eq('reporter', addr(reporter)), gte('created_at', u64(since))], COUNT_LIMIT),
  };
}
