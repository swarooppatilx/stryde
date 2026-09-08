import type { WithSpringConfig } from 'react-native-reanimated';

const HEIGHT = 52;
const PILL_WIDTH = 112;
const SAVED_WIDTH = 148;
const CIRCLE = HEIGHT;

const SPINNER_SIZE = 26;
const SUCCESS_BADGE = 30;
const DONE_CHECK = 32;

const CHECK_SHIFT = -32;
const SAVED_SHIFT = 20;

const DEFAULT_MIN_LOADING = 1200;
const DEFAULT_SUCCESS_PAUSE = 650;

const SPRING: WithSpringConfig = { damping: 18, stiffness: 180, mass: 1 };
const SPRING_POP: WithSpringConfig = { damping: 11, stiffness: 220, mass: 0.6 };

const COLORS = {
  lightBg: '#ECEAE4',
  darkBg: '#2C2B29',
  border: '#E3E1DB',
  label: '#39382F',
  savedLabel: '#4A4A46',
  spinnerTrack: 'rgba(255,255,255,0.25)',
  spinnerHead: '#EDEDED',
  successBadge: '#D8D8D6',
  successCheck: '#2C2B29',
  doneCheckBg: '#57564F',
  doneCheckMark: '#FFFFFF',
};

export {
  CHECK_SHIFT,
  CIRCLE,
  COLORS,
  DEFAULT_MIN_LOADING,
  DEFAULT_SUCCESS_PAUSE,
  DONE_CHECK,
  HEIGHT,
  PILL_WIDTH,
  SAVED_SHIFT,
  SAVED_WIDTH,
  SPINNER_SIZE,
  SPRING,
  SPRING_POP,
  SUCCESS_BADGE,
};
