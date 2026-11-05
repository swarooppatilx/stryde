import { describe, expect, it } from 'vitest';
import { visibleComments } from '@/utils/visibleComments';

const c = (id: string, userId: string) => ({ id, userId });
const all = [c('1', '0xAA'), c('2', '0xbb'), c('3', '0xcc')];

describe('visibleComments', () => {
  it('drops comments by blocked or muted authors, whatever the address case', () => {
    expect(visibleComments(all, [], new Set(['0xaa'])).map((x) => x.id)).toEqual(['2', '3']);
  });

  it('drops reported comments as well', () => {
    expect(visibleComments(all, ['3'], new Set(['0xbb'])).map((x) => x.id)).toEqual(['1']);
  });

  it('keeps everything when nothing is hidden', () => {
    expect(visibleComments(all, [], new Set())).toEqual(all);
  });
});
