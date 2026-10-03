import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useProfileStore } from '@/stores/profileStore';
import { chainScopedStorageAdapter } from '@/utils/storage';
import { findPersona } from './personas';

interface DevSessionState {
  personaId: string | null;
}

/** Who is signed in as a developer persona. Saved per profile, like the rest of the app's data. */
export const useDevSession = create<DevSessionState>()(
  persist<DevSessionState>(() => ({ personaId: null as string | null }), {
    name: '@stryde/dev-session',
    storage: createJSONStorage(() => chainScopedStorageAdapter),
  })
);

/** Signs in as a persona and gives the app that athlete's profile (or a blank one for a new athlete). */
export function signInAs(personaId: string): void {
  const persona = findPersona(personaId);
  if (!persona) return;
  const profile = useProfileStore.getState();
  profile.reset();
  if (persona.profile) {
    profile.setUsername(persona.profile.username);
    profile.setFirstName(persona.profile.firstName);
    profile.setLastName(persona.profile.lastName);
    profile.setProfileId(persona.id);
  }
  useDevSession.setState({ personaId });
}

export function signOutDev(): void {
  useProfileStore.getState().reset();
  useDevSession.setState({ personaId: null });
}
