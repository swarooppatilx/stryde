import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { type AccountSetup, EMPTY_ACCOUNT_SETUP } from '@/utils/setupFlow';
import { asyncStorageAdapter } from '@/utils/storage';

interface SetupState {
  /** Keyed by lower-cased account id. Kept across sign-out so a returning person is not asked again. */
  accounts: Record<string, AccountSetup>;
  begin: (account: string) => void;
  finish: (account: string) => void;
  markGoalChosen: (account: string) => void;
  dismissChecklist: (account: string) => void;
}

const keyOf = (account: string) => account.toLowerCase();

function patch(
  state: SetupState,
  account: string,
  changes: Partial<AccountSetup>
): Pick<SetupState, 'accounts'> {
  const key = keyOf(account);
  return {
    accounts: {
      ...state.accounts,
      [key]: { ...EMPTY_ACCOUNT_SETUP, ...state.accounts[key], ...changes },
    },
  };
}

export const useSetupStore = create<SetupState>()(
  persist(
    (set) => ({
      accounts: {},
      begin: (account) =>
        set((state) =>
          state.accounts[keyOf(account)]?.done ? state : patch(state, account, { started: true })
        ),
      finish: (account) => set((state) => patch(state, account, { started: true, done: true })),
      markGoalChosen: (account) => set((state) => patch(state, account, { goalChosen: true })),
      dismissChecklist: (account) =>
        set((state) => patch(state, account, { checklistDismissed: true })),
    }),
    {
      name: '@stryde/setup',
      version: 1,
      storage: createJSONStorage(() => asyncStorageAdapter),
    }
  )
);

/** This account's progress through setup; the empty record when it has none yet. */
export function selectAccountSetup(account: string) {
  return (state: SetupState): AccountSetup => state.accounts[keyOf(account)] ?? EMPTY_ACCOUNT_SETUP;
}
