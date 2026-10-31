import { describe, expect, it } from 'vitest';
import { canonicalPath } from '@/utils/linkPaths';

describe('canonicalPath: clean links pass through untouched', () => {
  it.each([
    ['/activities/42', '/activities/42'],
    ['/athletes/0xabc', '/athletes/0xabc'],
    ['/clubs/7', '/clubs/7'],
    ['/events/9', '/events/9'],
    ['/challenges/3', '/challenges/3'],
    ['/routes/r1', '/routes/r1'],
    ['/badges/first_activity', '/badges/first_activity'],
    ['/verify', '/verify'],
    ['/', '/'],
  ])('%s', (input, expected) => {
    expect(canonicalPath(input)).toBe(expected);
  });
});

describe('canonicalPath: links shared before the rename keep working', () => {
  it.each([
    ['/activity-summary?id=42', '/activities/42'],
    ['/user-profile?id=0xabc', '/athletes/0xabc'],
    ['/club-detail?id=7', '/clubs/7'],
    ['/event-detail?id=9', '/events/9'],
    ['/challenge-detail?id=3', '/challenges/3'],
    ['/route-detail?id=r1', '/routes/r1'],
    ['/badge-detail?id=first_activity', '/badges/first_activity'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalPath(input)).toBe(expected);
  });

  it('accepts the whole link, whatever scheme it arrived with', () => {
    expect(canonicalPath('strydeexpo://activity-summary?id=42')).toBe('/activities/42');
    expect(canonicalPath('stryde://activity-summary?id=42')).toBe('/activities/42');
    expect(canonicalPath('exp+stryde-expo://user-profile?id=0xabc')).toBe('/athletes/0xabc');
  });

  it('turns a clean custom-scheme link into a path (the first segment is parsed as a host)', () => {
    expect(canonicalPath('stryde://activities/42')).toBe('/activities/42');
    expect(canonicalPath('stryde://athletes/0xabc')).toBe('/athletes/0xabc');
    expect(canonicalPath('stryde://record')).toBe('/tracking');
  });

  it('keeps other query parameters on a rewritten link', () => {
    expect(canonicalPath('/activity-summary?id=42&photo=2')).toBe('/activities/42?photo=2');
  });

  it('decodes an id once and encodes it once, so an address with odd characters survives', () => {
    expect(canonicalPath('/user-profile?id=a%2Fb')).toBe('/athletes/a%2Fb');
  });

  it('leaves an old-style link with no id alone rather than inventing one', () => {
    expect(canonicalPath('/activity-summary')).toBe('/activity-summary');
  });
});

describe('canonicalPath: friendly aliases a reference-style link may use', () => {
  it.each([
    ['/dashboard', '/'],
    ['/home', '/'],
    ['/record', '/tracking'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalPath(input)).toBe(expected);
  });
});

describe('canonicalPath: web links on our own host use the same paths', () => {
  it('drops the scheme and host of an https link', () => {
    expect(canonicalPath('https://stryde.app/activities/42')).toBe('/activities/42');
    expect(canonicalPath('https://www.stryde.app/athletes/0xabc')).toBe('/athletes/0xabc');
  });

  it('still rewrites an old-style https link', () => {
    expect(canonicalPath('https://stryde.app/activity-summary?id=42')).toBe('/activities/42');
  });
});
