import { describe, expect, it } from 'vitest';
import { type StartGateInput, startGate } from '@/utils/startGate';

const ready: StartGateInput = {
  status: 'idle',
  servicesOn: true,
  permission: { granted: true, precise: true },
  signalLevel: 'good',
};

describe('startGate', () => {
  it('lets a ready phone start', () => {
    expect(startGate(ready)).toBeNull();
    expect(startGate({ ...ready, signalLevel: 'weak' })).toBeNull();
  });

  it('stops when a session already exists, before anything else', () => {
    expect(startGate({ ...ready, status: 'paused', servicesOn: false })).toBe('inProgress');
    expect(startGate({ ...ready, status: 'tracking' })).toBe('inProgress');
  });

  it('names switched-off location services before permission', () => {
    expect(
      startGate({ ...ready, servicesOn: false, permission: { granted: false, canAskAgain: false } })
    ).toBe('servicesOff');
  });

  it('asks for the permission flow when location is denied or only approximate', () => {
    expect(startGate({ ...ready, permission: { granted: false, canAskAgain: false } })).toBe(
      'permissionDenied'
    );
    expect(startGate({ ...ready, permission: { granted: false, canAskAgain: true } })).toBe(
      'permissionDenied'
    );
    expect(startGate({ ...ready, permission: { granted: true, precise: false } })).toBe(
      'approximate'
    );
  });

  it('warns when there is no fix yet or it was lost', () => {
    expect(startGate({ ...ready, signalLevel: 'searching' })).toBe('noSignal');
    expect(startGate({ ...ready, signalLevel: 'lost' })).toBe('noSignal');
  });

  it('treats an unreadable permission as fine', () => {
    expect(startGate({ ...ready, permission: null })).toBeNull();
  });
});
