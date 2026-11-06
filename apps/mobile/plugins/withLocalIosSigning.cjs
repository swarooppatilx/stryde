// Lets a developer sign iOS builds with a free Apple ID ("Personal Team") without hand-editing ios/.
// Only active when STRYDE_IOS_TEAM_ID is set, so EAS and paid-team builds are unchanged.
//   STRYDE_IOS_TEAM_ID=ABCDE12345  sets the team and gives the app its own bundle id (com.stryde.app.devabcde12345):
//                                  free teams can't reuse an id another team registered.
// Free teams can't sign push notifications or Sign in with Apple, so those entitlements are dropped too.
const fs = require('node:fs');
const path = require('node:path');
const { withFinalizedMod } = require('expo/config-plugins');
const plist = require('@expo/plist').default;

const FREE_TEAM_UNSUPPORTED = ['aps-environment', 'com.apple.developer.applesignin'];

/** Applied to the config before plugins run, so every target (the watch app too) gets the same team. */
function applyLocalSigning(config) {
  const team = process.env.STRYDE_IOS_TEAM_ID;
  if (!team) return config;
  const base = config.ios?.bundleIdentifier ?? 'com.stryde.app';
  return {
    ...config,
    ios: { ...config.ios, appleTeamId: team, bundleIdentifier: `${base}.dev${team.toLowerCase()}` },
    plugins: [...(config.plugins ?? []), withFreeTeamEntitlements],
  };
}

/** Runs after every other plugin has written the entitlements file. */
function withFreeTeamEntitlements(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot;
      const name = config.modRequest.projectName;
      const file = path.join(iosDir, name, `${name}.entitlements`);
      if (fs.existsSync(file)) {
        const entitlements = plist.parse(fs.readFileSync(file, 'utf8'));
        for (const key of FREE_TEAM_UNSUPPORTED) delete entitlements[key];
        fs.writeFileSync(file, plist.build(entitlements));
      }
      return config;
    },
  ]);
}

module.exports = { applyLocalSigning };
