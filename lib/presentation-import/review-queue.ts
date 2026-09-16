/** Render one slide at a time, while up to three model requests run concurrently. */
export async function runSlideReviews<T, Image, Report>(options: {
  items: T[];
  signal: AbortSignal;
  capture: (item: T, signal: AbortSignal) => Promise<Image>;
  review: (item: T, image: Image, signal: AbortSignal) => Promise<Report>;
  onResult: (item: T, report: Report) => void;
  onError: (item: T, error: unknown) => void;
  onActive: (items: T[]) => void;
  isFatal: (error: unknown) => boolean;
}) {
  const stop = new AbortController();
  const signal = AbortSignal.any([options.signal, stop.signal]);
  const active = new Set<T>();
  let next = 0;
  let captureQueue: Promise<unknown> = Promise.resolve();
  let fatal: unknown;
  async function worker() {
    while (!signal.aborted && next < options.items.length) {
      const item = options.items[next++];
      active.add(item);
      options.onActive([...active]);
      try {
        // The offscreen render target is shared. Never capture different slides concurrently.
        const captured = captureQueue.then(() => {
          signal.throwIfAborted();
          return options.capture(item, signal);
        });
        captureQueue = captured.catch(() => {});
        const image = await captured;
        signal.throwIfAborted();
        const report = await options.review(item, image, signal);
        signal.throwIfAborted();
        options.onResult(item, report);
      } catch (error) {
        if (!signal.aborted) {
          options.onError(item, error);
          if (options.isFatal(error)) {
            fatal = error;
            stop.abort();
          }
        }
      } finally {
        active.delete(item);
        options.onActive([...active]);
      }
    }
  }
  // Drain in-flight workers before exposing a retry or allowing a new render.
  await Promise.all(Array.from({ length: Math.min(3, options.items.length) }, worker));
  if (fatal) throw fatal;
  options.signal.throwIfAborted();
}

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
}
