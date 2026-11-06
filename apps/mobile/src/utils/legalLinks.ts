export interface LegalLink {
  title: string;
  subtitle: string;
  icon: 'help-buoy-outline' | 'document-text-outline' | 'shield-checkmark-outline';
  url: string;
}

const ROWS = [
  {
    path: 'support',
    title: 'Support',
    subtitle: 'Get help with Stryde',
    icon: 'help-buoy-outline',
  },
  {
    path: 'terms',
    title: 'Terms',
    subtitle: 'The rules for using Stryde',
    icon: 'document-text-outline',
  },
  {
    path: 'privacy',
    title: 'Privacy',
    subtitle: 'What Stryde collects and why',
    icon: 'shield-checkmark-outline',
  },
] as const;

/** The Support, Terms and Privacy rows; none when the web address is not set, so no dead links show. */
export function legalLinks(webUrl: string): LegalLink[] {
  const base = webUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) return [];
  return ROWS.map(({ path, ...row }) => ({ ...row, url: `${base}/${path}` }));
}
