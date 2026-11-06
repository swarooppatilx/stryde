import { getPlatform } from '@/platform';
import { apiFetch } from '@/services/strydeApi';
import type { CoachRun, CoachVitals } from '@/utils/coachRun';

/** One inference on 0G Private Computer, as the router billed it. */
export interface ZeroGReceipt {
  requestId: string | null;
  model: string;
  costUsdMicro: number | null;
}

export type CoachPlanType = 'rest' | 'recovery' | 'easy' | 'tempo' | 'intervals' | 'long' | 'cross';
export type CoachPlanEffort = 'rest' | 'easy' | 'moderate' | 'hard';

export interface CoachPlan {
  title: string;
  /** Absent on plans saved before plans were structured. */
  type?: CoachPlanType;
  distanceKm?: number | null;
  durationMin?: number | null;
  effort?: CoachPlanEffort;
  summary: string;
  steps: { label: string; detail: string }[];
  why: string;
}

export interface CoachDebrief {
  summary: string;
  effort: number | null;
  feel: 'great' | 'good' | 'ok' | 'tough' | 'bad' | null;
  tags: string[];
}

export interface CoachReview {
  headline: string;
  summary: string;
  wentWell: string[];
  vitals: { label: string; reading: string; note: string }[];
  improve: { focus: string; tip: string }[];
  nextRun: string;
}

/** The coach reads one activity's numbers against the recent log and says what to work on. */
export async function requestReview(
  wallet: string,
  activity: CoachRun,
  vitals: CoachVitals,
  history: CoachRun[]
): Promise<{ review: CoachReview; receipts: ZeroGReceipt[] }> {
  const body = await apiFetch<{ review: CoachReview; zeroG: ZeroGReceipt[] }>('/coach/review', {
    method: 'POST',
    body: JSON.stringify({ wallet, activity, vitals, history }),
  });
  return { review: body.review, receipts: body.zeroG };
}

export async function requestPlan(
  wallet: string,
  history: CoachRun[],
  today: string
): Promise<{ plan: CoachPlan; receipts: ZeroGReceipt[] }> {
  const body = await apiFetch<{ plan: CoachPlan; zeroG: ZeroGReceipt[] }>('/coach/plan', {
    method: 'POST',
    body: JSON.stringify({ wallet, history, today }),
  });
  return { plan: body.plan, receipts: body.zeroG };
}

const IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
};

/** Art styles the poster can be painted in; ids match the API's. */
export const POSTER_STYLES = [
  { id: 'synthwave', label: 'Synthwave' },
  { id: 'ukiyoe', label: 'Ukiyo-e' },
  { id: 'comic', label: 'Comic' },
  { id: 'travel', label: 'Vintage travel' },
  { id: 'risograph', label: 'Risograph' },
  { id: 'watercolor', label: 'Watercolour' },
  { id: 'constructivist', label: 'Bold graphic' },
  { id: 'cinematic', label: 'Cinematic' },
] as const;

export type PosterStyleId = (typeof POSTER_STYLES)[number]['id'];

/** An art director on 0G writes the scene, then Seedream on 0G paints it; the image stays on this device. */
export async function requestPoster(
  wallet: string,
  activityId: string,
  activity: CoachRun,
  style?: PosterStyleId
): Promise<{ uri: string; title: string | null; style: string; receipts: ZeroGReceipt[] }> {
  const body = await apiFetch<{
    imageBase64: string;
    mimeType: string;
    title: string | null;
    style: string;
    zeroG: ZeroGReceipt[];
  }>('/coach/poster', {
    method: 'POST',
    body: JSON.stringify({ wallet, activity, ...(style ? { style } : {}) }),
  });
  const ext = IMAGE_EXT[body.mimeType] ?? 'png';
  const safeId = activityId.replace(/[^A-Za-z0-9_-]/g, '');
  const uri = getPlatform().files.writeDocument(
    `coach-poster-${safeId}-${Date.now()}.${ext}`,
    body.imageBase64,
    'base64'
  );
  return { uri, title: body.title, style: body.style, receipts: body.zeroG };
}

export async function requestDebrief(
  wallet: string,
  activity: CoachRun,
  audioUri: string
): Promise<{ transcript: string; debrief: CoachDebrief; receipts: ZeroGReceipt[] }> {
  const audioBase64 = await getPlatform().files.readBase64(audioUri);
  const body = await apiFetch<{ transcript: string; debrief: CoachDebrief; zeroG: ZeroGReceipt[] }>(
    '/coach/debrief',
    {
      method: 'POST',
      body: JSON.stringify({ wallet, activity, audioBase64, mimeType: 'audio/m4a' }),
    }
  );
  return { transcript: body.transcript, debrief: body.debrief, receipts: body.zeroG };
}

/** `req_8f21…c3d4`: enough of the request id to look it up, short enough for a caption. */
export function shortRequestId(id: string | null): string {
  if (!id) return 'no id';
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}
