import { canonicalPath } from '@/utils/linkPaths';

/**
 * Every link the app is opened with passes through here first: clean `stryde://activities/42` links go
 * straight in, and links shared before the screens were renamed (`strydeexpo://activity-summary?id=42`)
 * are rewritten to the same place, so nothing already shared breaks.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return canonicalPath(path);
}
