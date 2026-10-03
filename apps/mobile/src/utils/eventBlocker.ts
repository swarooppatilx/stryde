import { EVENT_TITLE_MIN } from '@/constants/limits';

interface EventForm {
  title: string;
  datesValid: boolean;
  distanceMeters: number;
  hasWallet: boolean;
}

/** Why Create Event is disabled, in plain words; null when nothing is in the way. */
export function eventBlocker(form: EventForm): string | null {
  if (form.title.trim().length < EVENT_TITLE_MIN) {
    return `Give the event a name of at least ${EVENT_TITLE_MIN} letters.`;
  }
  if (!form.datesValid) return 'The end date must be after the start date.';
  if (form.distanceMeters <= 0) return 'Set a distance goal above zero.';
  if (!form.hasWallet) return 'Your wallet is still connecting. Try again in a moment.';
  return null;
}
