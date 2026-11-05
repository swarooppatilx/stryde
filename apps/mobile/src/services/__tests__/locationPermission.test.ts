import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FakePlatform, installFakePlatform, uninstallFakePlatform } from '@/platform/fakes';
import { ensureForegroundLocation } from '@/services/locationPermission';

let platform: FakePlatform;

beforeEach(() => {
  platform = installFakePlatform();
});
afterEach(() => uninstallFakePlatform());

describe('ensureForegroundLocation', () => {
  it('does not bother the user when location is already granted', async () => {
    platform.location.permission = { granted: true, canAskAgain: true };

    expect(await ensureForegroundLocation()).toBe(true);
    expect(platform.prompter.prompts).toHaveLength(0);
    expect(platform.location.requestCount).toBe(0);
  });

  it('explains why before the OS prompt, then asks the OS once the user agrees', async () => {
    platform.location.permission = { granted: false, canAskAgain: true };
    platform.location.onRequest = { granted: true, canAskAgain: true };
    platform.prompter.answers = [true];

    expect(await ensureForegroundLocation()).toBe(true);

    expect(platform.prompter.prompts).toHaveLength(1);
    expect(platform.prompter.prompts[0]?.title).toMatch(/location/i);
    expect(platform.location.requestCount).toBe(1);
  });

  it('never shows the OS prompt if the user declines the explanation', async () => {
    platform.location.permission = { granted: false, canAskAgain: true };
    platform.prompter.answers = [false];

    expect(await ensureForegroundLocation()).toBe(false);
    expect(platform.location.requestCount).toBe(0);
  });

  it('reports a denial from the OS prompt', async () => {
    platform.location.permission = { granted: false, canAskAgain: true };
    platform.location.onRequest = { granted: false, canAskAgain: false };
    platform.prompter.answers = [true];

    expect(await ensureForegroundLocation()).toBe(false);
    expect(platform.location.requestCount).toBe(1);
  });

  it('sends the user to Settings once the OS will no longer ask', async () => {
    platform.location.permission = { granted: false, canAskAgain: false };
    platform.prompter.answers = [true];

    expect(await ensureForegroundLocation()).toBe(false);

    expect(platform.location.requestCount).toBe(0);
    expect(platform.location.settingsOpened).toBe(1);
    expect(platform.prompter.prompts[0]?.confirmText).toBe('Open Settings');
  });

  it('leaves Settings alone when the user says not now', async () => {
    platform.location.permission = { granted: false, canAskAgain: false };
    platform.prompter.answers = [false];

    expect(await ensureForegroundLocation()).toBe(false);
    expect(platform.location.settingsOpened).toBe(0);
  });
});

describe('approximate location only', () => {
  it('explains that recording needs precise location, and offers the phone settings', async () => {
    platform.location.permission = { granted: true, canAskAgain: true, precise: false };
    platform.prompter.answers = [true];

    expect(await ensureForegroundLocation()).toBe(false);

    expect(platform.prompter.prompts[0]?.title).toBe('Allow precise location');
    expect(platform.prompter.prompts[0]?.message).toMatch(/approximate/i);
    expect(platform.prompter.prompts[0]?.confirmText).toBe('Open Settings');
    expect(platform.location.settingsOpened).toBe(1);
  });

  it('does not open settings when the athlete says no, and still does not record', async () => {
    platform.location.permission = { granted: true, canAskAgain: true, precise: false };
    platform.prompter.answers = [false];

    expect(await ensureForegroundLocation()).toBe(false);
    expect(platform.location.settingsOpened).toBe(0);
  });

  it('catches an approximate answer given at the OS prompt just now', async () => {
    platform.location.permission = { granted: false, canAskAgain: true };
    platform.location.onRequest = { granted: true, canAskAgain: true, precise: false };
    platform.prompter.answers = [true, false];

    expect(await ensureForegroundLocation()).toBe(false);
    expect(platform.prompter.prompts[1]?.title).toBe('Allow precise location');
  });

  it('treats a permission that says nothing about precision as precise', async () => {
    platform.location.permission = { granted: true, canAskAgain: true };

    expect(await ensureForegroundLocation()).toBe(true);
  });
});
