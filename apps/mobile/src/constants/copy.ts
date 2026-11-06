/**
 * Words that describe how the app works underneath, not what the athlete is doing. They stay out of
 * everyday copy: errors, empty states, hints and these constants. The wallet address and the STRD
 * and ETH balances are shown on purpose, by components rather than by these strings: the wallet
 * chip and STRD pill on the profile, Settings > Account and the stake screens. They are pinned by
 * `constants/__tests__/protectedSurfaces.test.ts`, so a copy cleanup cannot quietly remove them.
 */
export const BANNED_USER_WORDS =
  /\b(on-?chain|block-?chain|wallets?|gas(?:less| fees?)?|transactions?|contracts?|sepolia|nonce|paymaster|strd|eth(?:ere?um)?|0x[0-9a-f]{4})\b/i;

/** The one-time ask shown after the first saved activity or first follow, before the system prompt. */
export const PUSH_PRIMER_COPY = {
  title: 'Turn on notifications?',
  body: 'Hear when someone gives you kudos, comments or follows you. You can change this any time in Settings.',
  allow: 'Allow',
  notNow: 'Not now',
} as const;

/** Copy for the Groups tab screens. */
export const COMMUNITY_COPY = {
  challengesEmptyTitle: 'Check back for Upcoming & New Challenges',
  clubsEmptyTitle: 'No clubs yet',
  eventsEmptyTitle: 'No events yet',
  challengesEmpty:
    'Challenge a friend: put up a small stake — whoever covers more distance wins both.',
  /** Shown instead of an error that no retry could fix, on a profile with no network behind it. */
  challengesSandbox:
    "Challenges need a live network, so they aren't available in the Sandbox profile.",
} as const;

/** The Home feed when it cannot be loaded: recording still works, and what is recorded is sent later. */
export const FEED_OFFLINE_COPY = {
  title: 'Record offline',
  body: "Couldn't load the feed. You can still record: your activity is saved on this phone and sent when you're back online.",
  record: 'Record',
  retry: 'Try again',
} as const;

/** Above a list that could not refresh but still shows what the phone already had. */
export const STALE_BANNER_COPY = {
  message: 'Showing what we had. Your activities are safe on this phone.',
  retry: 'Try again',
} as const;

/** One line under the title of a just-saved activity; they take turns as the athlete saves more. */
export const CELEBRATIONS = [
  'Nice one. That is in the log.',
  'Logged, and it all adds up.',
  'Another good step. Keep it going.',
  'Solid work. Rest well.',
] as const;

/** Shown on the Save screen when the phone said its location was simulated. */
export const SIMULATED_LOCATION_NOTICE =
  "This recording used a simulated location, so it won't earn rewards or territory. You can still save it.";

/**
 * How each visibility choice is described, and what is shared. Followers only changes where the
 * activity is meant to show: its details are published like Everyone's, because hiding them needs
 * encryption that is not built, so the copy must not promise more than that.
 */
export const PRIVACY_COPY = {
  everyone: 'Anyone can see',
  followers: 'Meant for followers, but details are public like Everyone',
  onlyMe: 'Details stay on this phone',
  recordedDetails: 'Heart rate, splits and laps stay on this phone. Distance and time are public.',
  routeHidden: 'Route hidden from others',
} as const;

/** Under the stats of a just-saved activity: how long it took to be kept and to show up in search. */
export const SAVE_TIMING_COPY = {
  saved: (seconds: string) => `Saved on the public record in ${seconds}`,
  indexed: (seconds: string) => `Visible in search in ${seconds}`,
} as const;

/** Said instead when an activity was short: it still counts. */
export const SHORT_ACTIVITY_LINE = 'Every bit counts. Well done for getting out.';

/** The "Before you start" card on the Record screen: what could stop a recording quietly. */
export const READINESS_COPY = {
  heading: 'Before you start',
  locationBlockedTitle: 'Location is off for Stryde',
  locationBlockedDetail: 'Stryde cannot record a route without it.',
  locationBlockedAction: 'Open settings',
  locationApproxTitle: 'Only approximate location',
  locationApproxDetail: 'Turn on precise location so the route follows your steps.',
  locationApproxAction: 'Open settings',
  locationBackgroundTitle: 'Location only while the app is open',
  locationBackgroundDetail:
    'Choose "Allow all the time" so recording continues with the screen off.',
  locationBackgroundAction: 'Open settings',
  servicesTitle: 'Phone location is switched off',
  servicesDetail: 'Turn it on, then come back.',
  servicesAction: 'Open location settings',
  notificationsTitle: 'Notifications are off',
  notificationsDetail: 'The recording notice may be hidden, and the phone may stop the recording.',
  notificationsAction: 'Open settings',
  batteryTitle: 'Long run tip',
  batteryDetail:
    'If recording stops with the screen off, set battery use for Stryde to unrestricted in the phone settings.',
  batteryAction: 'Open settings',
  storageTitle: 'Phone storage is almost full',
  storageDetail: 'Free some space so the recording can be saved.',
} as const;

/** Dialogs shown when Start is pressed and something may stop the recording. */
export const START_GATE_COPY = {
  inProgressTitle: 'Activity already in progress',
  inProgressBody: 'Finish or discard the recording you have open before starting another.',
  servicesOffTitle: 'Location services are off',
  servicesOffBody: 'Turn on location in your phone settings so Stryde can record your route.',
  servicesOffAction: 'Open settings',
  permissionTitle: 'Location is off for Stryde',
  permissionBody: 'Allow location in Settings to see where you are and record activities.',
  permissionAction: 'Open Settings',
  approximateTitle: 'Location is not precise',
  approximateBody:
    'Stryde only has approximate location, so the route and distance will be rough. Turn on Precise location in Settings.',
  approximateAction: 'Open Settings',
  noSignalTitle: 'No GPS signal',
  noSignalBody: 'For accurate recording try moving to a location with better reception.',
  noSignalContinue: 'Continue',
  noSignalWait: 'Wait',
  close: 'OK',
} as const;

/** The sport list sheet opened from the record screen. */
export const SPORT_PICKER_COPY = {
  more: 'More sports',
  title: 'Choose a sport',
  searchPlaceholder: 'Search sports',
  close: 'Close',
  empty: 'No sports match that search.',
} as const;

/** Messages about saving and syncing an activity, in the athlete's terms. */
export const COPY = {
  syncPending: "Saved on this device. It will count on leaderboards once it's synced.",
  syncRetrying: "Couldn't sync yet. Trying again automatically.",
  syncGaveUp: "Couldn't sync automatically. Retry when you're ready.",
  syncRetryFailed: "Couldn't sync it. Try again in a moment.",
  syncNeedsAccount: 'Your account is still connecting. Try again in a moment.',
  syncDone: 'Synced',
  saveFailedTitle: 'Saved, but not synced',
  saveFailedBody:
    "Your activity is saved on this device, but it didn't sync, so it won't count on leaderboards or challenges yet. We'll keep trying, or you can retry from the activity.",
  accountConnecting: 'Your account is still connecting. Try again in a moment.',
  actionPending: 'Saving…',
  actionFailed: "That didn't go through",
  accountSavingFree: 'Saving is free for you. This balance is only used for challenge stakes.',
  accountOwnFees:
    "Your account is using its standard setup for now, and will switch back automatically once it's available.",
  accountUnavailable: "We couldn't set up your account. Tap to retry.",
  removeFromDevice: (name: string) =>
    `Remove "${name}" from this device? A verified copy stays in the public record, so it can't be erased there.`,
} as const;

/** What a queued change says about itself under a comment or post, by where it stands. */
export const DELIVERY_COPY = {
  sending: 'Sending…',
  retrying: 'Sending…',
  'waiting-for-network': 'Waiting for a connection',
  stuck: 'Taking longer than usual',
  failed: 'Not sent. Tap to try again',
} as const;

/** What the inbox says each event was, read after the athlete's name. */
export const INBOX_COPY = {
  follow: ' started following you',
  comment: ' commented on your activity',
  kudos: ' gave kudos to your activity',
} as const;

/** The dropdown under the "+" on Home. Recording lives on the Record tab, so it is not offered here. */
export const CREATE_MENU_COPY = {
  menu: 'Create menu',
  post: 'Post',
  photo: 'Photo',
  manual: 'Manual activity',
} as const;

/** The captions on the welcome carousel; the pictures stay with the screen. */
export const ONBOARDING_COPY = [
  {
    title: 'Track every mile',
    body: 'Record runs, rides, hikes and walks with GPS tracking, pace, and elevation in real time.',
  },
  {
    title: 'Claim your territory',
    body: 'Every route you finish maps the ground you covered. Build your world as you move.',
  },
  {
    title: 'Train with friends',
    body: 'See what the people around you are up to. Share routes, compare stats, and keep each other honest.',
  },
  {
    title: 'Your progress, always',
    body: 'Everything you record stays with you. No lock-in, no paywall — just your data, wherever you go.',
  },
] as const;

/** The "Make it yours" flow after profile setup, and the Getting started card on Home. */
export const SETUP_COPY = {
  skip: 'Skip',
  back: 'Back',
  continue: 'Continue',
  done: 'Done',
  skipConfirm: {
    title: 'Are you sure you want to skip setup?',
    message: 'You can set all of this up later from Home.',
    stay: "No, don't skip",
    skip: 'Yes, skip',
  },
  sports: {
    title: 'Pick your sports',
    body: 'Choose the ones you do. They show first when you record.',
  },
  goal: {
    title: 'What is your weekly goal?',
    body: 'Pick a starting point. You can change it any time.',
    custom: 'Custom',
    customHint: 'Set your own numbers',
    distance: 'Distance',
    activities: 'Activities',
  },
  permissions: {
    title: 'Get the most from Stryde',
    body: 'Both are optional. You can carry on without them.',
    locationTitle: 'Location',
    locationBody: 'Shows you on the map and records your route and distance while you move.',
    locationAllow: 'Allow location',
    locationOn: 'Location is on',
    locationOff: 'Not allowed yet',
    notificationsTitle: 'Notifications',
    notificationsBody:
      'Keeps your recording visible while the screen is off, and tells you when friends react.',
    notificationsAllow: 'Allow notifications',
    notificationsOpen: 'Open phone settings',
    notificationsOn: 'Notifications are on',
    notificationsUnknown: 'Not allowed yet',
    notificationsDenied: 'Turned off. You can turn them on in your phone settings.',
  },
  people: {
    title: 'Find people to follow',
    body: 'Their activities show up on your Home feed.',
    loading: 'Finding people...',
    offline:
      "You're offline, so we can't look for people right now. Try again when you're back online.",
    failed: "Couldn't load people. Try again.",
    retry: 'Try again',
    empty: 'There is nobody to suggest yet. You can search for people any time from Home.',
    nudge: {
      title: 'Following at least 1 person helps you discover routes, challenges and clubs',
      message: 'Follow someone to fill your feed.',
      back: 'Go back',
      later: 'Maybe later',
    },
  },
  checklist: {
    title: 'Getting started',
    dismiss: 'Dismiss',
    activity: 'Record or add your first activity',
    goal: 'Set a weekly goal',
    follow: 'Follow someone',
    photo: 'Add a profile photo',
  },
} as const;

/** What the status toast says while a change is on its way. */
export const STAGE_TOAST_COPY = {
  sendingRun: 'Getting your run ready',
  sending: 'Sending',
  retrying: 'Still trying',
  failed: "Couldn't send. Tap to try again",
  done: 'Counted',
  reportSent: 'Report sent',
  rejected: 'That change was not accepted',
} as const;
