/** The youngest age the app is offered to. */
export const MIN_AGE = 13;

/** Whole years between `birthday` and `now`: the birthday counts on the day itself. */
export function ageOn(birthday: Date, now: Date): number {
  let age = now.getFullYear() - birthday.getFullYear();
  const hadBirthday =
    now.getMonth() > birthday.getMonth() ||
    (now.getMonth() === birthday.getMonth() && now.getDate() >= birthday.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

export function meetsMinimumAge(birthday: Date, now: Date): boolean {
  return ageOn(birthday, now) >= MIN_AGE;
}

export type BirthdayStepState = 'needed' | 'too-young' | 'ok';

/** Where the birthday step of sign-up stands: it cannot be skipped, and under the minimum age stops here. */
export function birthdayStep(birthday: Date | null, now: Date): BirthdayStepState {
  if (birthday === null) return 'needed';
  return meetsMinimumAge(birthday, now) ? 'ok' : 'too-young';
}
