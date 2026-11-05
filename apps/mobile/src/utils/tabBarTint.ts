interface TabBarTheme {
  text: string;
  accentText: string;
  brand: { primary: string };
}

/**
 * The colours of a bottom-bar tab. The icon turns the brand orange when selected; the label turns with
 * it, in the deeper accent step so small text still reads on a white bar.
 */
export function tabTints(theme: TabBarTheme) {
  return {
    icon: { active: theme.brand.primary, inactive: theme.text },
    label: { active: theme.accentText, inactive: theme.text },
  };
}
