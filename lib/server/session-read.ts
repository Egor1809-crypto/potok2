import { ApiRequestError } from "./api-utils";

function transientReadFailure(error: unknown): boolean {
  const seen = new Set<unknown>();
  for (let cause = error; cause && typeof cause === "object" && !seen.has(cause);) {
    seen.add(cause);
    const value = cause as { message?: unknown; cause?: unknown };
    if (typeof value.message === "string" && /SQLITE_BUSY|database is locked|storage caused object to be reset|Network connection lost|Cannot resolve D1 DB|internal error.*D1|D1.*internal error/i.test(value.message)) return true;
    cause = value.cause;
  }
  return false;
}

/** Retry only the read, never the authenticated action (which may send mail). */
export async function readSession<T>(read: () => PromiseLike<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try { return await read(); }
    catch (error) {
      const transient = transientReadFailure(error);
      if (transient && attempt === 0 && !signal.aborted) {
        await new Promise(resolve => setTimeout(resolve, 250));
        continue;
      }
      // Drizzle errors can contain SQL parameters, including session hashes.
      console.warn("Team session lookup unavailable", { transient, attempts: attempt + 1 });
      throw new ApiRequestError("Не удалось проверить вход в аккаунт: хранилище временно недоступно. Повторите действие через несколько секунд.", 503);
    }
  }
}
