/** Env vars whose values must never reach the logs (an RPC URL usually embeds an API key). */
const SECRET_NAME = /(KEY|SECRET|TOKEN|PASSWORD|RPC_URL|PRIVATE)/i;
/** Shorter values would redact ordinary words. */
const MIN_SECRET_LENGTH = 8;

function secretValues(env: NodeJS.ProcessEnv): string[] {
  return Object.entries(env)
    .filter(([name, value]) => SECRET_NAME.test(name) && (value?.length ?? 0) >= MIN_SECRET_LENGTH)
    .map(([, value]) => value as string)
    .sort((a, b) => b.length - a.length);
}

/** Replaces every configured secret in `text`, including the URL form viem prints in errors. */
export function redact(text: string, env: NodeJS.ProcessEnv = process.env): string {
  let result = text;
  for (const secret of secretValues(env)) result = result.split(secret).join('[redacted]');
  return result;
}

/** Something readable for whatever was thrown: the stack of an Error, JSON for an object (not "[object Object]"), else its text. */
function describe(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  if (typeof error === 'object' && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Logs an error with its stack, minus any configured secret: viem and fetch errors
 * embed the request URL, which for the RPC carries the provider's API key.
 */
export function logError(label: string, error: unknown): void {
  console.error(label, redact(describe(error)));
}
