import { TypeScale, textStyle } from '@/constants/typography';

/** Which step of the type scale each `ThemedText` type uses. Plain objects, so it can be tested without React Native. */
export const TEXT_TYPE_STYLES = {
  default: textStyle(TypeScale.body),
  display: textStyle(TypeScale.display),
  title: textStyle(TypeScale.title),
  titleSmall: textStyle(TypeScale.titleSmall),
  headline: textStyle(TypeScale.headline),
  sectionTitle: textStyle(TypeScale.sectionTitle),
  small: textStyle(TypeScale.callout),
  smallBold: textStyle(TypeScale.calloutBold),
  caption: textStyle(TypeScale.footnote),
  eyebrow: textStyle(TypeScale.eyebrow),
  link: textStyle(TypeScale.callout),
  button: textStyle(TypeScale.bodyBold),
  error: textStyle(TypeScale.callout),
} as const;
