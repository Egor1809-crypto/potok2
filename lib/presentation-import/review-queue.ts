type ReviewOptions<T, Image, Report> = {
  items: T[];
  signal: AbortSignal;
  concurrency?: number;
  key?: (item: T) => unknown;
  capture: (item: T, signal: AbortSignal) => Promise<Image>;
  review: (item: T, image: Image, signal: AbortSignal) => Promise<Report>;
  onResult: (item: T, report: Report) => void;
  onError: (item: T, error: unknown) => void;
  onActive: (items: T[]) => void;
  isFatal: (error: unknown) => boolean;
};

/** A bounded, live queue: retries can take the next free slot without restarting the deck. */
export function createSlideReviewQueue<T, Image, Report>(options: ReviewOptions<T, Image, Report>) {
  const stop = new AbortController();
  const signal = AbortSignal.any([options.signal, stop.signal]);
  const active = new Set<T>();
  const occupied = new Set<unknown>();
  const pending: T[] = [];
  const key = options.key ?? ((item: T) => item);
  const concurrency = Math.max(1, Math.min(4, options.concurrency ?? 3));
  let captureQueue: Promise<unknown> = Promise.resolve();
  let fatal: unknown;
  let closed = false;
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const done = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  function enqueue(item: T, priority = true) {
    if (closed || signal.aborted || occupied.has(key(item))) return false;
    occupied.add(key(item));
    if (priority) pending.unshift(item); else pending.push(item);
    // Defer the pump so callers receive the handle before any callbacks run.
    void Promise.resolve().then(pump);
    return true;
  }
  async function run(item: T) {
    try {
      // The offscreen render target is shared; only captures are serialized.
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
        if (options.isFatal(error)) { fatal = error; stop.abort(); }
      }
    } finally {
      active.delete(item);
      occupied.delete(key(item));
      options.onActive([...active]);
      pump();
    }
  }
  function pump() {
    if (closed) return;
    while (!signal.aborted && pending.length && active.size < concurrency) {
      const item = pending.shift()!;
      active.add(item);
      options.onActive([...active]);
      void run(item);
    }
    if (!active.size && (!pending.length || signal.aborted)) {
      closed = true;
      pending.length = 0;
      occupied.clear();
      signal.removeEventListener("abort", pump);
      if (fatal) reject(fatal);
      else if (options.signal.aborted) reject(options.signal.reason);
      else resolve();
    }
  }
  signal.addEventListener("abort", pump, { once: true });
  options.items.forEach(item => enqueue(item, false));
  void Promise.resolve().then(pump);
  return { enqueue, done };
}

export function runSlideReviews<T, Image, Report>(options: ReviewOptions<T, Image, Report>) {
  return createSlideReviewQueue(options).done;
}

export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", aborted));
    if (signal.aborted) aborted();
  });
}
