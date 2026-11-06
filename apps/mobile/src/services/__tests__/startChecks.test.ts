import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';
import { confirmStart, resetBatterySaverChoice } from '@/services/startChecks';
import { useAlertStore } from '@/stores/alertStore';

let platform: ReturnType<typeof installFakePlatform>;

beforeEach(() => {
  platform = installFakePlatform();
  useAlertStore.getState().hide();
  resetBatterySaverChoice();
});

const idle = { status: 'idle', signalLevel: 'good' } as const;

/** What the athlete sees: the open dialog's text and the buttons they can press. */
const dialog = () => useAlertStore.getState();
const press = (label: string) => {
  const button = dialog().buttons.find((b) => b.text === label);
  if (!button)
    throw new Error(`No "${label}" button; there is ${dialog().buttons.map((b) => b.text)}`);
  button.onPress?.();
  useAlertStore.getState().hide();
};
const dismiss = () => {
  dialog().onDismiss?.();
  useAlertStore.getState().hide();
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('confirmStart', () => {
  it('lets a run start when location is on, allowed and has a signal, with no dialog', async () => {
    expect(await confirmStart(idle)).toBe(true);
    expect(dialog().visible).toBe(false);
  });

  it('refuses to start a second recording and says why', async () => {
    const result = await confirmStart({ status: 'tracking', signalLevel: 'good' });

    expect(result).toBe(false);
    expect(dialog().visible).toBe(true);
    expect(dialog().title).toMatch(/in progress/i);
  });

  it('does not block when the phone cannot say whether location is allowed', async () => {
    platform.location.getPermission = async () => {
      throw new Error('unavailable');
    };

    expect(await confirmStart(idle)).toBe(true);
  });

  describe('location services switched off', () => {
    it('opens the phone settings when the athlete agrees, and still does not start', async () => {
      platform.location.servicesOn = false;

      const result = confirmStart(idle);
      await settle();
      expect(dialog().title).toMatch(/location services are off/i);
      press('Open settings');

      expect(await result).toBe(false);
      expect(platform.location.settingsOpened).toBe(1);
    });

    it('leaves the settings alone when the athlete cancels', async () => {
      platform.location.servicesOn = false;

      const result = confirmStart(idle);
      await settle();
      press('Cancel');

      expect(await result).toBe(false);
      expect(platform.location.settingsOpened).toBe(0);
    });

    it('treats a dismissed dialog as a cancel', async () => {
      platform.location.servicesOn = false;

      const result = confirmStart(idle);
      await settle();
      dismiss();

      expect(await result).toBe(false);
      expect(platform.location.settingsOpened).toBe(0);
    });
  });

  describe('no GPS fix yet', () => {
    it('lets the athlete start anyway when they choose Continue', async () => {
      const result = confirmStart({ status: 'idle', signalLevel: 'searching' });
      await settle();
      expect(dialog().title).toMatch(/no gps signal/i);
      press('Continue');

      expect(await result).toBe(true);
    });

    it('waits for a signal when the athlete chooses Wait', async () => {
      const result = confirmStart({ status: 'idle', signalLevel: 'lost' });
      await settle();
      press('Wait');

      expect(await result).toBe(false);
    });
  });

  describe('location not allowed', () => {
    it('explains and opens settings when the phone will no longer ask', async () => {
      platform.location.permission = { granted: false, canAskAgain: false };
      platform.prompter.answers.push(true);

      expect(await confirmStart(idle)).toBe(false);
      expect(platform.location.settingsOpened).toBe(1);
    });

    it('does not start on approximate-only location, which is too coarse to record a route', async () => {
      platform.location.permission = { granted: true, canAskAgain: true, precise: false };

      expect(await confirmStart(idle)).toBe(false);
    });
  });
});

describe('confirmStart in battery saver', () => {
  it('asks plainly and starts on Continue', async () => {
    platform.battery.set({ lowPowerMode: true });
    const result = confirmStart(idle);
    await settle();

    expect(dialog().message).toBe(
      'Battery saver is on. It can make your route less exact. Continue anyway?'
    );
    press('Continue');
    expect(await result).toBe(true);
  });

  it('does not ask a second time once the athlete continued', async () => {
    platform.battery.set({ lowPowerMode: true });
    const first = confirmStart(idle);
    await settle();
    press('Continue');
    await first;

    expect(await confirmStart(idle)).toBe(true);
    expect(dialog().visible).toBe(false);
  });

  it('opens the phone settings and does not start', async () => {
    platform.battery.set({ lowPowerMode: true });
    const result = confirmStart(idle);
    await settle();
    press('Open phone settings');

    expect(await result).toBe(false);
    expect(platform.readiness.appSettingsOpened).toBe(1);
  });

  it('does not start when dismissed', async () => {
    platform.battery.set({ lowPowerMode: true });
    const result = confirmStart(idle);
    await settle();
    dismiss();

    expect(await result).toBe(false);
  });

  it('stays quiet when battery saver is off', async () => {
    expect(await confirmStart(idle)).toBe(true);
    expect(dialog().visible).toBe(false);
  });
});
