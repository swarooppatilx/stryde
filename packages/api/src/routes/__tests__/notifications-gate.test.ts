import { describe, expect, it } from 'vitest';
import app from '../../index.js';

// /notifications/push took any Expo token and any text behind only the API key that ships in every
// build, so anyone could push arbitrary notifications to any athlete. The app never called it; pushes
// now go out only from server events (see lib/pushSender.ts). routes/notifications.ts is left unmounted.
describe('the open push relay', () => {
  it('is not served, with or without a key', async () => {
    for (const headers of [{}, { 'x-api-key': 'anything' }] as Record<string, string>[]) {
      const res = await app.request('/api/notifications/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ to: 'ExponentPushToken[whatever]', title: 'x' }),
      });
      expect(res.status).toBe(404);
    }
  });
});
