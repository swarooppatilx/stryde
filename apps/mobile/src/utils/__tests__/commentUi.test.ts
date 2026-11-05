import { describe, expect, it } from 'vitest';
import {
  charactersLeft,
  commentListMaxHeight,
  deliveryLine,
  likeCountText,
} from '@/utils/commentUi';

describe('deliveryLine', () => {
  it('says nothing once a comment has been delivered', () => {
    expect(deliveryLine(undefined)).toBeNull();
  });

  it('says a comment is still going out, quietly', () => {
    expect(deliveryLine('sending')).toEqual({ text: 'Sending…', failed: false });
    expect(deliveryLine('retrying')).toEqual({ text: 'Sending…', failed: false });
  });

  it('says when a comment waits for a connection or is slow', () => {
    expect(deliveryLine('waiting-for-network')).toEqual({
      text: 'Waiting for a connection',
      failed: false,
    });
    expect(deliveryLine('stuck')).toEqual({ text: 'Taking longer than usual', failed: false });
  });

  it('says a comment did not go and how to fix it', () => {
    expect(deliveryLine('failed')).toEqual({ text: 'Not sent. Tap to try again', failed: true });
  });
});

describe('charactersLeft', () => {
  it('stays quiet until the limit is near', () => {
    expect(charactersLeft(100, 500)).toBeNull();
    expect(charactersLeft(450, 500)).toBe(50);
    expect(charactersLeft(500, 500)).toBe(0);
  });
});

describe('likeCountText', () => {
  it('shows no number for no likes', () => {
    expect(likeCountText(0)).toBe('');
    expect(likeCountText(1)).toBe('1');
    expect(likeCountText(12)).toBe('12');
  });
});

describe('commentListMaxHeight', () => {
  it('uses a little over half the screen when the keyboard is closed', () => {
    expect(commentListMaxHeight(800, 0)).toBe(440);
  });

  it('shrinks to fit above the keyboard on a small screen', () => {
    expect(commentListMaxHeight(800, 300)).toBe(240);
  });

  it('never collapses to nothing', () => {
    expect(commentListMaxHeight(500, 420)).toBe(140);
  });
});
