import { describe, expect, it } from 'vitest';
import { parseJsonParam } from '@/utils/routeParams';

describe('parseJsonParam', () => {
  it('reads a JSON route param', () => {
    expect(parseJsonParam<number[]>('[1,2]', 'splits', [])).toEqual([1, 2]);
  });

  it('gives the fallback when the param is missing', () => {
    expect(parseJsonParam<number[] | undefined>(undefined, 'splits', undefined)).toBeUndefined();
    expect(parseJsonParam<string[]>('', 'photos', [])).toEqual([]);
  });

  it('gives the fallback, instead of crashing the screen, when the param is damaged', () => {
    expect(parseJsonParam<string[]>('[oops', 'photos', [])).toEqual([]);
  });
});
