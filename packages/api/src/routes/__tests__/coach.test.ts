import { verifyMessage } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.STORE_FILE = `${process.env.TEMP ?? '/tmp'}/stryde-coach-routes-${process.pid}.json`;
});
vi.mock('../../lib/relayer.js', () => ({
  getRelayerPublicClient: () => ({ verifyMessage }),
  getRelayerWallet: vi.fn(),
}));

import { CoachBudget } from '../../lib/coach.js';
import { banHuman, humanSessionMessage } from '../../lib/humanPass.js';
import { store } from '../../lib/store.js';
import { coach, resetCoachBudget } from '../coach.js';
import { humanPass } from '../humanPass.js';

const athlete = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());
const WALLET = '0x00000000000000000000000000000000000000aa';
const RUN = {
  activityType: 'run',
  distanceM: 5200,
  durationS: 1680,
  startedAt: '2026-11-05T06:30:00Z',
};

/** A real signed session, the way the app opens one. */
async function sessionHeaders(account = athlete): Promise<Record<string, string>> {
  const issuedAt = Date.now();
  const signature = await account.signMessage({
    message: humanSessionMessage(account.address, issuedAt),
  });
  const res = await humanPass.request('/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ wallet: account.address, issuedAt, signature }),
  });
  const { token } = (await res.json()) as { token: string };
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

function routerReply(body: unknown, requestId = 'req_test', status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
  });
}

let headers: Record<string, string>;

function post(path: string, body: unknown, as: Record<string, string> = headers) {
  return coach.request(path, { method: 'POST', headers: as, body: JSON.stringify(body) });
}

describe('coach routes', () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    store.reset();
    headers = await sessionHeaders();
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

  describe('wallet session', () => {
    it('refuses every route without a session, before touching 0G', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const bare = { 'content-type': 'application/json' };
      for (const path of ['/plan', '/review', '/poster', '/debrief']) {
        const res = await post(path, { activity: RUN, history: [] }, bare);
        expect(res.status).toBe(401);
        expect(await res.json()).toMatchObject({ code: 'session_required' });
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses an unknown or malformed token', async () => {
      const forged = {
        'content-type': 'application/json',
        authorization: 'Bearer stryde_human_nope',
      };
      expect((await post('/plan', { history: [] }, forged)).status).toBe(401);
      const wrongKind = { 'content-type': 'application/json', authorization: 'Bearer abc' };
      expect((await post('/plan', { history: [] }, wrongKind)).status).toBe(401);
    });

    it('refuses an expired session', async () => {
      store.reset(); // the server no longer knows the token
      const res = await post('/plan', { history: [] });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'session_required' });
    });

    it('refuses a suspended athlete', async () => {
      store.upsertLink({
        iss: 'https://id.worldcoin.org',
        sub: 'sub-1',
        wallet: athlete.address,
        linkedAt: Date.now(),
        previousWallets: [],
      });
      banHuman({ wallet: athlete.address, reason: 'test' });
      expect((await post('/plan', { history: [] })).status).toBe(403);
    });

    it('charges the session wallet whatever wallet the body names', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () =>
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
      // The body names someone else's wallet: it must neither be used nor spend their allowance.
      expect((await post('/plan', { wallet: other.address, history: [] })).status).toBe(200);
      expect((await post('/plan', { wallet: other.address, history: [] })).status).toBe(429);
      // The named wallet's own allowance is untouched.
      const otherHeaders = await sessionHeaders(other);
      expect(
        (await post('/plan', { wallet: athlete.address, history: [] }, otherHeaders)).status
      ).toBe(200);
    });

    it('accepts a request that carries no wallet field at all', async () => {
      vi.stubGlobal('fetch', vi.fn());
      expect((await post('/review', { history: [] })).status).toBe(400); // activity missing, not 401
    });
  });

  it('is unavailable without a 0G key', async () => {
    delete process.env.ZEROG_API_KEY;
    const res = await post('/plan', { history: [RUN] });
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

    const res = await post('/plan', { history: [RUN], today: '2026-11-06' });
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

  it('passes the athlete facts into the plan prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      routerReply({
        choices: [
          {
            message: {
              content:
                '{"title":"Easy jog","type":"easy","distanceKm":3,"durationMin":25,"effort":"easy","steps":[{"label":"Jog","detail":"3 km"}],"why":"x"}',
            },
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const facts = {
      week: { km: 12.4, minutes: 80, runs: 3 },
      lastWeek: { km: 20, minutes: 130, runs: 4 },
    };
    await post('/plan', { history: [RUN], facts });
    const sent = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    const text = sent.messages.map((m: { content: string }) => m.content).join(' ');
    expect(text).toContain('This week so far: 12.4 km');
  });

  it('ignores facts that are not believable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      routerReply({
        choices: [
          {
            message: {
              content:
                '{"title":"Easy jog","type":"easy","distanceKm":3,"durationMin":25,"effort":"easy","steps":[{"label":"Jog","detail":"3 km"}],"why":"x"}',
            },
          },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await post('/plan', {
      wallet: WALLET,
      history: [],
      facts: { week: { km: -4 }, lastWeek: 'lots' },
    });
    expect(res.status).toBe(200);
    const sent = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(JSON.stringify(sent.messages)).not.toContain('Facts:');
  });

  describe('plan safety rules', () => {
    const HEAVY = {
      week: { km: 20, minutes: 130, runs: 4 },
      lastWeek: { km: 20, minutes: 130, runs: 4 },
      longestKm14: 10,
      daysSinceHard: 5,
      hardDays7: 1,
    };
    const planReply = (distanceKm: number, id: string, type = 'easy') =>
      routerReply(
        {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Run',
                  type,
                  distanceKm,
                  durationMin: distanceKm * 6,
                  effort: 'easy',
                  summary: 's',
                  steps: [{ label: 'Run', detail: `${distanceKm} km` }],
                  why: 'w',
                }),
              },
            },
          ],
        },
        id
      );
    type PlanBody = {
      plan: { distanceKm: number; type: string };
      adjusted?: string[];
      zeroG: { requestId: string }[];
      remaining: number;
    };

    it('asks once more with the rule stated, and keeps the fixed plan', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(planReply(8, 'req_one'))
        .mockResolvedValueOnce(planReply(3, 'req_two'));
      vi.stubGlobal('fetch', fetchMock);

      const res = await post('/plan', { history: [], facts: HEAVY });
      const body = (await res.json()) as PlanBody;

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(body.plan.distanceKm).toBe(3);
      expect(body.adjusted).toBeUndefined();
      expect(body.zeroG.map((r) => r.requestId)).toEqual(['req_one', 'req_two']);
      expect(body.remaining).toBe(0);
      const retry = JSON.parse(
        (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string
      );
      const last = retry.messages.at(-1).content as string;
      expect(last).toContain('breaks these safety limits');
      expect(last).toContain('at most 3 km');
      expect(retry.messages.at(-2).role).toBe('assistant');
    });

    it('clamps when the retry still breaks the rule, with both receipts and one charge', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(planReply(8, 'req_one'))
        .mockResolvedValueOnce(planReply(9, 'req_two'));
      vi.stubGlobal('fetch', fetchMock);

      const res = await post('/plan', { history: [], facts: HEAVY });
      const body = (await res.json()) as PlanBody;

      expect(res.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(body.plan.distanceKm).toBe(3);
      expect(body.adjusted?.length).toBeGreaterThan(0);
      expect(body.zeroG.map((r) => r.requestId)).toEqual(['req_one', 'req_two']);
      // One allowance was charged for both calls: the budget of 1 is spent, the next is refused.
      expect(body.remaining).toBe(0);
      expect((await post('/plan', { history: [], facts: HEAVY })).status).toBe(429);
    });

    it('clamps the first plan when the retry reply is unreadable', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(planReply(8, 'req_one'))
        .mockResolvedValueOnce(
          routerReply({ choices: [{ message: { content: 'sorry, no' } }] }, 'req_two')
        );
      vi.stubGlobal('fetch', fetchMock);

      const body = (await (await post('/plan', { history: [], facts: HEAVY })).json()) as PlanBody;
      expect(body.plan.distanceKm).toBe(3);
      expect(body.adjusted?.length).toBeGreaterThan(0);
      expect(body.zeroG).toHaveLength(2);
    });

    it('clamps the first plan when the retry call fails', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(planReply(8, 'req_one'))
        .mockResolvedValueOnce(routerReply({ error: { message: 'no balance' } }, 'req_two', 402));
      vi.stubGlobal('fetch', fetchMock);

      const res = await post('/plan', { history: [], facts: HEAVY });
      const body = (await res.json()) as PlanBody;
      expect(res.status).toBe(200);
      expect(body.plan.distanceKm).toBe(3);
      expect(body.zeroG.map((r) => r.requestId)).toEqual(['req_one']);
    });

    it('makes one call when the plan is already inside the rules', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(planReply(3, 'req_one'));
      vi.stubGlobal('fetch', fetchMock);
      const body = (await (await post('/plan', { history: [], facts: HEAVY })).json()) as PlanBody;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(body.adjusted).toBeUndefined();
      expect(body.zeroG).toHaveLength(1);
    });

    it('does not check anything without facts', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(planReply(30, 'req_one'));
      vi.stubGlobal('fetch', fetchMock);
      const body = (await (await post('/plan', { history: [] })).json()) as PlanBody;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(body.plan.distanceKm).toBe(30);
    });

    it('makes a hard session easy after a hard day', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(planReply(5, 'req_one', 'intervals'))
        .mockResolvedValueOnce(planReply(5, 'req_two', 'tempo'));
      vi.stubGlobal('fetch', fetchMock);
      const body = (await (
        await post('/plan', {
          wallet: WALLET,
          history: [],
          facts: { ...HEAVY, week: { km: 5, minutes: 30, runs: 1 }, daysSinceHard: 1 },
        })
      ).json()) as PlanBody;
      expect(body.plan.type).toBe('easy');
      expect(body.adjusted?.[0]).toContain('Made easy');
    });
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
    expect((await post('/plan', { history: [] })).status).toBe(200);
    const second = await post('/plan', { history: [] });
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
    const res = await post('/plan', { history: [] });
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
    expect((await post('/plan', { history: [] })).status).toBe(200);
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

    const res = await post('/poster', { activity: RUN, style: 'comic' });
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

    const res = await post('/poster', { activity: RUN });
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

    const pending = post('/review', { activity: RUN });
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
      'https://router-api.0g.ai/v1/audio/transcriptions?verify_tee=true'
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
