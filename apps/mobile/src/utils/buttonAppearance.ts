import { Palette } from '@/constants/palette';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonTheme {
  text: string;
  textTertiary: string;
  accentText: string;
  border: string;
  borderBold: string;
  backgroundSelected: string;
  brand: { primary: string; primaryPressed: string; danger: string; dangerPressed: string };
}

const CLEAR = 'transparent';

/** The three colours a button draws with, from its variant and whether it is pressed or disabled. */
export function buttonAppearance(
  variant: ButtonVariant,
  theme: ButtonTheme,
  state: { pressed: boolean; disabled: boolean }
): { background: string; border: string; label: string } {
  const { brand, ...colors } = theme;
  if (state.disabled) {
    const solid = variant === 'primary' || variant === 'danger';
    return {
      background: solid ? colors.border : CLEAR,
      border: variant === 'secondary' ? colors.border : CLEAR,
      label: colors.textTertiary,
    };
  }
  switch (variant) {
    case 'primary':
      return {
        background: state.pressed ? brand.primaryPressed : brand.primary,
        border: CLEAR,
        label: Palette.white,
      };
    case 'danger':
      return {
        background: state.pressed ? brand.dangerPressed : brand.danger,
        border: CLEAR,
        label: Palette.white,
      };
    case 'secondary':
      return {
        background: state.pressed ? colors.backgroundSelected : CLEAR,
        border: colors.borderBold,
        label: colors.text,
      };
    case 'ghost':
      return {
        background: state.pressed ? colors.backgroundSelected : CLEAR,
        border: CLEAR,
        label: colors.accentText,
      };
  }
}
