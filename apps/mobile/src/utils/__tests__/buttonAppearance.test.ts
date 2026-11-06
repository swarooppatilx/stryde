import { describe, expect, it } from 'vitest';
import { Palette } from '@/constants/palette';
import { buttonAppearance } from '@/utils/buttonAppearance';

const colors = {
  text: '#t',
  textTertiary: '#t3',
  accentText: '#acc',
  border: '#bd',
  borderBold: '#bb',
  backgroundSelected: '#sel',
};
const brand = { primary: '#p', primaryPressed: '#pp', danger: '#d', dangerPressed: '#dp' };
const look = (variant: Parameters<typeof buttonAppearance>[0], state = {}) =>
  buttonAppearance(variant, { ...colors, brand }, { pressed: false, disabled: false, ...state });

describe('buttonAppearance', () => {
  it('fills a primary button with the brand colour and darkens it while pressed', () => {
    expect(look('primary')).toMatchObject({ background: '#p', label: Palette.white });
    expect(look('primary', { pressed: true }).background).toBe('#pp');
  });

  it('outlines a secondary button and tints it while pressed', () => {
    expect(look('secondary')).toMatchObject({
      background: 'transparent',
      border: '#bb',
      label: '#t',
    });
    expect(look('secondary', { pressed: true }).background).toBe('#sel');
  });

  it('outlines a danger-outline button in red and tints it while pressed', () => {
    expect(look('dangerOutline')).toMatchObject({
      background: 'transparent',
      border: '#d',
      label: '#d',
    });
    expect(look('dangerOutline', { pressed: true }).background).toBe('#sel');
  });

  it('shows a ghost button as accent text with no edge', () => {
    expect(look('ghost')).toMatchObject({
      background: 'transparent',
      border: 'transparent',
      label: '#acc',
    });
  });

  it('fills a danger button red', () => {
    expect(look('danger')).toMatchObject({ background: '#d', label: Palette.white });
    expect(look('danger', { pressed: true }).background).toBe('#dp');
  });

  it.each(['primary', 'secondary', 'ghost', 'danger'] as const)(
    'greys out a disabled %s button and ignores the pressed state',
    (variant) => {
      const disabled = look(variant, { disabled: true, pressed: true });
      expect(disabled.label).toBe('#t3');
      expect(disabled.background).not.toBe('#sel');
      expect(disabled.background).not.toBe('#pp');
    }
  );
});
