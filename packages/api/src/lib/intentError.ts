export type IntentErrorStatus = 400 | 401 | 403 | 429;

/** Every code a signed-intent service can fail with; each service uses a subset. */
export type IntentErrorCode =
  | 'invalid'
  | 'expired'
  | 'bad_signature'
  | 'forbidden'
  | 'rate_limited'
  | 'self_follow'
  | 'self_report';

const STATUS_BY_CODE: Record<IntentErrorCode, IntentErrorStatus> = {
  invalid: 400,
  expired: 400,
  self_follow: 400,
  self_report: 400,
  bad_signature: 401,
  forbidden: 403,
  rate_limited: 429,
};

/** Base of the follow, like, post, about and report errors: a code the app reads and the HTTP status it maps to. */
export class IntentError<Code extends IntentErrorCode = IntentErrorCode> extends Error {
  readonly status: IntentErrorStatus;

  constructor(
    readonly code: Code,
    message: string
  ) {
    super(message);
    this.name = 'IntentError';
    this.status = STATUS_BY_CODE[code];
  }
}
