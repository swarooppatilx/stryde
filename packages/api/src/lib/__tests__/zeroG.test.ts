import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  chat,
  chatModels,
  generateImage,
  IMAGE_JOB_BUDGET_MS,
  imageModels,
  parseModels,
  resetZeroGState,
  stripThinking,
  transcribe,
  ZeroGError,
} from '../zeroG.js';

const BASE = 'https://router-api.0g.ai/v1';

function reply(body: unknown, headers: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}
const failure = (status: number, message = 'provider down', code = 'provider_error') =>
  reply({ error: { message, code } }, { 'x-request-id': `req_fail_${status}` }, status);
const chatOk = (content: string, trace: Record<string, unknown> = {}, model?: string) =>
  reply({
    choices: [{ message: { content } }],
    ...(model ? { model } : {}),
    x_0g_trace: { request_id: 'trace_chat', ...trace },
  });
const timeoutError = () => Object.assign(new Error('timed out'), { name: 'TimeoutError' });

let fetchMock: ReturnType<typeof vi.fn>;
const urls = () => fetchMock.mock.calls.map((c) => c[0] as string);
const init = (i: number) =>
  fetchMock.mock.calls[i]?.[1] as RequestInit & {
    headers: Record<string, string>;
  };
const sentBody = (i: number) => JSON.parse(init(i).body as string) as Record<string, unknown>;

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.ZEROG_API_KEY = 'sk-test';
  for (const key of [
    'ZEROG_CHAT_MODEL',
    'ZEROG_IMAGE_MODEL',
    'ZEROG_STT_MODEL',
    'ZEROG_TRUST_MODE',
    'ZEROG_VERIFY_TEE',
    'ZEROG_BASE_URL',
  ]) {
    delete process.env[key];
  }
  resetZeroGState();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('parseModels', () => {
  it('reads a comma list with the default trust floor', () => {
    expect(parseModels('a, b')).toEqual([
      { id: 'a', trust: 'verified' },
      { id: 'b', trust: 'verified' },
    ]);
  });

  it('lets an entry pin its own floor, and ignores an unknown one', () => {
    expect(parseModels('a@standard,b@private,c@nonsense,,')).toEqual([
      { id: 'a', trust: 'standard' },
      { id: 'b', trust: 'private' },
      { id: 'c', trust: 'verified' },
    ]);
  });

  it('follows ZEROG_TRUST_MODE, refusing unknown values', () => {
    process.env.ZEROG_TRUST_MODE = 'private';
    expect(parseModels('a')[0]?.trust).toBe('private');
    process.env.ZEROG_TRUST_MODE = 'whatever';
    expect(parseModels('a')[0]?.trust).toBe('verified');
  });
});

describe('model lists per capability', () => {
  it('pins chat models from the environment', async () => {
    process.env.ZEROG_CHAT_MODEL = '0gm-1.0-35b-a3b,glm-5.3';
    expect((await chatModels()).map((m) => m.id)).toEqual(['0gm-1.0-35b-a3b', 'glm-5.3']);
  });

  it('defaults to 0G model, then glm-5.3 behind it', async () => {
    fetchMock.mockResolvedValue(reply({ data: [{ id: '0gm-1.0-35b-a3b' }, { id: 'other' }] }));
    expect((await chatModels()).map((m) => m.id)).toEqual(['0gm-1.0-35b-a3b', 'glm-5.3']);
  });

  it('still has both chat models when the model list cannot be read', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    expect((await chatModels()).map((m) => m.id)).toEqual(['0gm-1.0-35b-a3b', 'glm-5.3']);
  });

  it('puts seedream first when listed, z-image-turbo next, minimax last and non-TEE', async () => {
    fetchMock.mockResolvedValue(reply({ data: [{ id: 'seedream-4.5' }, { id: 'z-image-turbo' }] }));
    expect(await imageModels()).toEqual([
      { id: 'seedream-4.5', trust: 'verified' },
      { id: 'z-image-turbo', trust: 'verified' },
      { id: 'minimax-image-01', trust: 'standard' },
    ]);
  });

  it('starts at z-image-turbo when seedream is not listed', async () => {
    fetchMock.mockResolvedValue(reply({ data: [{ id: 'z-image-turbo' }] }));
    expect((await imageModels()).map((m) => m.id)).toEqual(['z-image-turbo', 'minimax-image-01']);
  });
});

describe('stripThinking', () => {
  it('keeps only what follows the last </think>', () => {
    expect(stripThinking('reasoning here</think>\n\nThe answer.')).toBe('The answer.');
    expect(stripThinking('a</think>b</think> c')).toBe('c');
  });

  it('leaves normal text alone', () => {
    expect(stripThinking('plain')).toBe('plain');
  });
});

describe('chat: request and receipt', () => {
  beforeEach(() => {
    process.env.ZEROG_CHAT_MODEL = 'glm-5.3';
  });

  it('sends the key, trust floor, low reasoning and TEE verification', async () => {
    fetchMock.mockResolvedValue(chatOk('hi'));
    await chat([{ role: 'user', content: 'hello' }], { maxTokens: 100 });
    expect(urls()).toEqual([`${BASE}/chat/completions`]);
    expect(init(0).headers).toMatchObject({
      Authorization: 'Bearer sk-test',
      'X-0G-Provider-Trust-Mode': 'verified',
    });
    expect(sentBody(0)).toMatchObject({
      model: 'glm-5.3',
      reasoning_effort: 'low',
      verify_tee: true,
      max_tokens: 100,
    });
  });

  it('can turn TEE verification off', async () => {
    process.env.ZEROG_VERIFY_TEE = 'false';
    fetchMock.mockResolvedValue(chatOk('hi'));
    await chat([{ role: 'user', content: 'hello' }]);
    expect(sentBody(0).verify_tee).toBe(false);
  });

  it('parses the TEE fields, provider and USD cost from x_0g_trace', async () => {
    fetchMock.mockResolvedValue(
      chatOk('hi', {
        tee_verified: true,
        provider: '0xabc',
        billing: { currency: 'usd', total_cost_usd_micro: '1800' },
      })
    );
    const { receipt } = await chat([{ role: 'user', content: 'x' }]);
    expect(receipt).toEqual({
      requestId: 'trace_chat',
      model: 'glm-5.3',
      costUsdMicro: 1800,
      teeVerified: true,
      trustMode: 'verified',
      provider: '0xabc',
    });
  });

  it('reports false and null TEE results as they are', async () => {
    fetchMock.mockResolvedValueOnce(chatOk('a', { tee_verified: false }));
    expect((await chat([{ role: 'user', content: 'x' }])).receipt.teeVerified).toBe(false);
    fetchMock.mockResolvedValueOnce(chatOk('a', { tee_verified: 'yes' }));
    expect((await chat([{ role: 'user', content: 'x' }])).receipt.teeVerified).toBeNull();
  });

  it('prefers the trace request id, else the last part of the X-Request-Id header', async () => {
    fetchMock.mockResolvedValueOnce(chatOk('a'));
    expect((await chat([{ role: 'user', content: 'x' }])).receipt.requestId).toBe('trace_chat');
    fetchMock.mockResolvedValueOnce(
      reply({ choices: [{ message: { content: 'a' } }] }, { 'x-request-id': 'gateway_1, req_real' })
    );
    expect((await chat([{ role: 'user', content: 'x' }])).receipt.requestId).toBe('req_real');
  });

  it('has a null request id when the router sent none, and a null cost without USD', async () => {
    fetchMock.mockResolvedValue(
      reply({
        choices: [{ message: { content: 'a' } }],
        x_0g_trace: { billing: { currency: 'neuron', total_cost: '123' } },
      })
    );
    const { receipt } = await chat([{ role: 'user', content: 'x' }]);
    expect(receipt.requestId).toBeNull();
    expect(receipt.costUsdMicro).toBeNull();
  });

  it('drops reasoning that leaked into the answer', async () => {
    fetchMock.mockResolvedValue(chatOk('thinking...</think> Easy 5 km.'));
    expect((await chat([{ role: 'user', content: 'x' }])).text).toBe('Easy 5 km.');
  });

  it('reports the model the router says ran', async () => {
    fetchMock.mockResolvedValue(chatOk('a', {}, 'glm-5.3-fp8'));
    expect((await chat([{ role: 'user', content: 'x' }])).receipt.model).toBe('glm-5.3-fp8');
  });

  it('is not configured without a key', async () => {
    delete process.env.ZEROG_API_KEY;
    await expect(chat([{ role: 'user', content: 'x' }])).rejects.toMatchObject({
      status: 503,
      code: 'not_configured',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('chat: fallback and cooldown', () => {
  beforeEach(() => {
    process.env.ZEROG_CHAT_MODEL = '0gm-1.0-35b-a3b,glm-5.3';
  });
  const ask = () => chat([{ role: 'user', content: 'x' }]);
  const modelOf = (i: number) => sentBody(i).model;

  it('hands the call to the next model when the first one is down', async () => {
    fetchMock.mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(chatOk('ok'));
    const { text, receipt } = await ask();
    expect(text).toBe('ok');
    expect(receipt.model).toBe('glm-5.3');
    expect([modelOf(0), modelOf(1)]).toEqual(['0gm-1.0-35b-a3b', 'glm-5.3']);
    // The first model was not retried against itself: that is the slow path.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back on 502 and 504 too', async () => {
    fetchMock.mockResolvedValueOnce(failure(502)).mockResolvedValueOnce(chatOk('ok'));
    expect((await ask()).text).toBe('ok');
    resetZeroGState();
    fetchMock.mockResolvedValueOnce(failure(504)).mockResolvedValueOnce(chatOk('ok2'));
    expect((await ask()).text).toBe('ok2');
  });

  it('treats a timeout and a dead socket as a provider failure', async () => {
    fetchMock.mockRejectedValueOnce(timeoutError()).mockResolvedValueOnce(chatOk('ok'));
    expect((await ask()).text).toBe('ok');
    resetZeroGState();
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(chatOk('ok again'));
    expect((await ask()).text).toBe('ok again');
  });

  it('skips a failed model for 60 seconds, then tries it again', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
    fetchMock.mockResolvedValueOnce(failure(503)).mockImplementation(async () => chatOk('ok'));
    await ask(); // 0gm fails, glm answers
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await ask(); // 0gm is cooling down: straight to glm
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(modelOf(2)).toBe('glm-5.3');

    vi.setSystemTime(new Date('2026-11-06T10:00:59Z'));
    await ask();
    expect(modelOf(3)).toBe('glm-5.3');

    vi.setSystemTime(new Date('2026-11-06T10:01:01Z'));
    await ask(); // cooldown over: 0gm gets another chance
    expect(modelOf(4)).toBe('0gm-1.0-35b-a3b');
  });

  it('does not fall back on errors another model would repeat', async () => {
    fetchMock.mockResolvedValueOnce(failure(402, 'no balance', 'pay_no_balance'));
    await expect(ask()).rejects.toMatchObject({ status: 402, requestId: 'req_fail_402' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resetZeroGState();
    fetchMock.mockResolvedValueOnce(failure(400, 'bad request', 'invalid'));
    await expect(ask()).rejects.toMatchObject({ status: 400 });
  });

  it('reports the last failure when every model is down', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => failure(502));
    fetchMock.mockImplementationOnce(async () => failure(503));
    const result = expect(ask()).rejects.toMatchObject({ status: 502 });
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
  });

  it('still tries the models when all of them are cooling down', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => failure(503));
    const down = expect(ask()).rejects.toBeInstanceOf(ZeroGError);
    await vi.advanceTimersByTimeAsync(10_000);
    await down;

    fetchMock.mockReset();
    fetchMock.mockImplementationOnce(async () => chatOk('back'));
    expect((await ask()).text).toBe('back');
    expect(modelOf(0)).toBe('0gm-1.0-35b-a3b');
  });

  it('sends each model its own trust floor', async () => {
    process.env.ZEROG_CHAT_MODEL = 'a@private,b@standard';
    fetchMock.mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(chatOk('ok'));
    const { receipt } = await ask();
    expect(init(0).headers['X-0G-Provider-Trust-Mode']).toBe('private');
    expect(init(1).headers['X-0G-Provider-Trust-Mode']).toBe('standard');
    expect(receipt.trustMode).toBe('standard');
  });

  it('retries a stumble on the last model only', async () => {
    vi.useFakeTimers();
    process.env.ZEROG_CHAT_MODEL = 'only-model';
    fetchMock.mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(chatOk('second try'));
    const pending = ask();
    await vi.advanceTimersByTimeAsync(1_500);
    expect((await pending).text).toBe('second try');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('images: async job', () => {
  beforeEach(() => {
    process.env.ZEROG_IMAGE_MODEL = 'z-image-turbo';
  });
  const sleep = vi.fn(async (_ms: number) => {});
  beforeEach(() => sleep.mockClear());

  const submitOk = () =>
    reply(
      { jobId: 'job/1', provider_address: '0xabc', x_0g_trace: { request_id: 'async-submit' } },
      { 'x-request-id': 'gw, async-submit' }
    );
  const done = (extra: Record<string, unknown> = {}) =>
    reply({
      status: 'completed',
      data: { data: [{ b64_json: 'IMG' }] },
      x_0g_trace: {
        request_id: 'async-done',
        provider: '0xabc',
        billing: { total_cost_usd_micro: 8800 },
        ...extra,
      },
    });

  it('submits a job, polls it pinned to its provider, and returns the image', async () => {
    fetchMock
      .mockResolvedValueOnce(submitOk())
      .mockResolvedValueOnce(reply({ status: 'pending' }))
      .mockResolvedValueOnce(reply({ status: 'running' }))
      .mockResolvedValueOnce(done());
    const image = await generateImage('a scene', { size: '1440x2560', sleep });
    expect(urls()).toEqual([
      `${BASE}/async/images/generations`,
      `${BASE}/async/jobs/job%2F1?provider_address=0xabc`,
      `${BASE}/async/jobs/job%2F1?provider_address=0xabc`,
      `${BASE}/async/jobs/job%2F1?provider_address=0xabc`,
    ]);
    expect(sentBody(0)).toMatchObject({
      model: 'z-image-turbo',
      size: '1440x2560',
      response_format: 'b64_json',
      verify_tee: true,
    });
    expect(image.base64).toBe('IMG');
    expect(image.receipt).toEqual({
      requestId: 'async-done',
      model: 'z-image-turbo',
      costUsdMicro: 8800,
      teeVerified: null,
      trustMode: 'verified',
      provider: '0xabc',
    });
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it('falls back to the submit request id when the finished job has no trace', async () => {
    fetchMock
      .mockResolvedValueOnce(submitOk())
      .mockResolvedValueOnce(reply({ status: 'completed', data: { data: [{ b64_json: 'IMG' }] } }));
    const image = await generateImage('a scene', { sleep });
    expect(image.receipt.requestId).toBe('async-submit');
  });

  it('honours Retry-After between polls, capped at 10 seconds', async () => {
    fetchMock
      .mockResolvedValueOnce(submitOk())
      .mockResolvedValueOnce(reply({ status: 'pending' }, { 'retry-after': '4' }))
      .mockResolvedValueOnce(reply({ status: 'pending' }, { 'retry-after': '99' }))
      .mockResolvedValueOnce(done());
    await generateImage('a scene', { sleep });
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2_500, 4_000, 10_000]);
  });

  it('times out when the job never finishes', async () => {
    fetchMock.mockResolvedValueOnce(submitOk());
    fetchMock.mockImplementation(async () => reply({ status: 'pending' }));
    await expect(generateImage('a scene', { sleep })).rejects.toMatchObject({
      status: 504,
      code: 'timeout',
      requestId: 'async-submit',
    });
    expect(sleep).toHaveBeenCalledTimes(IMAGE_JOB_BUDGET_MS / 2_500);
  });

  it('fails a job that ends in any other state, carrying the request id', async () => {
    fetchMock.mockResolvedValueOnce(submitOk()).mockResolvedValueOnce(reply({ status: 'failed' }));
    await expect(generateImage('a scene', { sleep })).rejects.toMatchObject({
      status: 502,
      code: 'image_failed',
      requestId: 'async-submit',
    });
  });

  it('refuses a job id that never came, and a finished job with no image', async () => {
    fetchMock.mockResolvedValueOnce(reply({}));
    await expect(generateImage('a scene', { sleep })).rejects.toMatchObject({ status: 502 });
    resetZeroGState();
    fetchMock
      .mockResolvedValueOnce(submitOk())
      .mockResolvedValueOnce(reply({ status: 'completed', data: { data: [] } }));
    await expect(generateImage('a scene', { sleep })).rejects.toMatchObject({
      message: '0G returned no image',
    });
  });

  it('asks again without a size when the submit rejects it', async () => {
    fetchMock
      .mockResolvedValueOnce(failure(400, 'bad size', 'invalid_size'))
      .mockResolvedValueOnce(submitOk())
      .mockResolvedValueOnce(done());
    await generateImage('a scene', { size: '1440x2560', sleep });
    expect(sentBody(0).size).toBe('1440x2560');
    expect(sentBody(1)).not.toHaveProperty('size');
  });
});

describe('images: fallback chain', () => {
  const sleep = vi.fn(async (_ms: number) => {});

  it('falls from a failing z-image-turbo to minimax-image-01, labelled non-TEE', async () => {
    process.env.ZEROG_IMAGE_MODEL = 'z-image-turbo,minimax-image-01@standard';
    fetchMock.mockResolvedValueOnce(failure(503, 'no provider')).mockResolvedValueOnce(
      reply(
        {
          data: [{ b64_json: 'MINIMAX' }],
          x_0g_trace: { request_id: 'sync-1', billing: { total_cost_usd_micro: 5250 } },
        },
        {}
      )
    );
    const image = await generateImage('a scene', { sleep });
    expect(urls()).toEqual([`${BASE}/async/images/generations`, `${BASE}/images/generations`]);
    expect(init(1).headers['X-0G-Provider-Trust-Mode']).toBe('standard');
    expect(image.base64).toBe('MINIMAX');
    expect(image.receipt).toMatchObject({
      model: 'minimax-image-01',
      trustMode: 'standard',
      teeVerified: null,
      requestId: 'sync-1',
      costUsdMicro: 5250,
    });
  });

  it('a TEE model keeps its verified floor', async () => {
    process.env.ZEROG_IMAGE_MODEL = 'seedream-4.5';
    fetchMock.mockResolvedValueOnce(
      reply({ data: [{ b64_json: 'S' }], x_0g_trace: { request_id: 's1', tee_verified: true } })
    );
    const image = await generateImage('a scene', { sleep });
    expect(init(0).headers['X-0G-Provider-Trust-Mode']).toBe('verified');
    expect(image.receipt).toMatchObject({ trustMode: 'verified', teeVerified: true });
  });

  it('skips a model that just failed, so the next image is not slowed down', async () => {
    process.env.ZEROG_IMAGE_MODEL = 'z-image-turbo,minimax-image-01@standard';
    const minimax = () =>
      reply({ data: [{ b64_json: 'M' }], x_0g_trace: { request_id: 'sync-2' } });
    fetchMock.mockResolvedValueOnce(failure(503)).mockResolvedValueOnce(minimax());
    await generateImage('one', { sleep });
    fetchMock.mockResolvedValueOnce(minimax());
    await generateImage('two', { sleep });
    expect(urls().at(-1)).toBe(`${BASE}/images/generations`);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('asks a sync model again without a size when it rejects one', async () => {
    process.env.ZEROG_IMAGE_MODEL = 'minimax-image-01@standard';
    fetchMock
      .mockResolvedValueOnce(failure(400, 'bad size', 'invalid'))
      .mockResolvedValueOnce(reply({ data: [{ b64_json: 'M' }], x_0g_trace: { request_id: 'r' } }));
    await generateImage('x', { size: '1440x2560', sleep });
    expect(sentBody(0).size).toBe('1440x2560');
    expect(sentBody(1)).not.toHaveProperty('size');
  });

  it('downloads an image the router returns as a URL', async () => {
    process.env.ZEROG_IMAGE_MODEL = 'seedream-4.5';
    fetchMock
      .mockResolvedValueOnce(
        reply({ data: [{ url: 'https://img.example/a.jpg' }], x_0g_trace: { request_id: 'u1' } })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg' } })
      );
    const image = await generateImage('x', { sleep });
    expect(image.base64).toBe(Buffer.from([1, 2, 3]).toString('base64'));
    expect(image.mimeType).toBe('image/jpeg');
  });

  it('reports a sync reply with no image', async () => {
    process.env.ZEROG_IMAGE_MODEL = 'seedream-4.5';
    fetchMock.mockResolvedValueOnce(reply({ data: [], x_0g_trace: { request_id: 'e1' } }));
    await expect(generateImage('x', { sleep })).rejects.toMatchObject({
      message: '0G returned no image',
      requestId: 'e1',
    });
  });
});

describe('transcription', () => {
  beforeEach(() => {
    process.env.ZEROG_STT_MODEL = 'whisper-large-v3';
  });
  const call = () => transcribe(Buffer.from('audio'), 'debrief.m4a', 'audio/m4a');

  it('posts multipart with verify_tee in the query and reads the TEE result', async () => {
    fetchMock.mockResolvedValue(
      reply({
        text: '  legs felt heavy  ',
        x_0g_trace: { request_id: 'stt_1', tee_verified: true },
      })
    );
    const { text, receipt } = await call();
    expect(urls()).toEqual([`${BASE}/audio/transcriptions?verify_tee=true`]);
    expect(init(0).body).toBeInstanceOf(FormData);
    expect(init(0).headers).not.toHaveProperty('content-type');
    expect(init(0).headers['X-0G-Provider-Trust-Mode']).toBe('verified');
    expect(text).toBe('legs felt heavy');
    expect(receipt).toMatchObject({
      requestId: 'stt_1',
      model: 'whisper-large-v3',
      teeVerified: true,
      trustMode: 'verified',
    });
  });

  it('leaves verification out of the query when turned off', async () => {
    process.env.ZEROG_VERIFY_TEE = 'false';
    fetchMock.mockResolvedValue(reply({ text: 'ok', x_0g_trace: { request_id: 's' } }));
    await call();
    expect(urls()).toEqual([`${BASE}/audio/transcriptions`]);
  });

  it('returns empty text for a silent note', async () => {
    fetchMock.mockResolvedValue(reply({ x_0g_trace: { request_id: 's' } }));
    expect((await call()).text).toBe('');
  });
});
