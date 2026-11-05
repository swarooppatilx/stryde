import type { Address } from './address.js';
import { IntentError } from './intentError.js';
import { createSerialQueue } from './serialQueue.js';
import { createIntentGuards, unixNow } from './signedIntent.js';
import { ONE_LINE_CONTROL_CHARACTERS } from './textRules.js';

export type ReportErrorCode =
  | 'invalid'
  | 'expired'
  | 'bad_signature'
  | 'self_report'
  | 'rate_limited';

export class ReportError extends IntentError<ReportErrorCode> {
  constructor(code: ReportErrorCode, message: string) {
    super(code, message);
    this.name = 'ReportError';
  }
}

const guard = createIntentGuards((code, message) => new ReportError(code, message));

export const REPORT_TARGET_KINDS = ['user', 'activity', 'comment'] as const;
export type ReportTargetKind = (typeof REPORT_TARGET_KINDS)[number];

export const REPORT_REASONS = [
  'spam',
  'abusive',
  'inappropriate',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const MAX_REPORT_NOTE_LENGTH = 200;

export interface ReportIntent {
  reporter: Address;
  targetKind: ReportTargetKind;
  /** A wallet for a user; the item's id for an activity or comment. */
  targetId: string;
  reason: ReportReason;
  /** Trimmed; empty when the reporter added nothing. */
  note: string;
  deadline: number;
}

export interface ReportRecord {
  entityKey: string;
  reporter: Address;
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  /** Unix seconds. */
  createdAt: number;
}

export interface ReportStore {
  /** This reporter's earlier report of the same target, if any. */
  find(
    reporter: Address,
    targetKind: ReportTargetKind,
    targetId: string
  ): Promise<ReportRecord | null>;
  create(input: {
    reporter: Address;
    targetKind: ReportTargetKind;
    targetId: string;
    reason: ReportReason;
    note: string;
    signature: string;
    deadline: number;
    createdAt: number;
  }): Promise<ReportRecord>;
  /** How many reports this person filed since `since` (unix seconds). */
  countSince(reporter: Address, since: number): Promise<number>;
}

export interface ReportServiceDeps {
  store: ReportStore;
  verify(intent: ReportIntent, signature: string): Promise<boolean>;
  now?: () => number;
}

/** Each report is a write the server pays for, so one person cannot file without bound. */
export const MAX_REPORTS_PER_DAY = 30;
const DAY_SECONDS = 86_400;
const TARGET_ID_PATTERN = /^[A-Za-z0-9_:.-]{1,100}$/;

function parseIntent(raw: unknown): ReportIntent {
  const input = guard.record(raw);
  const targetKind = REPORT_TARGET_KINDS.find((kind) => kind === input.targetKind);
  if (!targetKind) throw new ReportError('invalid', 'targetKind must be user, activity or comment');
  const reason = REPORT_REASONS.find((r) => r === input.reason);
  if (!reason) throw new ReportError('invalid', 'reason is not one we recognise');
  const deadline = guard.deadline(input.deadline);
  const rawTargetId = guard.string(input.targetId, 'targetId');
  const targetId = targetKind === 'user' ? guard.address(rawTargetId, 'targetId') : rawTargetId;
  if (!TARGET_ID_PATTERN.test(targetId)) {
    throw new ReportError('invalid', 'targetId must be 1 to 100 letters, digits or - _ : .');
  }
  const note = guard.text(
    input.note === undefined ? '' : input.note,
    'note',
    MAX_REPORT_NOTE_LENGTH,
    ONE_LINE_CONTROL_CHARACTERS
  );
  return {
    reporter: guard.address(input.reporter, 'reporter'),
    targetKind,
    targetId,
    reason,
    note,
    deadline,
  };
}

export function createReportService({ store, verify, now = unixNow }: ReportServiceDeps) {
  const serialize = createSerialQueue();

  return {
    async apply(request: { intent: unknown; signature: string }) {
      const intent = parseIntent(request.intent);
      guard.requireSignature(request.signature);
      if (intent.targetKind === 'user' && intent.targetId === intent.reporter) {
        throw new ReportError('self_report', 'You cannot report yourself');
      }
      const current = now();
      guard.requireLiveDeadline(intent.deadline, current);
      await guard.requireValidSignature(verify, intent, request.signature, 'reporter');

      return serialize(async () => {
        // One report per person and target: repeating it (a retry, a second tap) adds nothing.
        const existing = await store.find(intent.reporter, intent.targetKind, intent.targetId);
        if (existing) return { reported: true, created: false };
        if (
          (await store.countSince(intent.reporter, current - DAY_SECONDS)) >= MAX_REPORTS_PER_DAY
        ) {
          throw new ReportError(
            'rate_limited',
            'You have sent a lot of reports today; try again tomorrow'
          );
        }
        await store.create({
          reporter: intent.reporter,
          targetKind: intent.targetKind,
          targetId: intent.targetId,
          reason: intent.reason,
          note: intent.note,
          signature: request.signature,
          deadline: intent.deadline,
          createdAt: current,
        });
        return { reported: true, created: true };
      });
    },
  };
}
