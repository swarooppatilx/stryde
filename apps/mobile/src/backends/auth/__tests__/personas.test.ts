import { describe, expect, it } from 'vitest';
import { findPersona, PERSONAS } from '@/backends/auth/personas';

describe('PERSONAS', () => {
  it('has unique ids and something to show for each', () => {
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const persona of PERSONAS) {
      expect(persona.label.length).toBeGreaterThan(0);
      expect(persona.description.length).toBeGreaterThan(0);
    }
  });

  it('offers a brand-new athlete (no profile) to walk through sign-up', () => {
    expect(PERSONAS.some((p) => p.profile === null)).toBe(true);
  });

  it('gives every set-up athlete a valid username', async () => {
    const { validateUsername } = await import('@/utils/username');
    for (const persona of PERSONAS) {
      if (persona.profile) expect(validateUsername(persona.profile.username).ok).toBe(true);
    }
  });
});

describe('findPersona', () => {
  it('finds one by id, and nothing for an unknown id', () => {
    const first = PERSONAS[0];
    expect(first && findPersona(first.id)).toBe(first);
    expect(findPersona('nobody')).toBeUndefined();
  });
});
