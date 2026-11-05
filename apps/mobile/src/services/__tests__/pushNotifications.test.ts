import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePlatform, type FakePlatform } from '@/platform/fakes';
import { createPushNotifications, PUSH_TOKEN_KEY } from '../pushNotifications';

let platform: FakePlatform;
const enqueueRegister = vi.fn(async () => {});
const unregisterNow = vi.fn(async () => {});
const build = () => createPushNotifications({ platform, enqueueRegister, unregisterNow });

beforeEach(() => {
  platform = createFakePlatform();
  enqueueRegister.mockClear();
  unregisterNow.mockClear();
  unregisterNow.mockImplementation(async () => {});
});

describe('register', () => {
  it('does nothing, and never prompts, until notifications are allowed', async () => {
    expect(await build().register()).toBe('no-permission');
    expect(platform.push.prompts).toBe(0);
    expect(enqueueRegister).not.toHaveBeenCalled();
  });

  it('queues the token with the platform once allowed, and remembers it', async () => {
    platform.push.permission = 'granted';

    expect(await build().register()).toBe('registered');
    expect(enqueueRegister).toHaveBeenCalledWith({
      token: 'ExponentPushToken[fake]',
      platform: 'android',
    });
    expect(await platform.storage.getItem(PUSH_TOKEN_KEY)).toBe('ExponentPushToken[fake]');
    expect(platform.push.channelSetups).toBe(1);
  });

  it('is unavailable without an EAS project, as in Sandbox or plain development', async () => {
    platform.push.permission = 'granted';
    platform.push.project = null;

    expect(await build().register()).toBe('unavailable');
    expect(enqueueRegister).not.toHaveBeenCalled();
  });

  it('is unavailable when the phone gives no token', async () => {
    platform.push.permission = 'granted';
    platform.push.token = null;

    expect(await build().register()).toBe('unavailable');
  });
});

describe('enable', () => {
  it('asks once and registers on yes', async () => {
    expect(await build().enable()).toBe('granted');
    expect(platform.push.prompts).toBe(1);
    expect(enqueueRegister).toHaveBeenCalledTimes(1);
  });

  it('registers nothing on no', async () => {
    platform.push.promptAnswer = 'denied';

    expect(await build().enable()).toBe('denied');
    expect(enqueueRegister).not.toHaveBeenCalled();
  });

  it('does not prompt again once the system has an answer', async () => {
    platform.push.permission = 'denied';

    await build().enable();

    expect(platform.push.prompts).toBe(0);
  });
});

describe('unregister', () => {
  it('tells the server and forgets the token', async () => {
    platform.push.permission = 'granted';
    const service = build();
    await service.register();

    await service.unregister();

    expect(unregisterNow).toHaveBeenCalledWith({
      token: 'ExponentPushToken[fake]',
      platform: 'android',
    });
    expect(await platform.storage.getItem(PUSH_TOKEN_KEY)).toBeNull();
  });

  it('does nothing when no token was ever registered', async () => {
    await build().unregister();

    expect(unregisterNow).not.toHaveBeenCalled();
  });

  it('does not throw when the server cannot be reached', async () => {
    platform.push.permission = 'granted';
    const service = build();
    await service.register();
    unregisterNow.mockRejectedValue(new Error('offline'));

    await expect(service.unregister()).resolves.toBeUndefined();
  });
});

describe('start', () => {
  it('opens the screen a tapped notification points to', () => {
    const open = vi.fn();
    build().start(open);

    platform.push.tap({ kind: 'newFollower', id: '0xabc' });
    platform.push.tap({ kind: 'weeklySummary' });
    platform.push.tap('junk');

    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({ pathname: '/athletes/[id]', params: { id: '0xabc' } });
  });

  it('opens the screen of the notification that launched the app', async () => {
    platform.push.launchTap = { kind: 'kudos', id: 'a1' };
    const open = vi.fn();
    build().start(open);
    await Promise.resolve();
    await Promise.resolve();

    expect(open).toHaveBeenCalledWith({ pathname: '/activities/[id]', params: { id: 'a1' } });
  });

  it('stops listening when stopped', () => {
    const open = vi.fn();
    const stop = build().start(open);
    stop();

    platform.push.tap({ kind: 'kudos', id: 'a1' });

    expect(open).not.toHaveBeenCalled();
  });

  it('lets a kind the athlete left on show while the app is open', () => {
    build().start(vi.fn());

    expect(platform.push.filter({ kind: 'kudos' })).toBe(true);
  });
});
