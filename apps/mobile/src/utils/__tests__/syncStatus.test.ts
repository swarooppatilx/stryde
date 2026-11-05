import { describe, expect, it } from 'vitest';
import { MAX_AUTO_ATTEMPTS } from '@/utils/syncSchedule';
import { syncStatusText } from '@/utils/syncStatus';

describe('syncStatusText', () => {
  it('says the activity is saved on this device before any automatic try', () => {
    expect(syncStatusText(undefined)).toMatch(/saved on this device/i);
  });

  it('says it will try again on its own after a failure', () => {
    expect(syncStatusText({ attempts: 2 })).toMatch(/again automatically/i);
  });

  it('hands over to the athlete once the automatic tries run out', () => {
    expect(syncStatusText({ attempts: MAX_AUTO_ATTEMPTS })).toMatch(/retry when you/i);
  });
});
