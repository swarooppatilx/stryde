import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { usePushPrimerStore } = await import('../pushPrimerStore');

beforeEach(() => usePushPrimerStore.setState({ status: 'idle' }));

describe('pushPrimerStore', () => {
  it('becomes due on the first moment', () => {
    usePushPrimerStore.getState().noteMoment();

    expect(usePushPrimerStore.getState().status).toBe('due');
  });

  it('is never due again once answered', () => {
    usePushPrimerStore.getState().noteMoment();
    usePushPrimerStore.getState().answer();
    usePushPrimerStore.getState().noteMoment();

    expect(usePushPrimerStore.getState().status).toBe('answered');
  });
});
