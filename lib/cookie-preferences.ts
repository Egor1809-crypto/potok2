/** Device-local preference. No optional trackers are installed in this release. */
export const COOKIE_PREFERENCE_KEY = "potok:cookie-preferences";
export const COOKIE_PREFERENCE_VERSION = "2026-09-15";
export const COOKIE_PREFERENCE_TTL = 180 * 24 * 60 * 60 * 1000;
export const COOKIE_PREFERENCE_EVENT = "potok:cookie-preferences-changed";
export const COOKIE_SETTINGS_EVENT = "potok:open-cookie-settings";
export type CookiePreferences = { version: string; choice: "accepted" | "rejected"; savedAt: number };
export function parseCookiePreferences(raw: string | null, now = Date.now()): CookiePreferences | null {
  try {
    const value = JSON.parse(raw || "null") as CookiePreferences | null;
    return value && value.version === COOKIE_PREFERENCE_VERSION &&
      (value.choice === "accepted" || value.choice === "rejected") &&
      typeof value.savedAt === "number" && Number.isFinite(value.savedAt) &&
      value.savedAt <= now && now - value.savedAt < COOKIE_PREFERENCE_TTL ? value : null;
  } catch { return null; }
}
export function readCookiePreferences(): CookiePreferences | null {
  try { return parseCookiePreferences(window.localStorage.getItem(COOKIE_PREFERENCE_KEY)); }
  catch { return null; }
}
