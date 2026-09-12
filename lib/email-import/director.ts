export type ImportFinding = { severity: "issue" | "suggestion"; evidence: string; recommendation: string };
export type ImportCrop = { id: string; source: string; x: number; y: number; width: number; height: number };
export type ImportDirection = { summary: string; findings: ImportFinding[]; notes: string[]; html: string; crops: ImportCrop[]; imagesSeen: number; imagesTotal: number };

// Keep the imported document intact. Inspection must not round-trip it through
// the block builder or a DOM serializer (which can remove Outlook comments).
export function importedSource(html: string) {
  const content = html.replace(/<!--[\s\S]*?-->|<(head|style|script)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  const text = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/\s+/g, " ").trim();
  const images = [...new Set([...content.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(match => match[1] ?? match[2] ?? match[3]).filter(Boolean))];
  const findings: ImportFinding[] = [];
  const imageOnly = images.length > 0 && text.length < 30;
  if (imageOnly) findings.push({ severity: "issue", evidence: "Письмо состоит из изображений; обычного текста почти нет.", recommendation: "Подготовьте редактируемую версию: текст будет читаться при отключённых картинках, а кнопкам можно будет назначить ссылки." });
  const missingAlt = [...content.matchAll(/<img\b[^>]*>/gi)].filter(([tag]) => !/\balt\s*=/i.test(tag)).length;
  if (missingAlt) findings.push({ severity: "suggestion", evidence: `У ${missingAlt} изображений нет атрибута alt.`, recommendation: "Добавьте описание содержательных изображений и пустой alt у декоративных." });
  if (!/name\s*=\s*["']?viewport/i.test(html)) findings.push({ severity: "suggestion", evidence: "Не задан viewport для мобильного просмотра.", recommendation: "Добавьте настройки ширины экрана и проверьте письмо на телефоне." });
  return { text, images, imageOnly, findings };
}

export function addImportViewport(html: string) {
  if (/name\s*=\s*["']?viewport/i.test(html)) return html;
  const meta = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  return /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, match => match + meta) : html.replace(/<html\b[^>]*>/i, match => `${match}<head>${meta}</head>`);
}
