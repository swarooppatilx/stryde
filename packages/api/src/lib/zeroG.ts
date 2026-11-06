/**
 * 0G Private Computer: one OpenAI-compatible router for chat, image and speech models.
 * Every call keeps the request ID the router reports (`x_0g_trace.request_id`, else the last part
 * of `X-Request-Id`), which is what its usage history and billing use, and what proves the call ran.
 */

const DEFAULT_BASE_URL = 'https://router-api.0g.ai/v1';
const TIMEOUT_MS = 90_000;

export const CHAT_MODEL_FALLBACK = '0gm-1.0-35b-a3b';
/** TEE-attested on mainnet when 0G's own model is down. */
export const CHAT_MODEL_BACKUP = 'glm-5.3';

/**
 * The router's provider floor (`X-0G-Provider-Trust-Mode`): `verified` routes only to TeeML or TeeTLS
 * providers, `private` only to TeeML. The router answers 503 rather than fall back to a weaker
 * provider, so the floor is the guarantee shown to the athlete. `standard` has no TEE guarantee.
 */
export type TrustMode = 'standard' | 'verified' | 'private';
const TRUST_MODES: readonly TrustMode[] = ['standard', 'verified', 'private'];

export interface ZeroGReceipt {
  requestId: string | null;
  model: string;
  /** What the router charged, in micro-USD; null when it reported no USD figure. */
  costUsdMicro: number | null;
  /** true / false when the router checked the provider's TEE attestation, null when it did not say. */
  teeVerified: boolean | null;
  /** The provider floor this call was sent with; `standard` means no TEE guarantee. */
  trustMode: TrustMode | null;
  /** The provider that ran it, when the router said. */
  provider: string | null;
}

export class ZeroGError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly requestId: string | null
  ) {
    super(message);
    this.name = 'ZeroGError';
  }
}

export function zeroGConfigured(): boolean {
  return Boolean(process.env.ZEROG_API_KEY);
}

function baseUrl(): string {
  return (process.env.ZEROG_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function authKey(): string {
  const key = process.env.ZEROG_API_KEY;
  if (!key) throw new ZeroGError('0G is not configured', 503, 'not_configured', null);
  return key;
}

function defaultTrust(): TrustMode {
  return TRUST_MODES.find((t) => t === process.env.ZEROG_TRUST_MODE) ?? 'verified';
}

function verifyTee(): boolean {
  return process.env.ZEROG_VERIFY_TEE !== 'false';
}

function headersFor(trust: TrustMode | null, json = true): Record<string, string> {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    Authorization: `Bearer ${authKey()}`,
    ...(trust ? { 'X-0G-Provider-Trust-Mode': trust } : {}),
  };
}

// ---- Models: a list per capability, each optionally pinned to its own trust floor.

/** One model to try, and the trust floor to ask for when calling it. */
export interface ModelChoice {
  id: string;
  trust: TrustMode;
}

/**
 * `a,b@standard`: a comma list, each entry optionally pinned to its own trust floor. A model with no
 * TEE provider (say minimax-image-01) only answers under `standard`, so it has to say so itself.
 */
export function parseModels(spec: string, trust: TrustMode = defaultTrust()): ModelChoice[] {
  return spec
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id = '', pinned] = entry.split('@');
      return { id: id.trim(), trust: TRUST_MODES.find((t) => t === pinned) ?? trust };
    })
    .filter((choice) => choice.id);
}

let modelList: Promise<string[]> | null = null;

/** The router's model ids; listing models is free, so it is read once and kept. */
function listModels(): Promise<string[]> {
  modelList ??= fetch(`${baseUrl()}/models`, {
    headers: { Authorization: `Bearer ${authKey()}` },
    signal: AbortSignal.timeout(15_000),
  })
    .then(async (r) => (r.ok ? ((await r.json()) as { data?: { id: string }[] }) : {}))
    .then((body) => (body.data ?? []).map((m) => m.id))
    .catch(() => {
      modelList = null;
      return [];
    });
  return modelList;
}

async function discover(pattern: RegExp): Promise<string | undefined> {
  return (await listModels()).find((id) => pattern.test(id));
}

/** @internal for tests */
export function resetZeroGState(): void {
  cooldownUntil.clear();
  modelList = null;
}

export async function chatModels(): Promise<ModelChoice[]> {
  const pinned = process.env.ZEROG_CHAT_MODEL;
  if (pinned) return parseModels(pinned);
  const own = (await discover(/^0gm-1\.0/i)) ?? CHAT_MODEL_FALLBACK;
  return parseModels(`${own},${CHAT_MODEL_BACKUP}`);
}

/** Seedream first when the router lists it, then z-image-turbo, then a labelled non-TEE fallback. */
export async function imageModels(): Promise<ModelChoice[]> {
  const pinned = process.env.ZEROG_IMAGE_MODEL;
  if (pinned) return parseModels(pinned);
  const seedream = await discover(/seedream/i);
  return parseModels(
    [...(seedream ? [seedream] : []), 'z-image-turbo', 'minimax-image-01@standard'].join(',')
  );
}

export async function speechModels(): Promise<ModelChoice[]> {
  const pinned = process.env.ZEROG_STT_MODEL;
  if (pinned) return parseModels(pinned);
  return parseModels((await discover(/whisper-large-v3/i)) ?? 'whisper-large-v3');
}

// ---- Fallback across models. A model whose providers failed sits out for a minute, so the next
// call does not wait on it again.

export const COOLDOWN_MS = 60_000;
const cooldownUntil = new Map<string, number>();

/** The provider side failed (down, timed out, or none meets the trust floor): another model may answer. */
function isUpstreamFailure(error: unknown): boolean {
  return (
    error instanceof ZeroGError &&
    (error.status === 502 || error.status === 503 || error.status === 504)
  );
}

export async function withFallback<T>(
  models: ModelChoice[],
  run: (model: ModelChoice, lastChance: boolean) => Promise<T>,
  now: () => number = Date.now
): Promise<T> {
  if (!models.length) throw new ZeroGError('No 0G model is configured', 503, 'no_model', null);
  const ready = models.filter((m) => (cooldownUntil.get(m.id) ?? 0) <= now());
  // If every model is cooling down, try them all anyway rather than refuse outright.
  const order = ready.length ? ready : models;
  let lastError: unknown;
  for (const [i, model] of order.entries()) {
    try {
      const result = await run(model, i === order.length - 1);
      cooldownUntil.delete(model.id);
      return result;
    } catch (error) {
      if (!isUpstreamFailure(error)) throw error;
      cooldownUntil.set(model.id, now() + COOLDOWN_MS);
      lastError = error;
    }
  }
  throw lastError;
}

// ---- Requests, receipts and retries.

/** Pulls the router's proof out of a response: its trace if it sent one, else the request id header. */
function receiptFrom(
  response: Response,
  body: unknown,
  model: string,
  trust: TrustMode | null,
  fallbackTrace?: unknown
): ZeroGReceipt {
  const raw = ((body as { x_0g_trace?: unknown } | null)?.x_0g_trace ?? fallbackTrace) as
    | {
        request_id?: unknown;
        provider?: unknown;
        tee_verified?: unknown;
        billing?: { total_cost_usd_micro?: unknown; currency?: unknown; total_cost?: unknown };
      }
    | undefined;
  const header = response.headers.get('x-request-id')?.split(',').pop()?.trim();
  const billing = raw?.billing;
  const usd =
    billing?.total_cost_usd_micro ?? (billing?.currency === 'usd' ? billing.total_cost : null);
  const cost = usd === null || usd === undefined || usd === '' ? Number.NaN : Number(usd);
  return {
    requestId: (typeof raw?.request_id === 'string' && raw.request_id) || header || null,
    model,
    costUsdMicro: Number.isFinite(cost) ? cost : null,
    teeVerified: typeof raw?.tee_verified === 'boolean' ? raw.tee_verified : null,
    trustMode: trust,
    provider: typeof raw?.provider === 'string' ? raw.provider : null,
  };
}

/** Waits between attempts when the router or one of its providers stumbles. */
const RETRY_DELAYS_MS = [1_500, 4_000];

/** A provider hiccup (the router's 5xx, or its own rate limit) is worth another try; a 4xx about the request or a 402 for credit is not. */
function isTransient(error: unknown): boolean {
  return error instanceof ZeroGError && (error.status === 429 || error.status >= 500);
}

interface Sent<T> {
  body: T;
  receipt: ZeroGReceipt;
  response: Response;
}

/** One request. Dead sockets and timeouts become 502 / 504 errors, so they fall back like a provider failure. */
async function send<T>(path: string, init: RequestInit, model: ModelChoice): Promise<Sent<T>> {
  let response: Response;
  try {
    response = await fetch(path.startsWith('http') ? path : `${baseUrl()}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof ZeroGError) throw error;
    if ((error as Error).name === 'TimeoutError') {
      throw new ZeroGError('0G did not answer in time', 504, 'timeout', null);
    }
    throw new ZeroGError(
      `0G is unreachable: ${(error as Error).message}`,
      502,
      'unreachable',
      null
    );
  }
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const receipt = receiptFrom(response, body, model.id, model.trust);
  if (!response.ok) {
    const error = (body as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ZeroGError(
      error?.message || `0G request failed (${response.status})`,
      response.status,
      error?.code ?? null,
      receipt.requestId
    );
  }
  return { body: body as T, receipt, response };
}

/** Retries a provider stumble, but only on the last model to try: another model is a faster answer. */
async function sendWithRetry<T>(
  path: string,
  init: RequestInit,
  model: ModelChoice,
  lastChance: boolean,
  sleep: Sleep = realSleep
): Promise<Sent<T>> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send<T>(path, init, model);
    } catch (error) {
      const delay = lastChance ? RETRY_DELAYS_MS[attempt] : undefined;
      if (delay === undefined || !isTransient(error)) throw error;
      console.info(`[0g] ${path} attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
}

type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Chat.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Some chat templates leak the reasoning into `content`, ending it with `</think>`. The athlete only
 * ever sees what follows it.
 */
export function stripThinking(content: string): string {
  const end = content.lastIndexOf('</think>');
  return end === -1 ? content : content.slice(end + '</think>'.length).trimStart();
}

export async function chat(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; receipt: ZeroGReceipt }> {
  const models = await chatModels();
  return withFallback(models, async (model, lastChance) => {
    const { body, receipt } = await sendWithRetry<{
      choices?: { message?: { content?: string } }[];
      model?: string;
    }>(
      '/chat/completions',
      {
        method: 'POST',
        headers: headersFor(model.trust),
        body: JSON.stringify({
          model: model.id,
          messages,
          max_tokens: options.maxTokens ?? 600,
          temperature: options.temperature ?? 0.7,
          verify_tee: verifyTee(),
          // The router's models think by default and the thinking counts against max_tokens, so a
          // short budget can end with an empty answer. Checked live: on 0gm-1.0 `reasoning_effort:
          // 'low'` still used the whole budget thinking, while `enable_thinking: false` answers in a
          // few dozen tokens. Anything that still leaks is removed by stripThinking below.
          chat_template_kwargs: { enable_thinking: false },
        }),
      },
      model,
      lastChance
    );
    const text = stripThinking(body.choices?.[0]?.message?.content ?? '').trim();
    // A reasoning model can spend the whole token budget thinking and answer 200 with nothing:
    // that is a provider failure, so the next model gets the call.
    if (!text) {
      throw new ZeroGError('0G returned an empty reply', 502, 'empty_response', receipt.requestId);
    }
    return { text, receipt: { ...receipt, model: body.model || receipt.model } };
  });
}

// ---- Images. Some models only run as async jobs; the rest answer on the sync endpoint.

/** Portrait, the shape of a phone story; a router that rejects the size gets asked again without it. */
export const POSTER_SIZE = '1440x2560';

/** Models that only run as async jobs (`async_supported` in /v1/models). */
export const ASYNC_IMAGE_MODELS: ReadonlySet<string> = new Set(['z-image-turbo', 'z-image']);
/** How long one request waits on an async job. The job is billed even if we stop polling. */
export const IMAGE_JOB_BUDGET_MS = 90_000;
const DEFAULT_POLL_MS = 2_500;

type ImageReply = { data?: { b64_json?: string; url?: string }[] };
type ImageOut = { base64: string; mimeType: string; receipt: ZeroGReceipt };

function imageBody(model: ModelChoice, prompt: string, size?: string): string {
  return JSON.stringify({
    model: model.id,
    prompt,
    n: 1,
    ...(size ? { size } : {}),
    response_format: 'b64_json',
    verify_tee: verifyTee(),
  });
}

/** Runs `attempt` at `size`; a router that rejects the size is asked again without it. */
async function withSizeFallback<T>(
  size: string | undefined,
  attempt: (size?: string) => Promise<T>
): Promise<T> {
  try {
    return await attempt(size);
  } catch (error) {
    if (!(size && error instanceof ZeroGError && error.status === 400)) throw error;
    console.info(`[0g] image size ${size} rejected, retrying at the default size`);
    return attempt();
  }
}

async function finishImage(reply: ImageReply, receipt: ZeroGReceipt): Promise<ImageOut> {
  const image = reply.data?.[0];
  if (image?.b64_json) return { base64: image.b64_json, mimeType: 'image/png', receipt };
  if (image?.url) {
    const download = await fetch(image.url, { signal: AbortSignal.timeout(30_000) });
    if (!download.ok) {
      throw new ZeroGError('Could not fetch the generated image', 502, null, receipt.requestId);
    }
    const bytes = Buffer.from(await download.arrayBuffer());
    return {
      base64: bytes.toString('base64'),
      mimeType: download.headers.get('content-type') ?? 'image/png',
      receipt,
    };
  }
  throw new ZeroGError('0G returned no image', 502, null, receipt.requestId);
}

async function imageSync(
  model: ModelChoice,
  prompt: string,
  size: string | undefined,
  lastChance: boolean
): Promise<ImageOut> {
  const { body, receipt } = await withSizeFallback(size, (s) =>
    sendWithRetry<ImageReply>(
      '/images/generations',
      { method: 'POST', headers: headersFor(model.trust), body: imageBody(model, prompt, s) },
      model,
      lastChance
    )
  );
  return finishImage(body, receipt);
}

interface JobState {
  status?: string;
  data?: ImageReply;
  x_0g_trace?: unknown;
}

/** Submit to the async endpoint, then poll the job (pinned to its provider) until it finishes. */
async function imageJob(
  model: ModelChoice,
  prompt: string,
  size: string | undefined,
  sleep: Sleep
): Promise<ImageOut> {
  const submit = await withSizeFallback(size, (s) =>
    send<{ jobId?: string; provider_address?: string; x_0g_trace?: unknown }>(
      '/async/images/generations',
      {
        method: 'POST',
        headers: headersFor(model.trust),
        body: imageBody(model, prompt, s),
        signal: AbortSignal.timeout(30_000),
      },
      model
    )
  );
  const jobId = submit.body.jobId;
  if (!jobId) throw new ZeroGError('0G accepted no image job', 502, 'empty_response', null);
  const query = submit.body.provider_address
    ? `?provider_address=${encodeURIComponent(submit.body.provider_address)}`
    : '';
  const pollPath = `/async/jobs/${encodeURIComponent(jobId)}${query}`;

  let waited = 0;
  let wait = DEFAULT_POLL_MS;
  while (waited + wait <= IMAGE_JOB_BUDGET_MS) {
    await sleep(wait);
    waited += wait;
    const poll = await send<JobState>(
      pollPath,
      { headers: headersFor(null, false), signal: AbortSignal.timeout(15_000) },
      model
    );
    const state = poll.body;
    if (state.status === 'completed') {
      // The job's own trace carries the cost; the submit's carries the id if the job's is missing.
      const receipt = receiptFrom(
        poll.response,
        state,
        model.id,
        model.trust,
        state.x_0g_trace ? undefined : submit.body.x_0g_trace
      );
      if (!receipt.requestId) receipt.requestId = submit.receipt.requestId;
      return finishImage(state.data ?? {}, receipt);
    }
    if (state.status !== 'pending' && state.status !== 'running') {
      throw new ZeroGError(
        `0G image job ended as ${state.status ?? 'unknown'}`,
        502,
        'image_failed',
        submit.receipt.requestId
      );
    }
    const retryAfter = Number(poll.response.headers.get('Retry-After'));
    wait = retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : DEFAULT_POLL_MS;
  }
  throw new ZeroGError(
    '0G image job did not finish in time',
    504,
    'timeout',
    submit.receipt.requestId
  );
}

/** One generated image as a base64 string, on the first image model whose providers answer. */
export async function generateImage(
  prompt: string,
  options: { size?: string; sleep?: Sleep } = {}
): Promise<ImageOut> {
  const models = await imageModels();
  return withFallback(models, (model, lastChance) =>
    ASYNC_IMAGE_MODELS.has(model.id)
      ? imageJob(model, prompt, options.size, options.sleep ?? realSleep)
      : imageSync(model, prompt, options.size, lastChance)
  );
}

// ---- Speech.

export async function transcribe(
  audio: Buffer,
  filename: string,
  mimeType: string
): Promise<{ text: string; receipt: ZeroGReceipt }> {
  const models = await speechModels();
  return withFallback(models, async (model, lastChance) => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
    form.append('model', model.id);
    form.append('response_format', 'json');
    // Multipart, so `verify_tee` rides in the query string rather than the body.
    const query = verifyTee() ? '?verify_tee=true' : '';
    const { body, receipt } = await sendWithRetry<{ text?: string }>(
      `/audio/transcriptions${query}`,
      // No content-type: fetch sets the multipart boundary itself.
      { method: 'POST', headers: headersFor(model.trust, false), body: form },
      model,
      lastChance
    );
    return { text: (body.text ?? '').trim(), receipt };
  });
}
