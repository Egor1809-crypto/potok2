import { FileInput, Megaphone, Plug2, Upload } from "@/components/ui/icons";
import { productNavigation, quickCreateRoutes, type ProductNavItem } from "@/components/layout/navigation";

export type NavigationResult = ProductNavItem & { kind: "section" | "action"; category: string };
const aliases: Record<string, string[]> = {
  "/templates": ["письма шаблон", "html", "готовые письма", "библиотека писем"],
  "/contacts": ["клиенты", "адресная книга", "получатели", "контакты", "базы"],
  "/calendar": ["календарь", "планирование", "запланированные письма", "расписание", "отложенная отправка"],
  "/campaigns": ["рассылки", "кампании", "отправленные письма"],
  "/analytics": ["статистика", "аналитика", "отчеты", "доставка"],
  "/communications": ["ответы", "согласия", "давление", "паспорт данных", "задачи"],
  "/settings": ["настройки", "профиль", "аккаунт"],
};
const canonicalHref = (href: string) => href === "/image-studio?new=1" ? "/image-studio?view=create" : href;
const entries = new Map<string, NavigationResult>();
for (const section of productNavigation) {
  for (const parent of section.items) {
    for (const item of parent.children ?? [parent]) {
      const kind = parent.href === "/email-builder" ? "action" : "section";
      entries.set(item.href, { ...item, kind, category: parent.children ? parent.label : section.label, keywords: [...(item.keywords ?? []), ...(parent.keywords ?? []), parent.label, ...(aliases[item.href] ?? [])] });
    }
  }
}
for (const item of quickCreateRoutes) {
  const href = canonicalHref(item.href), existing = entries.get(href);
  entries.set(href, { ...item, href, kind: existing?.kind ?? "action", category: existing?.category ?? "Действия", keywords: [...(item.keywords ?? []), ...(existing?.keywords ?? []), existing?.label ?? ""] });
}
for (const item of [
  { label: "Новая рассылка", href: "/campaigns/new?channel=email", icon: Megaphone, keywords: ["новая", "рассылка", "кампания", "отправить", "тест", "проверка"] },
  { label: "Импортировать письмо", href: "/templates?import=1", icon: FileInput, keywords: ["импорт", "загрузить", "код", "html", "pdf", "word", "docx", "png", "текст"] },
  { label: "Импортировать контакты", href: "/import", icon: Upload, keywords: ["загрузить", "база", "excel", "xlsx", "csv", "импорт"] },
  { label: "Подключения каналов", href: "/integrations", icon: Plug2, keywords: ["интеграции", "smtp", "почта", "email", "telegram", "вконтакте", "подключить", "отправитель"] },
]) entries.set(item.href, { ...item, description: "", kind: item.href === "/integrations" ? "section" : "action", category: item.href === "/integrations" ? "Настройки" : item.href.startsWith("/campaigns") ? "Рассылки" : "Импорт" });
export const navigationSearchEntries = [...entries.values()];

export function normalizeNavigationQuery(value: string) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}
const latinKeys = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
const russianKeys = "йцукенгшщзхъфывапролджэячсмитьбю";
function correctedKeyboard(value: string) {
  return value.toLowerCase().split("").map(char => { const index = latinKeys.indexOf(char); return index < 0 ? char : russianKeys[index]; }).join("");
}

// One insertion, deletion, substitution or adjacent transposition.
function closeWord(first: string, second: string) {
  if (first.length < 4 || Math.abs(first.length - second.length) > 1) return false;
  if (first.length === second.length) {
    const differences = [...first].flatMap((char, index) => char !== second[index] ? [index] : []);
    return differences.length === 1 || (differences.length === 2 && differences[1] === differences[0] + 1 && first[differences[0]] === second[differences[1]] && first[differences[1]] === second[differences[0]]);
  }
  const shorter = first.length < second.length ? first : second, longer = first.length < second.length ? second : first;
  let index = 0;
  while (index < shorter.length && shorter[index] === longer[index]) index++;
  return shorter.slice(index) === longer.slice(index + 1);
}

function rank(entry: NavigationResult, query: string) {
  const label = normalizeNavigationQuery(entry.label);
  if (label === query) return 0;
  if (label.startsWith(query)) return 1;
  const labelWords = label.split(" ");
  const keywordWords = normalizeNavigationQuery([...(entry.keywords ?? []), entry.category].join(" ")).split(" ");
  const descriptionWords = normalizeNavigationQuery(entry.description).split(" ");
  let score = 3;
  for (const term of query.split(" ")) {
    if (labelWords.includes(term)) continue;
    if (labelWords.some(word => word.startsWith(term))) { score += 1; continue; }
    if (keywordWords.includes(term)) { score += 2; continue; }
    if (keywordWords.some(word => word.startsWith(term))) { score += 3; continue; }
    if (descriptionWords.some(word => word.startsWith(term))) { score += 5; continue; }
    if (labelWords.some(word => closeWord(term, word))) { score += 8; continue; }
    if (keywordWords.some(word => closeWord(term, word))) { score += 10; continue; }
    return Infinity;
  }
  return score;
}

const defaultHrefs = ["/dashboard", "/templates", "/contacts", "/calendar", "/campaigns", "/communications", "/email-builder?new=1", "/templates?import=1", "/presentations?new=1"];
export function searchNavigation(value: string): NavigationResult[] {
  const query = normalizeNavigationQuery(value.slice(0, 160));
  if (!query) return defaultHrefs.flatMap(href => entries.get(href) ? [entries.get(href)!] : []);
  const variants = [query];
  if (/[a-z]/i.test(value)) variants.push(normalizeNavigationQuery(correctedKeyboard(value.slice(0, 160))));
  return navigationSearchEntries.map((entry, order) => ({ entry, order, score: Math.min(...variants.map(variant => rank(entry, variant))) }))
    .filter(result => Number.isFinite(result.score)).sort((a, b) => a.score - b.score || a.order - b.order).map(result => result.entry);
}

export function nextSearchIndex(index: number, key: string, count: number) {
  if (!count) return 0;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return (index + (key === "ArrowUp" ? -1 : 1) + count) % count;
}
