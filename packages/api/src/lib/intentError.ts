import type { Context } from 'hono';

export type IntentErrorStatus = 400 | 401 | 403 | 404 | 429;

/** Every code a signed-intent service can fail with; each service uses a subset. */
export type IntentErrorCode =
  | 'invalid'
  | 'expired'
  | 'bad_signature'
  | 'forbidden'
  | 'not_found'
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
  not_found: 404,
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

/**
 * Runs a signed-intent service call and answers with its JSON; an `IntentError` becomes its own
 * status with `{error, code}` for the app to read, and anything else is left for the app-wide handler.
 */
export async function respondIntent(c: Context, run: () => Promise<unknown>) {
  try {
    return c.json(await run());
  } catch (error) {
    if (!(error instanceof IntentError)) throw error;
    return c.json({ error: error.message, code: error.code }, error.status);
  }
}
