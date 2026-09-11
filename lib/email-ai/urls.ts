/** Email actions may use contact schemes; media must be publicly hosted HTTPS. */
export function safeEmailUrl(value: unknown, media = false, allowDevelopmentAsset = false): string {
  if (typeof value !== "string" || !value.trim() || /[\s<>"`]/.test(value) || [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) throw new Error("Укажите корректную ссылку.");
  const url = new URL(value);
  // Local asset storage is used by the development server only, never by production exports.
  if (media && allowDevelopmentAsset && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && /^\/api\/assets\/[a-zA-Z0-9_-]+$/.test(url.pathname) && !url.username && !url.password) return value;
  const allowed = media ? ["https:"] : ["https:", "http:", "mailto:", "tel:"];
  if (!allowed.includes(url.protocol) || url.username || url.password || /^(?:localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url.hostname)) throw new Error("Эта ссылка не подходит для отправки в письме.");
  if ((url.protocol === "mailto:" || url.protocol === "tel:") && !url.pathname) throw new Error("Укажите адрес или номер телефона.");
  return value;
}
