import { PRIVACY_COPY } from '@/constants/copy';
import type { ActivityPrivacy } from '@/types';

/** The line under each visibility choice in the picker. */
export function privacyOptionDescription(privacy: ActivityPrivacy): string {
  switch (privacy) {
    case 'everyone':
      return PRIVACY_COPY.everyone;
    case 'followers':
      return PRIVACY_COPY.followers;
    case 'only_me':
      return PRIVACY_COPY.onlyMe;
  }
}

/**
 * The note under the visibility choice on the Save screen. Only a recorded activity has heart rate,
 * splits and laps to keep back, and Only Me keeps everything on the phone already, so neither needs it.
 */
export function savePrivacyCaption(input: {
  recorded: boolean;
  privacy: ActivityPrivacy;
}): string | undefined {
  if (!input.recorded || input.privacy === 'only_me') return undefined;
  return PRIVACY_COPY.recordedDetails;
}

/**
 * The owner's reminder that a route they chose to hide is not shared, so a map they can see on their
 * own phone is not mistaken for one everyone sees. Others never see a hidden route, so no note.
 */
export function routeHiddenNote(input: {
  isOwner: boolean;
  hideRoute: boolean | undefined;
}): string | undefined {
  return input.isOwner && input.hideRoute ? PRIVACY_COPY.routeHidden : undefined;
}
