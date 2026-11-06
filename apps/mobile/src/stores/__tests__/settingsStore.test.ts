import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';
import { DEFAULT_LIVE_STAT_SLOTS } from '@/utils/liveStats';

installFakePlatform();
const { useSettingsStore } = await import('@/stores/settingsStore');

const initial = useSettingsStore.getState();
const migrate = (state: Record<string, unknown>, version: number) =>
  useSettingsStore.persist.getOptions().migrate?.(state, version);

beforeEach(() => {
  installFakePlatform();
  useSettingsStore.setState(initial, true);
});

describe('settings defaults', () => {
  it('start with auto-pause on, best accuracy (1 s fixes) and the route fully public', () => {
    expect(useSettingsStore.getState()).toMatchObject({
      autoPause: true,
      accuracyMode: 'best',
      hideRouteEnds: false,
      useGyroscopeAssist: true,
      countdownSeconds: 3,
    });
  });

  it('start with rides pausing by themselves and runs not', () => {
    expect(useSettingsStore.getState()).toMatchObject({ autoPause: true, autoPauseOnFoot: false });
  });

  it('no longer keeps a sensor rate', () => {
    expect(useSettingsStore.getState()).not.toHaveProperty('sensorUpdateRate');
  });
});

describe('reset', () => {
  it('puts tracking preferences back but remembers the person has seen onboarding', () => {
    const settings = useSettingsStore.getState();
    settings.setHasOnboarded();
    settings.setAccuracyMode('best');
    settings.setAutoPause(false);

    settings.reset();

    const after = useSettingsStore.getState();
    expect(after.accuracyMode).toBe('best');
    expect(after.autoPause).toBe(true);
    // Signing out must land a returning user on /login, not the first-run carousel.
    expect(after.hasOnboarded).toBe(true);
  });
});

describe('migrating older saved settings', () => {
  it('fills in everything a v0 install never stored', () => {
    expect(migrate({ hasOnboarded: true }, 0)).toMatchObject({
      hasOnboarded: true,
      useGyroscopeAssist: true,
      autoPause: true,
      accuracyMode: 'best',
    });
  });

  it('keeps a v1 choice to turn gyroscope assist off', () => {
    expect(migrate({ useGyroscopeAssist: false }, 1)).toMatchObject({
      useGyroscopeAssist: false,
      autoPause: true,
      accuracyMode: 'best',
    });
  });

  it('gives people who already had settings the default countdown, and keeps their other choices', () => {
    expect(migrate({ accuracyMode: 'best', autoPause: false }, 3)).toMatchObject({
      accuracyMode: 'best',
      autoPause: false,
      countdownSeconds: 3,
    });
  });

  it('moves the old forced "balanced" default to best, since 3 s fixes gave poorer distance and pace', () => {
    expect(migrate({ accuracyMode: 'balanced', countdownSeconds: 3 }, 4)).toMatchObject({
      accuracyMode: 'best',
      countdownSeconds: 3,
    });
  });

  it('keeps a deliberate low-power choice', () => {
    expect(migrate({ accuracyMode: 'power', countdownSeconds: 3 }, 4)).toMatchObject({
      accuracyMode: 'power',
      countdownSeconds: 3,
    });
  });

  it('leaves current-version settings as they were', () => {
    const saved = { accuracyMode: 'balanced', countdownSeconds: 0 };
    expect(migrate(saved, useSettingsStore.persist.getOptions().version ?? 0)).toEqual(saved);
  });

  it('turns the old audio cue switch into how often: on is every whole unit, off stays off', () => {
    const wasOn = migrate({ audioCues: true, autoPauseOnFoot: true }, 6);
    expect(wasOn).toMatchObject({ autoPauseOnFoot: true, audioCueInterval: 'unit' });
    expect(wasOn).not.toHaveProperty('audioCues');
    expect(migrate({ audioCues: false }, 6)).toMatchObject({ audioCueInterval: 'off' });
    expect(migrate({}, 6)).toMatchObject({ audioCueInterval: 'off' });
  });

  it('gives an install from before the stats could be chosen the Record screen it knew', () => {
    expect(migrate({ autoPause: true }, 7)).toMatchObject({
      autoPause: true,
      liveStatSlots: DEFAULT_LIVE_STAT_SLOTS,
    });
  });

  it('repairs a saved stats layout with unknown or unsuitable fields, slot by slot', () => {
    const migrated = migrate({ liveStatSlots: { pace: ['laps', 'avgSpeed'], speed: 7 } }, 7);
    expect(migrated).toMatchObject({
      liveStatSlots: {
        pace: ['laps', 'avgPace', 'distance', 'territory', 'currentPace', 'climb'],
        speed: DEFAULT_LIVE_STAT_SLOTS.speed,
      },
    });
  });

  it('carries the one auto-pause switch over to runs, walks and hikes', () => {
    expect(migrate({ autoPause: false }, 5)).toMatchObject({
      autoPause: false,
      autoPauseOnFoot: false,
    });
    expect(migrate({ autoPause: true }, 5)).toMatchObject({
      autoPause: true,
      autoPauseOnFoot: true,
    });
  });
});

describe('keep screen on', () => {
  it('is on until the athlete turns it off, and resets to on', () => {
    expect(useSettingsStore.getState().keepScreenOn).toBe(true);

    useSettingsStore.getState().setKeepScreenOn(false);
    expect(useSettingsStore.getState().keepScreenOn).toBe(false);

    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().keepScreenOn).toBe(true);
  });
});

describe('spoken actions', () => {
  it('are off until the athlete turns them on, and reset to off', () => {
    expect(useSettingsStore.getState().announceActions).toBe(false);

    useSettingsStore.getState().setAnnounceActions(true);
    expect(useSettingsStore.getState().announceActions).toBe(true);

    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().announceActions).toBe(false);
  });
});

describe('audio cues', () => {
  it('are off until the athlete picks how often to hear them', () => {
    expect(useSettingsStore.getState().audioCueInterval).toBe('off');

    useSettingsStore.getState().setAudioCueInterval('half');

    expect(useSettingsStore.getState().audioCueInterval).toBe('half');
  });

  it('survive a reset to defaults as off', () => {
    useSettingsStore.getState().setAudioCueInterval('unit');

    useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().audioCueInterval).toBe('off');
  });
});

describe('default activity visibility', () => {
  it("starts as everyone and remembers the athlete's choice", () => {
    expect(useSettingsStore.getState().defaultPrivacy).toBe('everyone');

    useSettingsStore.getState().setDefaultPrivacy('followers');

    expect(useSettingsStore.getState().defaultPrivacy).toBe('followers');
  });
});

describe('privacy zones', () => {
  const home = { name: ' Home ', latitude: 18.52, longitude: 73.85, radius: 400 };

  it('starts with none', () => {
    expect(useSettingsStore.getState().privacyZones).toEqual([]);
  });

  it('adds a place under a trimmed name and gives it an id', () => {
    const zone = useSettingsStore.getState().addPrivacyZone(home);

    expect(zone).toMatchObject({ name: 'Home', latitude: 18.52, longitude: 73.85, radius: 400 });
    expect(zone.id).toBeTruthy();
    expect(useSettingsStore.getState().privacyZones).toEqual([zone]);
  });

  it('removes a place by id', () => {
    const zone = useSettingsStore.getState().addPrivacyZone(home);

    useSettingsStore.getState().removePrivacyZone(zone.id);

    expect(useSettingsStore.getState().privacyZones).toEqual([]);
  });

  it('keeps at most ten, so the list stays something a person manages', () => {
    for (let i = 0; i < 12; i++)
      useSettingsStore.getState().addPrivacyZone({ ...home, name: `P${i}` });

    expect(useSettingsStore.getState().privacyZones).toHaveLength(10);
  });

  it('is cleared when the account is reset', () => {
    useSettingsStore.getState().addPrivacyZone(home);

    useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().privacyZones).toEqual([]);
  });
});

describe('start tab', () => {
  it('opens on Home until the athlete picks another tab, and remembers it', () => {
    expect(useSettingsStore.getState().startTab).toBe('index');

    useSettingsStore.getState().setStartTab('tracking');

    expect(useSettingsStore.getState().startTab).toBe('tracking');
  });
});

describe('motion preference', () => {
  it('follows the phone until the athlete chooses Reduced, and remembers it', () => {
    expect(useSettingsStore.getState().motion).toBe('auto');

    useSettingsStore.getState().setMotion('reduced');

    expect(useSettingsStore.getState().motion).toBe('reduced');
  });
});

describe('live stat slots', () => {
  it('start as the screen always was, and remember a choice per sport family', () => {
    expect(useSettingsStore.getState().liveStatSlots).toEqual(DEFAULT_LIVE_STAT_SLOTS);

    useSettingsStore.getState().setLiveStatSlot('speed', 4, 'lastLapSpeed');

    const slots = useSettingsStore.getState().liveStatSlots;
    expect(slots.speed[4]).toBe('lastLapSpeed');
    expect(slots.pace).toEqual(DEFAULT_LIVE_STAT_SLOTS.pace);
  });

  it('go back to the defaults on reset', () => {
    useSettingsStore.getState().setLiveStatSlot('pace', 0, 'laps');

    useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().liveStatSlots).toEqual(DEFAULT_LIVE_STAT_SLOTS);
  });
});

describe('migrating to the recording settings screen', () => {
  it('drops the sensor rate', () => {
    const migrated = migrate({ sensorUpdateRate: 50, keepScreenOn: false }, 8);
    expect(migrated).not.toHaveProperty('sensorUpdateRate');
    expect(migrated).toMatchObject({ keepScreenOn: false });
  });

  it('leaves auto-pause for runs as the person had it', () => {
    expect(migrate({ autoPauseOnFoot: true }, 8)).toMatchObject({ autoPauseOnFoot: true });
  });
});

describe('preferred sports', () => {
  it('start empty and keep the order picked, dropping unknown sports', () => {
    expect(useSettingsStore.getState().preferredSports).toEqual([]);
    useSettingsStore.getState().setPreferredSports(['swim', 'run']);
    expect(useSettingsStore.getState().preferredSports).toEqual(['swim', 'run']);
  });

  it('are added empty when an older install is upgraded', () => {
    expect(migrate({ autoPause: true }, 9)).toMatchObject({ preferredSports: [] });
  });

  it('are on version 13', () => {
    expect(useSettingsStore.persist.getOptions().version).toBe(13);
  });
});

describe('save-form defaults', () => {
  it('start with nothing hidden, the route shown and the activity in feeds', () => {
    expect(useSettingsStore.getState()).toMatchObject({
      defaultHideRoute: false,
      defaultHiddenStats: [],
      defaultMutedFromFeeds: false,
    });
  });

  it('adds and removes a default hidden figure without repeats', () => {
    const { setDefaultHiddenStat } = useSettingsStore.getState();
    setDefaultHiddenStat('pace', true);
    setDefaultHiddenStat('pace', true);
    setDefaultHiddenStat('start_time', true);
    expect(useSettingsStore.getState().defaultHiddenStats).toEqual(['start_time', 'pace']);
    setDefaultHiddenStat('pace', false);
    expect(useSettingsStore.getState().defaultHiddenStats).toEqual(['start_time']);
  });

  it('is cleared with the rest on reset', () => {
    useSettingsStore.getState().setDefaultMutedFromFeeds(true);
    useSettingsStore.getState().setDefaultHideRoute(true);
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState()).toMatchObject({
      defaultMutedFromFeeds: false,
      defaultHideRoute: false,
    });
  });
});

describe('migrating to the save-form defaults', () => {
  it('adds the three defaults, off, and keeps what was saved', () => {
    expect(migrate({ hideRouteEnds: true, defaultPrivacy: 'followers' }, 12)).toEqual({
      hideRouteEnds: true,
      defaultPrivacy: 'followers',
      defaultHideRoute: false,
      defaultHiddenStats: [],
      defaultMutedFromFeeds: false,
    });
  });

  it('adds them when migrating from much older versions too', () => {
    expect(migrate({}, 0)).toMatchObject({
      defaultHideRoute: false,
      defaultHiddenStats: [],
      defaultMutedFromFeeds: false,
    });
  });
});
