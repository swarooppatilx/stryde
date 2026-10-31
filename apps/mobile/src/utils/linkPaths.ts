/**
 * The app's public links are resource paths: `/activities/42`,
 * `/athletes/0xabc`, `/clubs/7`, `/events/9`, `/challenges/3`, `/routes/r1`, `/badges/first_activity`.
 * The same path works as `stryde://activities/42` and as a web link on our own host.
 *
 * Before they were resource paths the links named the screen (`strydeexpo://activity-summary?id=42`), and
 * some of those are already in chats and notifications. `canonicalPath` rewrites them, so old links keep
 * working; it is the one place that knows both spellings.
 */

const LEGACY_SCREENS: Record<string, string> = {
  'activity-summary': 'activities',
  'user-profile': 'athletes',
  'club-detail': 'clubs',
  'event-detail': 'events',
  'challenge-detail': 'challenges',
  'route-detail': 'routes',
  'badge-detail': 'badges',
};

/** Short names a link may use for a screen that has no id. */
const ALIASES: Record<string, string> = {
  '/dashboard': '/',
  '/home': '/',
  '/record': '/tracking',
};

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;

/** `stryde://activities/42` has `activities` where a web link has a host; web links have both. */
function pathAndQuery(link: string): string {
  if (!SCHEME.test(link)) return link.startsWith('/') ? link : `/${link}`;
  const withoutScheme = link.replace(SCHEME, '');
  const isWeb = /^https?:\/\//i.test(link);
  // A web link's first segment is its host (stryde.app); a custom scheme's is already the path.
  const rest = isWeb
    ? withoutScheme.slice(withoutScheme.indexOf('/') + 1 || withoutScheme.length)
    : withoutScheme;
  return `/${rest}`;
}

/** The in-app path for any link the app may be opened with, old spellings included. */
export function canonicalPath(link: string): string {
  const full = pathAndQuery(link);
  const [pathname = '/', query = ''] = full.split('?', 2) as [string, string?];
  const screen = pathname.replace(/^\/+/, '').split('/')[0] ?? '';
  const resource = LEGACY_SCREENS[screen];

  if (resource) {
    const params = new URLSearchParams(query);
    const id = params.get('id');
    if (!id) return full;
    params.delete('id');
    const rest = params.toString();
    return `/${resource}/${encodeURIComponent(id)}${rest ? `?${rest}` : ''}`;
  }
  return ALIASES[pathname] ?? full;
}
