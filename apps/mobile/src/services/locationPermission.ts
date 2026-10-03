import { getPlatform } from '@/platform';

const PRECISE_NEEDED = {
  title: 'Allow precise location',
  message:
    'Stryde has approximate location only, which is too coarse to record your route or distance. In Settings, turn on Precise location for Stryde.',
  confirmText: 'Open Settings',
} as const;

/** Approximate-only access cannot record a run, so say so and offer the settings that fix it. */
async function requirePrecise(
  permission: { precise?: boolean },
  { location, prompter }: ReturnType<typeof getPlatform>
): Promise<boolean> {
  if (permission.precise !== false) return true;
  if (await prompter.confirm(PRECISE_NEEDED)) await location.openSettings();
  return false;
}

/** Explains before the OS prompt, since Android only asks a couple of times. Returns whether precise foreground location is granted; approximate-only cannot record a route. */
export async function ensureForegroundLocation(): Promise<boolean> {
  const platform = getPlatform();
  const { location, prompter } = platform;

  const current = await location.getPermission();
  if (current.granted) return requirePrecise(current, platform);

  if (!current.canAskAgain) {
    const openSettings = await prompter.confirm({
      title: 'Location is off for Stryde',
      message: 'Turn on location in Settings to see where you are and record activities.',
      confirmText: 'Open Settings',
    });
    if (openSettings) await location.openSettings();
    return false;
  }

  const proceed = await prompter.confirm({
    title: 'Use your location',
    message:
      'Stryde uses your location to show you on the map, record your route, and claim territory. Your route is only shared when you save an activity.',
    confirmText: 'Continue',
  });
  if (!proceed) return false;

  const answer = await location.requestPermission();
  return answer.granted && (await requirePrecise(answer, platform));
}
