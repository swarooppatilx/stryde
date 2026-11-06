import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform, uninstallFakePlatform } from '@/platform/fakes';
import type { CoachRun } from '@/utils/coachRun';

const humanFetch = vi.fn();
vi.mock('@/services/humanPassService', () => ({ humanFetch }));

const coach = await import('@/services/coachService');

const auth = { wallet: {}, address: '0x00000000000000000000000000000000000000aa' } as never;
const RUN: CoachRun = {
  activityType: 'run',
  distanceM: 5000,
  durationS: 1700,
  startedAt: '2026-11-05T06:30:00.000Z',
};

const call = (i = 0) => humanFetch.mock.calls[i] as [unknown, string, { body: string }];
const sentBody = (i = 0) => JSON.parse(call(i)[2].body) as Record<string, unknown>;

let files: ReturnType<typeof installFakePlatform>['files'];

beforeEach(() => {
  humanFetch.mockReset();
  files = installFakePlatform().files;
});
afterEach(() => uninstallFakePlatform());

describe('coach calls carry the wallet session, not a wallet field', () => {
  it('plan: passes auth, posts to /coach/plan and sends facts but no wallet', async () => {
    humanFetch.mockResolvedValue({ plan: { title: 'Easy' }, zeroG: [] });
    const facts = { week: { km: 1, minutes: 1, runs: 1 } } as never;
    await coach.requestPlan(auth, [RUN], '2026-11-06', facts);
    expect(call()[0]).toBe(auth);
    expect(call()[1]).toBe('/coach/plan');
    expect(sentBody()).toEqual({ history: [RUN], today: '2026-11-06', facts });
    expect(sentBody()).not.toHaveProperty('wallet');
  });

  it('plan: returns the safety adjustments only when there are some', async () => {
    humanFetch.mockResolvedValueOnce({ plan: {}, adjusted: ['Shortened'], zeroG: [] });
    expect(await coach.requestPlan(auth, [], 'd')).toMatchObject({ adjusted: ['Shortened'] });
    humanFetch.mockResolvedValueOnce({ plan: {}, adjusted: [], zeroG: [] });
    expect(await coach.requestPlan(auth, [], 'd')).not.toHaveProperty('adjusted');
    humanFetch.mockResolvedValueOnce({ plan: {}, zeroG: [] });
    expect(await coach.requestPlan(auth, [], 'd')).not.toHaveProperty('adjusted');
  });

  it('review: no wallet in the body', async () => {
    humanFetch.mockResolvedValue({ review: { headline: 'h' }, zeroG: [] });
    await coach.requestReview(auth, RUN, {}, [RUN]);
    expect(call()[0]).toBe(auth);
    expect(call()[1]).toBe('/coach/review');
    expect(sentBody()).not.toHaveProperty('wallet');
    expect(sentBody()).toMatchObject({ activity: RUN, history: [RUN] });
  });

  it('poster: no wallet in the body, and the image is saved on this device', async () => {
    humanFetch.mockResolvedValue({
      imageBase64: 'AAAA',
      mimeType: 'image/jpeg',
      title: 'Dawn',
      style: 'comic',
      zeroG: [],
    });
    const result = await coach.requestPoster(auth, 'act/1', RUN, 'comic');
    expect(call()[1]).toBe('/coach/poster');
    expect(sentBody()).toEqual({ activity: RUN, style: 'comic' });
    expect(result.uri).toMatch(/coach-poster-act1-\d+\.jpg$/);
  });

  it('debrief: no wallet in the body', async () => {
    files.contents.set('file:///note.m4a', 'QUJD');
    humanFetch.mockResolvedValue({ transcript: 't', debrief: {}, zeroG: [] });
    await coach.requestDebrief(auth, RUN, 'file:///note.m4a');
    expect(call()[1]).toBe('/coach/debrief');
    expect(sentBody()).toEqual({ activity: RUN, audioBase64: 'QUJD', mimeType: 'audio/m4a' });
  });
});

describe('shortRequestId', () => {
  it('shortens long ids and keeps short ones', () => {
    expect(coach.shortRequestId('req_8f21aaaaaaaaaaaaaaaac3d4')).toBe('req_8f21…c3d4');
    expect(coach.shortRequestId('req_1')).toBe('req_1');
    expect(coach.shortRequestId(null)).toBe('no id');
  });
});
