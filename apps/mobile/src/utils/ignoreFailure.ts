/** Marks a promise rejection that is deliberately dropped: `.catch(ignoreFailure)`, for work whose failure changes nothing (haptics, preferences). */
export function ignoreFailure(): void {
  // Intentionally empty.
}
