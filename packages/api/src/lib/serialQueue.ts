/** Runs async tasks strictly one at a time. Use it where concurrent sends from one account would race on the nonce. */
export function createSerialQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function runSerially<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}
