import { checkEmailHtml, MAX_AI_CODE_LENGTH, MAX_HTML_CODE_LENGTH } from "./formats";
import { importLetter, type ImportedLetter } from "./import-letter";

export type CodeImportMode = "auto" | "html" | "ai";
export type CodeImportInput = { code: string; mode: CodeImportMode; instructions: string; resources: File[] };
export { MAX_HTML_CODE_LENGTH } from "./formats";

export function unwrapCodeFence(value: string) {
  const match = value.trim().match(/^```[\w+-]*\r?\n([\s\S]*?)\r?\n```$/);
  return match ? match[1] : value;
}

export function codeImportPath(value: string, mode: CodeImportMode = "auto") {
  const code = unwrapCodeFence(value);
  if (!code.trim()) throw new Error("Вставьте код письма.");
  if (code.length > MAX_HTML_CODE_LENGTH) throw new Error("HTML может содержать до 500 000 символов.");
  const markup = code.replace(/<!--[\s\S]*?-->|<style\b[^>]*>[\s\S]*?<\/style>/gi, "").trim();
  const html = /^(?:<!doctype\s+html|<(?:html|head|body|table|tbody|thead|tr|td|div|p|span|h[1-6]|section|article|main|img|a|ul|ol|li|center|font|br|hr)\b)/i.test(markup);
  const jsx = /\b(?:className|htmlFor)\s*=|=\s*\{|<>|<\/>|(?<!\{)\{[^{}\n]+\}(?!\})/u.test(markup);
  if (mode === "html") {
    if (!html || jsx) throw new Error("Это не статичный HTML. Выберите автоматическое определение или преобразование с ИИ.");
    checkEmailHtml(code);
    return { code, path: "html" as const };
  }
  if (mode === "auto" && html && !jsx) {
    try { checkEmailHtml(code); return { code, path: "html" as const }; }
    catch { /* Interactive markup needs conversion to static email. */ }
  }
  if (code.length > MAX_AI_CODE_LENGTH) throw new Error("Для преобразования с ИИ вставьте фрагмент до 60 000 символов.");
  return { code, path: "ai" as const };
}

export async function importCodeLetter(input: CodeImportInput, progress: (message: string) => void): Promise<ImportedLetter> {
  const prepared = codeImportPath(input.code, input.mode === "auto" && input.instructions.trim() ? "ai" : input.mode);
  let html = prepared.code;
  let metadata: { name?: string; subject?: string; previewText?: string; notes?: string[] } = {};
  if (prepared.path === "ai") {
    progress("ИИ преобразует код в письмо…");
    const response = await fetch("/api/email-import/code", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ code: prepared.code, instructions: input.instructions }) });
    const result = await response.json().catch(() => ({})) as typeof metadata & { html?: string; error?: string };
    if (!response.ok || typeof result.html !== "string") throw new Error(result.error || "Не удалось преобразовать код в письмо.");
    html = result.html;
    metadata = result;
  }
  progress("Готовим предпросмотр…");
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 100);
  const letter = await importLetter([new File([html], "letter.html", { type: "text/html" }), ...input.resources], progress);
  letter.name = metadata.name || title || "Письмо из кода";
  letter.document.subject = metadata.subject || title || "Новое письмо";
  letter.document.previewText = metadata.previewText || "";
  if (prepared.path === "ai") letter.notes = ["Код преобразован в статичное HTML-письмо. Проверьте текст, ссылки и оформление перед сохранением.", ...(metadata.notes ?? [])];
  return letter;
}
