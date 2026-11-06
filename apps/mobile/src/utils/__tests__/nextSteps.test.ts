import { describe, expect, it } from 'vitest';
import { nextStepsAfterSave, postSaveActions } from '@/utils/nextSteps';

const recorded = { privacy: 'everyone' as const, isManual: false, images: undefined };

describe('nextStepsAfterSave', () => {
  it('offers sharing and a photo for a fresh public recording', () => {
    expect(nextStepsAfterSave(recorded, true)).toEqual(['share', 'addPhoto']);
  });

  it('offers sharing to followers-only activities too', () => {
    expect(nextStepsAfterSave({ ...recorded, privacy: 'followers' }, true)).toContain('share');
  });

  it('treats a missing privacy as the everyone default', () => {
    expect(nextStepsAfterSave({ ...recorded, privacy: undefined }, true)).toContain('share');
  });

  it('does not offer sharing for an Only Me activity', () => {
    expect(nextStepsAfterSave({ ...recorded, privacy: 'only_me' }, true)).toEqual(['addPhoto']);
  });

  it('still offers a photo for an Only Me activity, since it stays on this phone', () => {
    expect(nextStepsAfterSave({ ...recorded, privacy: 'only_me' }, true)).toContain('addPhoto');
  });

  it('does not offer a photo when the activity already has one', () => {
    expect(nextStepsAfterSave({ ...recorded, images: ['file:///a.jpg'] }, true)).toEqual(['share']);
  });

  it('counts the older single-image field as a photo', () => {
    expect(nextStepsAfterSave({ ...recorded, image: 'https://x/a.jpg' }, true)).toEqual(['share']);
  });

  it('offers a photo when the photo list is empty', () => {
    expect(nextStepsAfterSave({ ...recorded, images: [] }, true)).toContain('addPhoto');
  });

  it('puts the photo first for a manual entry, which has no map to show', () => {
    expect(nextStepsAfterSave({ ...recorded, isManual: true }, true)).toEqual([
      'addPhoto',
      'share',
    ]);
  });

  it('still offers sharing for a manual entry with photos', () => {
    expect(
      nextStepsAfterSave({ ...recorded, isManual: true, images: ['file:///a.jpg'] }, true)
    ).toEqual(['share']);
  });

  it('offers nothing for an Only Me activity that already has photos', () => {
    expect(
      nextStepsAfterSave({ ...recorded, privacy: 'only_me', images: ['file:///a.jpg'] }, true)
    ).toEqual([]);
  });

  it('offers nothing on someone else’s activity', () => {
    expect(nextStepsAfterSave(recorded, false)).toEqual([]);
  });
});

describe('postSaveActions', () => {
  it('makes Share the primary action beside View activity when it is offered', () => {
    expect(postSaveActions(['share', 'addPhoto'])).toEqual({
      shareIsPrimary: true,
      addPhoto: true,
    });
  });

  it('leaves View activity primary when nothing can be shared', () => {
    expect(postSaveActions(['addPhoto'])).toEqual({ shareIsPrimary: false, addPhoto: true });
    expect(postSaveActions([])).toEqual({ shareIsPrimary: false, addPhoto: false });
  });
});
