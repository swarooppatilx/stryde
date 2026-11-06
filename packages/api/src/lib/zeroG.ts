/**
 * 0G Private Computer: one OpenAI-compatible router for chat, image and speech models.
 * Every call keeps the router's `X-Request-ID`, the id its usage history and billing use.
 */

const DEFAULT_BASE_URL = 'https://router-api.0g.ai/v1';
const TIMEOUT_MS = 90_000;

export const CHAT_MODEL_FALLBACK = '0gm-1.0-35b-a3b';

export interface ZeroGReceipt {
  requestId: string | null;
  model: string;
  /** What the router charged, in micro-USD; null when it reported no USD figure. */
  costUsdMicro: number | null;
}

export class ZeroGError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
    readonly requestId: string | null
  ) {
    super(message);
  }
}

export function zeroGConfigured(): boolean {
  return Boolean(process.env.ZEROG_API_KEY);
}

function baseUrl(): string {
  return (process.env.ZEROG_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function authHeader(): Record<string, string> {
  const key = process.env.ZEROG_API_KEY;
  if (!key) throw new ZeroGError('0G is not configured', 503, 'not_configured', null);
  return { Authorization: `Bearer ${key}` };
}

interface Trace {
  request_id?: string;
  billing?: { total_cost_usd_micro?: number | string };
}

function receiptFrom(response: Response, body: unknown, model: string): ZeroGReceipt {
  const trace = (body as { x_0g_trace?: Trace } | null)?.x_0g_trace;
  const cost = Number(trace?.billing?.total_cost_usd_micro);
  return {
    requestId: response.headers.get('x-request-id') ?? trace?.request_id ?? null,
    model,
    costUsdMicro: Number.isFinite(cost) ? cost : null,
  };
}

/** Waits between attempts when the router or one of its providers stumbles. */
const RETRY_DELAYS_MS = [1_500, 4_000];

/** A provider hiccup (the router's 5xx, or its own rate limit) is worth another try; a 4xx about the request or a 402 for credit is not. */
function isTransient(error: unknown): boolean {
  if (error instanceof ZeroGError) return error.status === 429 || error.status >= 500;
  return error instanceof Error && error.name === 'TimeoutError';
}

async function sendWithRetry<T>(
  path: string,
  init: RequestInit,
  model: string
): Promise<{ body: T; receipt: ZeroGReceipt }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await send<T>(path, init, model);
    } catch (error) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isTransient(error)) throw error;
      console.info(`[0g] ${path} attempt ${attempt + 1} failed, retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function send<T>(
  path: string,
  init: RequestInit,
  model: string
): Promise<{ body: T; receipt: ZeroGReceipt }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { ...authHeader(), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  const receipt = receiptFrom(response, body, model);
  if (!response.ok) {
    const error = (body as { error?: { message?: string; code?: string } } | null)?.error;
    throw new ZeroGError(
      error?.message || `0G request failed (${response.status})`,
      response.status,
      error?.code ?? null,
      receipt.requestId
    );
  }
  return { body: body as T, receipt };
}

let modelList: Promise<string[]> | null = null;

/** The router's model ids; listing models is free, so it is read once and kept. */
function listModels(): Promise<string[]> {
  modelList ??= fetch(`${baseUrl()}/models`, {
    headers: authHeader(),
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

/** An env override, else the first listed model matching `pattern`, else `fallback`. */
async function resolveModel(envKey: string, pattern: RegExp, fallback: string): Promise<string> {
  const pinned = process.env[envKey];
  if (pinned) return pinned;
  const match = (await listModels()).find((id) => pattern.test(id));
  return match ?? fallback;
}

export const resolveChatModel = () =>
  resolveModel('ZEROG_CHAT_MODEL', /^0gm-1\.0/i, CHAT_MODEL_FALLBACK);
export const resolveImageModel = () =>
  resolveModel('ZEROG_IMAGE_MODEL', /seedream/i, 'seedream-4.5');
export const resolveSpeechModel = () =>
  resolveModel('ZEROG_STT_MODEL', /whisper-large-v3/i, 'whisper-large-v3');

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(
  messages: ChatMessage[],
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<{ text: string; receipt: ZeroGReceipt }> {
  const model = await resolveChatModel();
  const { body, receipt } = await sendWithRetry<{
    choices?: { message?: { content?: string } }[];
  }>(
    '/chat/completions',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens ?? 600,
        temperature: options.temperature ?? 0.7,
      }),
    },
    model
  );
  return { text: body.choices?.[0]?.message?.content ?? '', receipt };
}

type ImageReply = { data?: { b64_json?: string; url?: string }[] };

/** Portrait, the shape of a phone story; a router that rejects the size gets asked again without it. */
export const POSTER_SIZE = '1440x2560';

/** One generated image as a base64 string, fetched from the router's URL when it returns one. */
export async function generateImage(
  prompt: string,
  options: { size?: string } = {}
): Promise<{ base64: string; mimeType: string; receipt: ZeroGReceipt }> {
  const model = await resolveImageModel();
  const request = (size?: string) =>
    sendWithRetry<ImageReply>(
      '/images/generations',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt, n: 1, ...(size ? { size } : {}) }),
      },
      model
    );
  let reply: { body: ImageReply; receipt: ZeroGReceipt };
  try {
    reply = await request(options.size);
  } catch (error) {
    if (!(options.size && error instanceof ZeroGError && error.status === 400)) throw error;
    console.info(`[0g] image size ${options.size} rejected, retrying at the default size`);
    reply = await request();
  }
  const { body, receipt } = reply;
  const image = body.data?.[0];
  if (image?.b64_json) return { base64: image.b64_json, mimeType: 'image/png', receipt };
  if (image?.url) {
    const download = await fetch(image.url, { signal: AbortSignal.timeout(30_000) });
    if (!download.ok)
      throw new ZeroGError('Could not fetch the generated image', 502, null, receipt.requestId);
    const bytes = Buffer.from(await download.arrayBuffer());
    return {
      base64: bytes.toString('base64'),
      mimeType: download.headers.get('content-type') ?? 'image/png',
      receipt,
    };
  }
  throw new ZeroGError('0G returned no image', 502, null, receipt.requestId);
}

export async function transcribe(
  audio: Buffer,
  filename: string,
  mimeType: string
): Promise<{ text: string; receipt: ZeroGReceipt }> {
  const model = await resolveSpeechModel();
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
  form.append('model', model);
  form.append('response_format', 'json');
  const { body, receipt } = await sendWithRetry<{ text?: string }>(
    '/audio/transcriptions',
    { method: 'POST', body: form },
    model
  );
  return { text: (body.text ?? '').trim(), receipt };
}
