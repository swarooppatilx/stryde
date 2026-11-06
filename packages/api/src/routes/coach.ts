import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  CoachBudget,
  type CoachFeature,
  debriefMessages,
  parseDebrief,
  parsePlan,
  parsePosterDirection,
  parseReview,
  pickPosterStyle,
  planMessages,
  posterDirectorMessages,
  posterImagePrompt,
  posterPrompt,
  reviewMessages,
  toRunSummary,
  toVitals,
} from '../lib/coach.js';
import { parseFacts } from '../lib/coachFacts.js';
import { CoachRequestLog } from '../lib/coachRequests.js';
import { checkPlan } from '../lib/coachRules.js';
import { isWalletBanned, resolveHumanSession } from '../lib/humanPass.js';
import { logError } from '../lib/logError.js';
import {
  chat,
  generateImage,
  POSTER_SIZE,
  transcribe,
  ZeroGError,
  type ZeroGReceipt,
  zeroGConfigured,
} from '../lib/zeroG.js';

export const coach = new Hono();

let budget = CoachBudget.fromEnv();

/** Tests start each case with a fresh allowance. */
export function resetCoachBudget(next: CoachBudget = CoachBudget.fromEnv()): void {
  budget = next;
}

let requestLog = new CoachRequestLog();

/** Tests start each case with an empty request log. */
export function resetCoachRequestLog(): void {
  requestLog = new CoachRequestLog();
}

const MAX_HISTORY = 14;
// ~4 MB of audio as base64: comfortably over a 60 s voice note.
const MAX_AUDIO_BASE64 = 5_600_000;
const AUDIO_TYPES: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
};

type Guarded =
  | { ok: true; wallet: string; body: Record<string, unknown> }
  | { ok: false; response: Response };

/** The wallet the request proved it holds, or the 401 / 403 to answer with. */
function sessionWallet(c: Context): { wallet: string } | { response: Response } {
  // The wallet is proven by the signed session, never taken from the body: otherwise anyone
  // holding the API key could spend another athlete's daily allowance.
  const wallet = resolveHumanSession(c.req.header('authorization'));
  if (!wallet) {
    c.header('WWW-Authenticate', 'Bearer error="invalid_token"');
    return {
      response: c.json({ error: 'Sign in with your wallet first', code: 'session_required' }, 401),
    };
  }
  if (isWalletBanned(wallet)) {
    return { response: c.json({ error: 'This athlete is suspended from Stryde.' }, 403) };
  }
  return { wallet };
}

async function guard(c: Context, feature: CoachFeature): Promise<Guarded> {
  const session = sessionWallet(c);
  if ('response' in session) return { ok: false, response: session.response };
  const { wallet } = session;
  if (!zeroGConfigured()) {
    return { ok: false, response: c.json({ error: 'The AI coach is not configured' }, 503) };
  }
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') {
    return { ok: false, response: c.json({ error: 'A JSON body is required' }, 400) };
  }
  if (!budget.take(wallet, feature)) {
    return {
      ok: false,
      response: c.json(
        {
          error: `That's today's ${feature} allowance used. It resets at midnight UTC.`,
          code: 'daily_limit',
        },
        429
      ),
    };
  }
  return { ok: true, wallet, body };
}

function failure(c: Context, error: unknown, where: string) {
  logError(`[coach/${where}]`, error);
  if (error instanceof ZeroGError) {
    const status = error.status === 402 || error.status === 503 ? error.status : 502;
    const message =
      error.status === 402
        ? 'The coach is out of 0G credits for now.'
        : 'The coach could not reach 0G. Try again.';
    return c.json({ error: message, requestId: error.requestId, code: error.code }, status);
  }
  return c.json({ error: 'The coach could not finish that. Try again.' }, 502);
}

/** The caller's own 0G request log: request IDs, models, TEE result and cost. Never anyone else's. */
coach.get('/requests', (c) => {
  const session = sessionWallet(c);
  if ('response' in session) return session.response;
  return c.json({ requests: requestLog.list(session.wallet) });
});

coach.post('/plan', async (c) => {
  const g = await guard(c, 'plan');
  if (!g.ok) return g.response;
  const history = (Array.isArray(g.body.history) ? g.body.history : [])
    .map(toRunSummary)
    .filter((r) => r !== null)
    .slice(0, MAX_HISTORY);
  const today =
    typeof g.body.today === 'string'
      ? g.body.today.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const goal = typeof g.body.goal === 'string' ? g.body.goal.slice(0, 120) : undefined;

  const facts = parseFacts(g.body.facts);

  try {
    const messages = planMessages(history, today, goal, facts);
    const first = await chat(messages, { maxTokens: 500 });
    const receipts: ZeroGReceipt[] = [first.receipt];
    let plan = parsePlan(first.text);
    if (!plan) {
      budget.refund(g.wallet, 'plan');
      logError('[coach/plan] unparseable reply', {
        requestId: first.receipt.requestId,
        text: first.text.slice(0, 300),
      });
      return c.json(
        {
          error: 'The coach replied in a way we could not read. Try again.',
          requestId: first.receipt.requestId,
        },
        502
      );
    }

    // The plan is held to the athlete's own numbers: one retry with the rule stated, then a clamp.
    let adjusted: string[] = [];
    let check = checkPlan(plan, facts);
    if (check.violations.length > 0) {
      const stated = check.violations.join('; ');
      try {
        const retry = await chat(
          [
            ...messages,
            { role: 'assistant' as const, content: first.text },
            {
              role: 'user' as const,
              content: `That plan breaks these safety limits: ${stated}. Reply again with JSON only: a plan inside the limits.`,
            },
          ],
          { maxTokens: 500 }
        );
        receipts.push(retry.receipt);
        const second = parsePlan(retry.text);
        if (second) {
          plan = second;
          check = checkPlan(second, facts);
        }
      } catch (error) {
        logError('[coach/plan] retry unavailable, clamping the first plan', error);
      }
      if (check.violations.length > 0) {
        plan = check.clamped;
        adjusted = check.adjusted;
      }
    }
    console.info(
      `[coach] plan ${g.wallet.slice(0, 8)} via ${first.receipt.model} req=${receipts.map((r) => r.requestId).join(',')}${adjusted.length ? ' adjusted' : ''}`
    );
    requestLog.record(g.wallet, 'plan', receipts, { adjusted: adjusted.length > 0 });
    return c.json({
      plan,
      date: today,
      ...(adjusted.length ? { adjusted } : {}),
      zeroG: receipts,
      remaining: budget.remaining(g.wallet, 'plan'),
    });
  } catch (error) {
    budget.refund(g.wallet, 'plan');
    return failure(c, error, 'plan');
  }
});

coach.post('/review', async (c) => {
  const g = await guard(c, 'review');
  if (!g.ok) return g.response;
  const run = toRunSummary(g.body.activity);
  if (!run) {
    budget.refund(g.wallet, 'review');
    return c.json({ error: 'Activity details are missing' }, 400);
  }
  const vitals = toVitals(g.body.vitals);
  const history = (Array.isArray(g.body.history) ? g.body.history : [])
    .map(toRunSummary)
    .filter((r) => r !== null)
    .slice(0, MAX_HISTORY);

  try {
    const { text, receipt } = await chat(reviewMessages(run, vitals, history), {
      maxTokens: 900,
      temperature: 0.4,
    });
    const review = parseReview(text);
    if (!review) {
      budget.refund(g.wallet, 'review');
      logError('[coach/review] unparseable reply', {
        requestId: receipt.requestId,
        text: text.slice(0, 300),
      });
      return c.json(
        {
          error: 'The coach replied in a way we could not read. Try again.',
          requestId: receipt.requestId,
        },
        502
      );
    }
    console.info(
      `[coach] review ${g.wallet.slice(0, 8)} via ${receipt.model} req=${receipt.requestId}`
    );
    requestLog.record(g.wallet, 'review', [receipt]);
    return c.json({
      review,
      zeroG: [receipt],
      remaining: budget.remaining(g.wallet, 'review'),
    });
  } catch (error) {
    budget.refund(g.wallet, 'review');
    return failure(c, error, 'review');
  }
});

coach.post('/poster', async (c) => {
  const g = await guard(c, 'poster');
  if (!g.ok) return g.response;
  const run = toRunSummary(g.body.activity);
  if (!run) {
    budget.refund(g.wallet, 'poster');
    return c.json({ error: 'Activity details are missing' }, 400);
  }
  const mood = typeof g.body.mood === 'string' ? g.body.mood : undefined;
  const style = pickPosterStyle(g.body.style);

  try {
    const receipts: ZeroGReceipt[] = [];
    let prompt = posterPrompt(run, mood, style);
    let title: string | null = null;
    // The art director makes the poster personal; without it the plain scene still gets painted.
    try {
      const directed = await chat(posterDirectorMessages(run, style, mood), {
        maxTokens: 400,
        temperature: 1,
      });
      receipts.push(directed.receipt);
      const direction = parsePosterDirection(directed.text);
      if (direction) {
        prompt = posterImagePrompt(direction, run, style);
        title = direction.title;
      }
    } catch (error) {
      if (error instanceof ZeroGError && error.status === 402) throw error;
      logError('[coach/poster] art director unavailable, using the plain scene', error);
    }
    const image = await generateImage(prompt, { size: POSTER_SIZE });
    receipts.push(image.receipt);
    console.info(
      `[coach] poster ${g.wallet.slice(0, 8)} style=${style} via ${image.receipt.model} req=${image.receipt.requestId}`
    );
    requestLog.record(g.wallet, 'poster', receipts);
    return c.json({
      imageBase64: image.base64,
      mimeType: image.mimeType,
      prompt,
      title,
      style,
      zeroG: receipts,
      remaining: budget.remaining(g.wallet, 'poster'),
    });
  } catch (error) {
    budget.refund(g.wallet, 'poster');
    return failure(c, error, 'poster');
  }
});

coach.post(
  '/debrief',
  bodyLimit({
    maxSize: MAX_AUDIO_BASE64 + 50_000,
    onError: (c) => c.json({ error: 'Voice note too long' }, 413),
  }),
  async (c) => {
    const g = await guard(c, 'debrief');
    if (!g.ok) return g.response;
    const run = toRunSummary(g.body.activity);
    const audio = typeof g.body.audioBase64 === 'string' ? g.body.audioBase64 : '';
    const mimeType = typeof g.body.mimeType === 'string' ? g.body.mimeType : 'audio/m4a';
    const ext = AUDIO_TYPES[mimeType];
    if (!run || !audio || audio.length > MAX_AUDIO_BASE64 || !ext) {
      budget.refund(g.wallet, 'debrief');
      return c.json({ error: 'A short voice note and the activity are required' }, 400);
    }

    try {
      const heard = await transcribe(Buffer.from(audio, 'base64'), `debrief.${ext}`, mimeType);
      if (!heard.text) {
        budget.refund(g.wallet, 'debrief');
        return c.json(
          {
            error: "We couldn't hear anything. Try again somewhere quieter.",
            requestId: heard.receipt.requestId,
          },
          422
        );
      }
      const note = await chat(debriefMessages(heard.text, run), {
        maxTokens: 300,
        temperature: 0.3,
      });
      const debrief = parseDebrief(note.text, heard.text);
      console.info(
        `[coach] debrief ${g.wallet.slice(0, 8)} stt=${heard.receipt.requestId} note=${note.receipt.requestId}`
      );
      requestLog.record(g.wallet, 'debrief', [heard.receipt, note.receipt]);
      return c.json({
        transcript: heard.text,
        debrief,
        zeroG: [heard.receipt, note.receipt],
        remaining: budget.remaining(g.wallet, 'debrief'),
      });
    } catch (error) {
      budget.refund(g.wallet, 'debrief');
      return failure(c, error, 'debrief');
    }
  }
);
