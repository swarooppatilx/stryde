import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS } from '@/constants/copy';
import { deleteDataMessage } from '@/utils/deleteDataWarning';

describe('deleteDataMessage', () => {
  it('says nothing about pending work when there is none', () => {
    const message = deleteDataMessage(0, 0);
    expect(message).not.toContain('been sent');
    expect(message).not.toContain('for good');
    expect(message).toContain('Anything already saved to the public record cannot be erased.');
  });

  it('names both counts', () => {
    expect(deleteDataMessage(3, 1)).toContain(
      "3 changes haven't been sent yet and 1 activity isn't saved to the chain. Deleting removes them for good."
    );
  });

  it('uses the singular for one change', () => {
    expect(deleteDataMessage(1, 0)).toContain("1 change hasn't been sent yet. Deleting removes");
  });

  it('names only the activities when no change is queued', () => {
    const message = deleteDataMessage(0, 2);
    expect(message).toContain("2 activities aren't saved to the chain. Deleting removes");
    expect(message).not.toContain('change');
  });

  it('never leaks the plumbing, whatever is pending', () => {
    for (const [changes, activities] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [3, 2],
    ] as const) {
      expect(deleteDataMessage(changes, activities)).not.toMatch(BANNED_USER_WORDS);
    }
  });
});
