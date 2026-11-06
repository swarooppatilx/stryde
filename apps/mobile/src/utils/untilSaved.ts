/**
 * Waits only until `work` reports it has saved (by calling the callback it is given), then lets the
 * rest of `work` carry on unawaited. A failure before that point rejects; one after it goes to
 * `onLateError`, because the thing the caller asked for already happened.
 */
export function untilSaved<T>(
  work: (onSaved: (value: T) => void) => Promise<unknown>,
  onLateError?: (error: unknown) => void
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    let saved = false;
    work((value) => {
      saved = true;
      resolve(value);
    }).then(
      () => {
        if (!saved) resolve(undefined);
      },
      (error) => {
        if (saved) onLateError?.(error);
        else reject(error);
      }
    );
  });
}
