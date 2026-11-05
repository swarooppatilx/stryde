/** Text lengths for clubs and events; the registry contracts reject longer input. */
export const CLUB_NAME_MAX = 64;
export const CLUB_LOCATION_MAX = 64;
export const CLUB_DESCRIPTION_MAX = 500;
export const ACTIVITY_DESCRIPTION_MAX = 1000;
/** A note only the athlete sees; kept on the device, so this only keeps the field sensible. */
export const PRIVATE_NOTE_MAX = 500;
export const PERSON_NAME_MAX = 50;
export const GEAR_NAME_MAX = 50;
/** Typed numbers (a distance, a duration): far longer than any real value, short enough to stop a stuck key. */
export const NUMBER_INPUT_MAX = 10;
export const EVENT_TITLE_MIN = 3;
export const EVENT_TITLE_MAX = 100;
export const EVENT_DESCRIPTION_MAX = 1000;

/** The radius of a privacy zone, in metres: chosen in steps between these. */
export const PRIVACY_ZONE_RADIUS_MIN = 200;
export const PRIVACY_ZONE_RADIUS_MAX = 1600;
export const PRIVACY_ZONE_RADIUS_STEP = 200;
