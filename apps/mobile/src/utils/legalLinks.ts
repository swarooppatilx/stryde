import { t as defaultT, type TFunction } from '@/i18n';

export interface LegalLink {
  title: string;
  subtitle: string;
  icon: 'help-buoy-outline' | 'document-text-outline' | 'shield-checkmark-outline';
  url: string;
}

const ROWS = [
  {
    path: 'support',
    title: 'about.support',
    subtitle: 'about.supportHint',
    icon: 'help-buoy-outline',
  },
  {
    path: 'terms',
    title: 'about.terms',
    subtitle: 'about.termsHint',
    icon: 'document-text-outline',
  },
  {
    path: 'privacy',
    title: 'about.privacy',
    subtitle: 'about.privacyHint',
    icon: 'shield-checkmark-outline',
  },
] as const;

/** The Support, Terms and Privacy rows; none when the web address is not set, so no dead links show. */
export function legalLinks(webUrl: string, t: TFunction = defaultT): LegalLink[] {
  const base = webUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) return [];
  return ROWS.map(({ path, title, subtitle, icon }) => ({
    title: t(title),
    subtitle: t(subtitle),
    icon,
    url: `${base}/${path}`,
  }));
}
