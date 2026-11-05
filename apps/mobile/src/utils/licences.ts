export interface DependencyEntry {
  name: string;
  version: string;
}

interface PackageManifest {
  dependencies?: Record<string, string>;
}

/** The declared version without its range marker; empty when the manifest names no version (a catalog entry). */
function plainVersion(range: string): string {
  return /^[\^~]?\d/.test(range) ? range.replace(/^[\^~]/, '') : '';
}

/** The open-source packages the app depends on directly, by name; the repo's own packages are left out. */
export function directDependencies(manifest: PackageManifest): DependencyEntry[] {
  return Object.entries(manifest.dependencies ?? {})
    .filter(([name]) => !name.startsWith('@repo/'))
    .map(([name, range]) => ({ name, version: plainVersion(range) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
