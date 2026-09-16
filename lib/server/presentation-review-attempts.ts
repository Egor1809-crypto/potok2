import { ApiRequestError } from "./api-utils";

/** One recovery attempt, within a fixed budget; caller cancellation never starts another request. */
export async function reviewWithFallback<T>(options: {
  signal: AbortSignal;
  models: [string, string];
  run: (model: string, signal: AbortSignal) => Promise<T>;
  timeouts?: [number, number];
}) {
  const timeouts = options.timeouts ?? [30000, 40000];
  for (let attempt = 0; attempt < 2; attempt++) {
    options.signal.throwIfAborted();
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), timeouts[attempt]);
    const signal = AbortSignal.any([options.signal, deadline.signal]);
    try {
      return await options.run(options.models[attempt], signal);
    } catch (error) {
      options.signal.throwIfAborted();
      const failure = deadline.signal.aborted
        ? new ApiRequestError("ИИ не завершил проверку вовремя. Повторите этот слайд — остальные продолжают проверяться.", 504)
        : error;
      const retryable = deadline.signal.aborted || failure instanceof TypeError ||
        (failure instanceof ApiRequestError && [422, 429, 502, 504].includes(failure.status));
      if (attempt === 1 || !retryable) throw failure;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Проверка не завершена.");
}
