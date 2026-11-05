/** Auto follows the phone's own "reduce motion" setting; Reduced is the athlete's choice inside the app. */
export type MotionPreference = 'auto' | 'reduced';

export const MOTION_OPTIONS: readonly { value: MotionPreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'reduced', label: 'Reduced' },
];

export function shouldReduceMotion(preference: MotionPreference, systemReduces: boolean): boolean {
  return preference === 'reduced' || systemReduces;
}
