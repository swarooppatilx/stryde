import { DEV_TOOLS } from '@/constants/devTools';
import { systemClock } from './clock';
import { setDevLocation } from './devLocation';
import { createExpoPlatform } from './expo';
import { installPlatform } from './index';
import { ScriptedLocationSource } from './replay';

// Imported first in entrypoint.js, before expo-router loads any screen or
// store: persisted zustand stores start hydrating the moment their module is
// imported, and they read storage through the installed platform.
const platform = createExpoPlatform();

if (DEV_TOOLS.enabled) {
  // Behaves exactly like the real source until a route replay is started from Settings > Developer tools.
  const location = new ScriptedLocationSource(platform.location, systemClock);
  setDevLocation(location);
  installPlatform({ ...platform, location });
} else {
  installPlatform(platform);
}
