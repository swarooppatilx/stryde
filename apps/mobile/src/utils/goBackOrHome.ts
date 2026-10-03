interface BackRouter {
  canGoBack(): boolean;
  back(): void;
  replace(href: '/(tabs)'): void;
}

/**
 * Back to wherever the athlete came from, or Home when there is nowhere to go back to (the screen
 * was opened from a link or a cold start): a bare `back()` there does nothing, a dead button.
 */
export function goBackOrHome(router: BackRouter): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}
