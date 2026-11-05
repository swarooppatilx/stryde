import { DEV_TOOLS } from '@/constants/devTools';
import { getPlatform } from '@/platform';
import { logger, setConsoleLevel } from '@/utils/logger';
import { bootProfile } from './boot';

// Imported by entrypoint.js before the router, so the profile load is already running when the
// first store starts reading its storage (which then waits for it).
if (__DEV__) setConsoleLevel('debug');

void bootProfile({
  storage: getPlatform().storage,
  devToolsEnabled: DEV_TOOLS.enabled,
  defaultProfile: DEV_TOOLS.defaultProfile,
}).then((profile) => {
  logger.info(`[Boot] Running the ${profile} profile`);
});
