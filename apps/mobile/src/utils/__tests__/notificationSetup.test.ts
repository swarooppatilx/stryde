import { describe, expect, it } from 'vitest';
import { notificationSetupAction } from '@/utils/notificationSetup';

describe('notificationSetupAction', () => {
  it('asks while the phone has not been asked', () => {
    expect(notificationSetupAction('undetermined')).toBe('ask');
  });

  it('sends a person who said no to the settings page, where the system prompt cannot return', () => {
    expect(notificationSetupAction('denied')).toBe('open-settings');
  });

  it('offers nothing once allowed', () => {
    expect(notificationSetupAction('granted')).toBe('none');
  });

  it('still lets a person try when the permission could not be read', () => {
    expect(notificationSetupAction(null)).toBe('ask');
  });
});
