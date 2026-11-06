import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachBudget } from '../../lib/coach.js';
import { coach, resetCoachBudget } from '../coach.js';

const WALLET = '0x00000000000000000000000000000000000000aa';
const RUN = {
  activityType: 'run',
  distanceM: 5200,
  durationS: 1680,
  startedAt: '2026-11-05T06:30:00Z',
};

function routerReply(body: unknown, requestId = 'req_test', status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

function post(path: string, body: unknown) {
  return coach.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('coach routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ZEROG_API_KEY = 'sk-test';
    process.env.ZEROG_CHAT_MODEL = '0gm-1.0-35b-a3b';
    process.env.ZEROG_IMAGE_MODEL = 'seedream-test';
    process.env.ZEROG_STT_MODEL = 'whisper-large-v3';
    resetCoachBudget(new CoachBudget({ plan: 1, poster: 1, debrief: 1, review: 1 }));
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is unavailable without a 0G key', async () => {
    delete process.env.ZEROG_API_KEY;
    const res = await post('/plan', { wallet: WALLET, history: [RUN] });
    expect(res.status).toBe(503);
  });

  it('plans today on 0G and returns the request id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      routerReply({
        choices: [
          {
            message: {
              content:
                '{"title":"Easy jog","type":"easy","distanceKm":3,"durationMin":25,"effort":"easy","summary":"Recover.","steps":[{"label":"Jog","detail":"3 km easy"}],"why":"Long run yesterday."}',
            },
          },
        ],
        x_0g_trace: { billing: { total_cost_usd_micro: 120 } },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await post('/plan', { wallet: WALLET, history: [RUN], today: '2026-11-06' });
    const body = (await res.json()) as {
      plan: { title: string; type: string; distanceKm: number };
      zeroG: { requestId: string; costUsdMicro: number }[];
    };

    expect(res.status).toBe(200);
    expect(body.plan.title).toBe('Easy jog');
    expect(body.plan).toMatchObject({ type: 'easy', distanceKm: 3 });
    expect(body.zeroG[0]).toMatchObject({
      requestId: 'req_test',
      model: '0gm-1.0-35b-a3b',
      costUsdMicro: 120,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://router-api.0g.ai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
  });

  it('stops at the daily allowance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        routerReply({
          choices: [
            {
              message: {
                content:
                  '{"title":"Rest","type":"rest","effort":"rest","steps":[{"label":"Rest","detail":"Off"}]}',
              },
            },
          ],
        })
      )
    );
    expect((await post('/plan', { wallet: WALLET, history: [] })).status).toBe(200);
    const second = await post('/plan', { wallet: WALLET, history: [] });
    expect(second.status).toBe(429);
  });

  it('gives the allowance back when 0G fails, and passes on its request id', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          routerReply({ error: { message: 'no balance', code: 'pay_no_balance' } }, 'req_fail', 402)
        )
    );
    const res = await post('/plan', { wallet: WALLET, history: [] });
    const body = (await res.json()) as { requestId: string };
    expect(res.status).toBe(402);
    expect(body.requestId).toBe('req_fail');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        routerReply({
          choices: [
            {
              message: {
                content:
                  '{"title":"Rest","type":"rest","effort":"rest","steps":[{"label":"Rest","detail":"Off"}]}',
              },
            },
          ],
        })
      )
    );
    expect((await post('/plan', { wallet: WALLET, history: [] })).status).toBe(200);
  });

  it('reviews a run with its vitals on 0G', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      routerReply(
        {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  headline: 'Even and controlled',
                  summary: 'You held 5:23/km. Heart rate stayed steady.',
                  wentWell: ['Even splits'],
                  vitals: [{ label: 'Heart rate', reading: '148 bpm', note: 'Aerobic.' }],
                  improve: [{ focus: 'Cadence', tip: 'Aim for 170 steps/min.' }],
                  nextRun: 'Easy 5 km.',
                }),
              },
            },
          ],
        },
        'req_review'
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await post('/review', {
      wallet: WALLET,
      activity: RUN,
      vitals: { heartRate: { avg: 148, max: 166 }, cadenceSpm: 160 },
      history: [RUN],
    });
    const body = (await res.json()) as {
      review: { headline: string; improve: { focus: string }[] };
      zeroG: { requestId: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.review.headline).toBe('Even and controlled');
    expect(body.review.improve[0]?.focus).toBe('Cadence');
    expect(body.zeroG[0]?.requestId).toBe('req_review');
    const sent = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(sent.messages[1].content).toContain('avg 148 bpm');
  });

  it('refuses a review without the activity, without spending the allowance', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect((await post('/review', { wallet: WALLET })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('art-directs a poster on 0G, then paints it: two request ids', async () => {
    const direction = {
      title: 'Storm Chaser',
      prompt:
        'A lone runner silhouetted against a towering monsoon storm rolling over the Mumbai skyline at dawn, rain sheeting across the sea.',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        routerReply({ choices: [{ message: { content: JSON.stringify(direction) } }] }, 'req_art')
      )
      .mockResolvedValueOnce(routerReply({ data: [{ b64_json: 'aGVsbG8=' }] }, 'req_img'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await post('/poster', {
      wallet: WALLET,
      activity: RUN,
      mood: 'proud',
      style: 'ukiyoe',
    });
    const body = (await res.json()) as {
      imageBase64: string;
      title: string;
      style: string;
      zeroG: { requestId: string; model: string }[];
    };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ imageBase64: 'aGVsbG8=', title: 'Storm Chaser', style: 'ukiyoe' });
    expect(body.zeroG.map((r) => r.requestId)).toEqual(['req_art', 'req_img']);
    const image = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(image.model).toBe('seedream-test');
    expect(image.size).toBe('1440x2560');
    expect(image.prompt).toContain('monsoon storm');
    expect(image.prompt).toContain('"STORM CHASER"');
    expect(image.prompt).toContain('5.2 KM');
    expect(image.prompt).toContain('ukiyo-e');
  });

  it('still paints a poster when the art director reply is unreadable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(routerReply({ choices: [{ message: { content: 'sorry' } }] }))
      .mockResolvedValueOnce(routerReply({ data: [{ b64_json: 'aGVsbG8=' }] }, 'req_img'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await post('/poster', { wallet: WALLET, activity: RUN, style: 'comic' });
    const body = (await res.json()) as { title: string | null };
    expect(res.status).toBe(200);
    expect(body.title).toBeNull();
    const image = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string);
    expect(image.prompt).toContain('No text');
    expect(image.prompt).toContain('comic book');
  });

  it('asks again without a size when the router rejects it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(routerReply({ choices: [{ message: { content: 'x' } }] }))
      .mockResolvedValueOnce(routerReply({ error: { message: 'bad size' } }, 'req_bad', 400))
      .mockResolvedValueOnce(routerReply({ data: [{ b64_json: 'aGVsbG8=' }] }, 'req_img'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await post('/poster', { wallet: WALLET, activity: RUN });
    expect(res.status).toBe(200);
    const retry = JSON.parse((fetchMock.mock.calls[2] as [string, RequestInit])[1].body as string);
    expect(retry.size).toBeUndefined();
  });

  it('retries a review when a 0G provider stumbles', async () => {
    vi.useFakeTimers();
    const reply = {
      headline: 'Solid',
      summary: 'Good run.',
      improve: [{ focus: 'Cadence', tip: 'Shorter steps.' }],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        routerReply({ error: { message: 'fetch provider quote: EOF' } }, 'req_eof', 502)
      )
      .mockResolvedValueOnce(
        routerReply({ choices: [{ message: { content: JSON.stringify(reply) } }] }, 'req_ok')
      );
    vi.stubGlobal('fetch', fetchMock);

    const pending = post('/review', { wallet: WALLET, activity: RUN });
    await vi.advanceTimersByTimeAsync(2_000);
    const res = await pending;
    vi.useRealTimers();

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('transcribes a voice debrief, then turns it into a note: two request ids', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(routerReply({ text: 'legs felt heavy on the hills' }, 'req_stt'))
      .mockResolvedValueOnce(
        routerReply(
          {
            choices: [
              {
                message: {
                  content:
                    '{"summary":"Heavy legs on the hills.","effort":7,"feel":"tough","tags":["hills"]}',
                },
              },
            ],
          },
          'req_note'
        )
      );
    vi.stubGlobal('fetch', fetchMock);

    const res = await post('/debrief', {
      wallet: WALLET,
      activity: RUN,
      audioBase64: Buffer.from('fake audio').toString('base64'),
      mimeType: 'audio/m4a',
    });
    const body = (await res.json()) as {
      transcript: string;
      debrief: { effort: number; feel: string };
      zeroG: { requestId: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.transcript).toBe('legs felt heavy on the hills');
    expect(body.debrief).toMatchObject({ effort: 7, feel: 'tough' });
    expect(body.zeroG.map((r) => r.requestId)).toEqual(['req_stt', 'req_note']);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://router-api.0g.ai/v1/audio/transcriptions'
    );
  });

  it('rejects an unsupported audio type without calling 0G', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await post('/debrief', {
      wallet: WALLET,
      activity: RUN,
      audioBase64: 'AAAA',
      mimeType: 'video/mp4',
    });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
