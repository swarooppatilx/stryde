import { describe, expect, it } from 'vitest';
import { getT } from '@/i18n';
import {
  notificationPermissionLabel,
  notificationsSummary,
  preferencesSummary,
  privacySummary,
  privateZonesSummary,
  recordingSummary,
} from '@/utils/settingsSummary';

describe('settings summaries', () => {
  it('names the phone permission state', () => {
    expect(notificationPermissionLabel(true)).toBe('On');
    expect(notificationPermissionLabel(false)).toBe('Off in phone settings');
    expect(notificationPermissionLabel(null)).toBe('Not available');
  });

  it('summarises the notification row', () => {
    expect(notificationsSummary(true, 13, 13)).toBe('On · all 13 types');
    expect(notificationsSummary(true, 9, 13)).toBe('On · 9 of 13 types');
    expect(notificationsSummary(false, 13, 13)).toBe('Off in phone settings · all 13 types');
  });

  it('summarises preferences', () => {
    expect(preferencesSummary({ theme: 'system', units: 'metric', weekStartsOn: 1 })).toBe(
      'Auto · Metric · Monday'
    );
    expect(preferencesSummary({ theme: 'dark', units: 'imperial', weekStartsOn: 0 })).toBe(
      'Dark · Imperial · Sunday'
    );
  });

  it('summarises private places and privacy', () => {
    expect(privateZonesSummary(0)).toBe('None');
    expect(privateZonesSummary(1)).toBe('1 place');
    expect(privateZonesSummary(3)).toBe('3 places');
    expect(privacySummary('followers', 2)).toBe('Followers · 2 places');
    expect(privacySummary('only_me', 0)).toBe('Only Me · no private places');
  });

  it('summarises recording', () => {
    expect(
      recordingSummary({
        autoPause: true,
        autoPauseOnFoot: false,
        countdownSeconds: 3,
        accuracyLabel: 'Best',
      })
    ).toBe('Auto-pause on · 3 s countdown · GPS best');
    expect(
      recordingSummary({
        autoPause: false,
        autoPauseOnFoot: false,
        countdownSeconds: 0,
        accuracyLabel: 'Low-power',
      })
    ).toBe('Auto-pause off · no countdown · GPS low-power');
  });
});

describe('settings summaries in Hindi', () => {
  const hiT = getT('hi');

  it('translate the rows and keep the plural forms', () => {
    expect(privateZonesSummary(0, hiT)).toBe('कोई नहीं');
    expect(privateZonesSummary(1, hiT)).toBe('1 जगह');
    expect(privateZonesSummary(2, hiT)).toBe('2 जगहें');
    expect(notificationsSummary(false, 9, 13, hiT)).toBe('फ़ोन की सेटिंग में बंद · 13 में से 9 तरह की');
  });

  it('names the language in the preferences summary', () => {
    expect(
      preferencesSummary({ theme: 'dark', units: 'metric', weekStartsOn: 1, language: 'hi' })
    ).toBe('Dark · Metric · Monday · हिन्दी');
    expect(preferencesSummary({ theme: 'dark', units: 'metric', weekStartsOn: 1 })).toBe(
      'Dark · Metric · Monday'
    );
  });
});
