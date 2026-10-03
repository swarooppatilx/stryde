export interface Persona {
  id: string;
  label: string;
  description: string;
  /** The profile this athlete already has, or null to start from sign-up. */
  profile: { username: string; firstName: string; lastName: string } | null;
}

/** Developer logins: stand-ins for real accounts, so the app can be used without a sign-in service. */
export const PERSONAS: readonly Persona[] = [
  {
    id: 'new',
    label: 'New athlete',
    description: 'No profile yet. Walk through sign-up and profile setup.',
    profile: null,
  },
  {
    id: 'dhanya',
    label: 'Dhanya, runner',
    description: 'A set-up profile, ready to record and post.',
    profile: { username: 'dhanya_runs', firstName: 'Dhanya', lastName: 'Nair' },
  },
  {
    id: 'aadhira',
    label: 'Aadhira, cyclist',
    description: 'A second set-up profile, for trying follows and comments between two athletes.',
    profile: { username: 'aadhira_rides', firstName: 'Aadhira', lastName: 'Reddy' },
  },
];

export const findPersona = (id: string): Persona | undefined => PERSONAS.find((p) => p.id === id);
