export const SETUP_STEPS = ['sports', 'goal', 'permissions', 'people'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export interface AccountSetup {
  /** Set when profile setup finishes, so a restart mid-flow comes back to it. */
  started: boolean;
  done: boolean;
  goalChosen: boolean;
  checklistDismissed: boolean;
}

export const EMPTY_ACCOUNT_SETUP: AccountSetup = {
  started: false,
  done: false,
  goalChosen: false,
  checklistDismissed: false,
};

/** Whether this account still has the "Make it yours" flow to go through. Never true for a finished one. */
export function needsSetupFlow(setup: AccountSetup | undefined): boolean {
  return setup?.started === true && !setup.done;
}

export function isSetupStep(value: unknown): value is SetupStep {
  return SETUP_STEPS.includes(value as SetupStep);
}

/** The step after this one, or null when it was the last. */
export function stepAfter(step: SetupStep): SetupStep | null {
  return SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1] ?? null;
}

/** The step before this one, or null at the first; the screen leaves the flow instead. */
export function stepBefore(step: SetupStep): SetupStep | null {
  return SETUP_STEPS[SETUP_STEPS.indexOf(step) - 1] ?? null;
}

/** The first Skip asks once; after a yes the rest of the flow skips without asking again. */
export function shouldConfirmSkip(alreadyConfirmed: boolean): boolean {
  return !alreadyConfirmed;
}

/** Continuing with nobody followed gets one reminder; with no one to suggest there is nothing to remind about. */
export function followNudgeNeeded(state: {
  followingCount: number;
  suggestionCount: number;
  alreadyShown: boolean;
}): boolean {
  return state.followingCount === 0 && state.suggestionCount > 0 && !state.alreadyShown;
}
