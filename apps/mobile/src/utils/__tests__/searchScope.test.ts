import { describe, expect, it } from 'vitest';
import { resultLimit, scopeShows } from '@/utils/searchScope';

describe('scopeShows', () => {
  it('shows everything under All', () => {
    expect(scopeShows('all', 'people')).toBe(true);
    expect(scopeShows('all', 'activities')).toBe(true);
  });

  it('shows only the chosen kind otherwise', () => {
    expect(scopeShows('people', 'people')).toBe(true);
    expect(scopeShows('people', 'activities')).toBe(false);
    expect(scopeShows('activities', 'people')).toBe(false);
    expect(scopeShows('activities', 'activities')).toBe(true);
  });
});

describe('clubs and events scopes', () => {
  it('show only their own kind, and everything shows under All', () => {
    expect(scopeShows('clubs', 'clubs')).toBe(true);
    expect(scopeShows('clubs', 'events')).toBe(false);
    expect(scopeShows('events', 'people')).toBe(false);
    expect(scopeShows('all', 'clubs')).toBe(true);
    expect(scopeShows('all', 'events')).toBe(true);
  });
});

describe('resultLimit', () => {
  it('previews a few under All and lists everything under its own scope', () => {
    expect(resultLimit('all', 3)).toBe(3);
    expect(resultLimit('clubs', 3)).toBe(Number.POSITIVE_INFINITY);
  });
});
