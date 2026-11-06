import { describe, expect, it } from 'vitest';
import {
  canSaveActivity,
  defaultGearId,
  discardPrompt,
  hiddenDetailsSummary,
  privacyChangeNeedsConfirm,
  showHideRoute,
  showVisibilityControls,
  toggleHiddenStat,
  visibilityFlags,
} from '@/utils/saveActivityForm';

const manualOk = { ok: true as const, distance: 5000, duration: 1_800_000 };
const manualBad = { ok: false as const, reason: 'Enter how long it took' };

describe('canSaveActivity', () => {
  it('lets a recording save, whatever the manual fields say', () => {
    expect(
      canSaveActivity({
        isSaving: false,
        fromRecording: true,
        manual: manualBad,
        startInFuture: true,
      })
    ).toBe(true);
  });

  it('needs a valid manual entry that did not start in the future', () => {
    const base = { isSaving: false, fromRecording: false, startInFuture: false };
    expect(canSaveActivity({ ...base, manual: manualOk })).toBe(true);
    expect(canSaveActivity({ ...base, manual: manualBad })).toBe(false);
    expect(canSaveActivity({ ...base, manual: manualOk, startInFuture: true })).toBe(false);
  });

  it('blocks a second tap while saving', () => {
    expect(
      canSaveActivity({
        isSaving: true,
        fromRecording: true,
        manual: manualOk,
        startInFuture: false,
      })
    ).toBe(false);
  });
});

describe('defaultGearId', () => {
  const options = [{ id: 'a' }, { id: 'b' }];

  it('starts on the first gear for the sport', () => {
    expect(defaultGearId(undefined, options)).toBe('a');
  });

  it('keeps an explicit pick, including none', () => {
    expect(defaultGearId('b', options)).toBe('b');
    expect(defaultGearId(null, options)).toBeNull();
  });

  it('is none when the sport has no gear', () => {
    expect(defaultGearId(undefined, [])).toBeNull();
  });
});

describe('privacyChangeNeedsConfirm', () => {
  it('asks only when moving to Only Me from something else', () => {
    expect(privacyChangeNeedsConfirm('everyone', 'only_me')).toBe(true);
    expect(privacyChangeNeedsConfirm('only_me', 'only_me')).toBe(false);
    expect(privacyChangeNeedsConfirm('only_me', 'followers')).toBe(false);
  });
});

describe('showHideRoute', () => {
  it('applies to a recorded route that is not already Only Me', () => {
    expect(showHideRoute(true, 'everyone')).toBe(true);
    expect(showHideRoute(true, 'only_me')).toBe(false);
    expect(showHideRoute(false, 'everyone')).toBe(false);
  });
});

describe('hiddenDetailsSummary', () => {
  it('says None, or how many are hidden', () => {
    expect(hiddenDetailsSummary([])).toBe('None');
    expect(hiddenDetailsSummary(['pace'])).toBe('1');
    expect(hiddenDetailsSummary(['pace', 'start_time'])).toBe('2');
  });
});

describe('toggleHiddenStat', () => {
  it('adds a stat once and removes it again', () => {
    expect(toggleHiddenStat([], 'pace', true)).toEqual(['pace']);
    expect(toggleHiddenStat(['pace'], 'pace', true)).toEqual(['pace']);
    expect(toggleHiddenStat(['pace', 'start_time'], 'pace', false)).toEqual(['start_time']);
  });
});

describe('showVisibilityControls', () => {
  it('is for activities others can see, not Only Me', () => {
    expect(showVisibilityControls('everyone')).toBe(true);
    expect(showVisibilityControls('followers')).toBe(true);
    expect(showVisibilityControls('only_me')).toBe(false);
  });
});

describe('visibilityFlags', () => {
  it('carries the mute and hidden stats for an activity others can see', () => {
    expect(visibilityFlags({ privacy: 'everyone', muted: true, hiddenStats: ['pace'] })).toEqual({
      mutedFromFeeds: true,
      hiddenStats: ['pace'],
    });
  });

  it('leaves both unset when off or empty', () => {
    expect(visibilityFlags({ privacy: 'followers', muted: false, hiddenStats: [] })).toEqual({
      mutedFromFeeds: undefined,
      hiddenStats: undefined,
    });
  });

  it('drops both for Only Me, which nobody else sees anyway', () => {
    expect(visibilityFlags({ privacy: 'only_me', muted: true, hiddenStats: ['pace'] })).toEqual({
      mutedFromFeeds: undefined,
      hiddenStats: undefined,
    });
  });
});

describe('discardPrompt', () => {
  it('words a recording as unrecoverable', () => {
    expect(discardPrompt(true)).toEqual({
      title: 'Discard this recording?',
      message: "This recording can't be recovered.",
      confirmLabel: 'Discard',
      cancelLabel: 'Keep Editing',
    });
  });

  it('words a typed-in activity as lost changes', () => {
    expect(discardPrompt(false)).toMatchObject({
      title: 'Discard Activity?',
      message: 'Your changes will be lost.',
    });
  });
});
