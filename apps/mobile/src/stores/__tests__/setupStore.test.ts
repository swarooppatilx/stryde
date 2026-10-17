import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';
import { needsSetupFlow } from '@/utils/setupFlow';

installFakePlatform();
const { useSetupStore, selectAccountSetup } = await import('@/stores/setupStore');

beforeEach(() => {
  installFakePlatform();
  useSetupStore.setState({ accounts: {} }, false);
});

const read = (account: string) => selectAccountSetup(account)(useSetupStore.getState());

describe('setup progress', () => {
  it('shows the flow after begin and never again after finish', () => {
    useSetupStore.getState().begin('0xABC');
    expect(needsSetupFlow(read('0xabc'))).toBe(true);
    useSetupStore.getState().finish('0xabc');
    expect(needsSetupFlow(read('0xABC'))).toBe(false);
    useSetupStore.getState().begin('0xabc');
    expect(needsSetupFlow(read('0xabc'))).toBe(false);
  });

  it('keeps accounts apart', () => {
    useSetupStore.getState().begin('0x1');
    expect(needsSetupFlow(read('0x2'))).toBe(false);
  });

  it('remembers the goal and the dismissed card per account', () => {
    useSetupStore.getState().markGoalChosen('0x1');
    useSetupStore.getState().dismissChecklist('0x1');
    expect(read('0x1')).toMatchObject({ goalChosen: true, checklistDismissed: true });
    expect(read('0x2')).toMatchObject({ goalChosen: false, checklistDismissed: false });
  });
});
