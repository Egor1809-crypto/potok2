import { findPhoneNumbersInText, parsePhoneNumberFromString } from "libphonenumber-js/max";

// A numbering-plan match alone cannot distinguish an INN from a Russian mobile.
// Match Unicode word boundaries: JavaScript's \b does not delimit Cyrillic labels.
const IDENTIFIER_LABEL = String.raw`(?:инн|кпп|огрнип|огрн|окпо|октмо|окато|бик|снилс|р\s*\/\s*с|к\s*\/\s*с|расч[её]тный\s+сч[её]т|корреспондентский\s+сч[её]т|лицевой\s+сч[её]т|номер\s+(?:сч[её]та|заказа|договора)|паспорт|артикул|iban|swift|vat(?:\s*(?:id|number))?|tax\s*(?:id|number)|registration\s*(?:id|number)|account\s*(?:no\.?|number)|order\s*(?:id|number))`;
const PHONE_LABEL = String.raw`(?:номер\s+телефона|телефон(?:ы|а)?(?:\s+для\s+связи)?|тел\.?|моб\.?|мобильный|факс|горячая\s+линия|звоните|позвонить|whatsapp|phone|telephone|tel\.?|mobile|fax|call)`;
const fieldLabels = new RegExp(String.raw`(?<![\p{L}\p{N}_])(?:(?<identifier>${IDENTIFIER_LABEL})|(?<phone>${PHONE_LABEL}))(?![\p{L}\p{N}_])`, "giu");
const identifierAfter = new RegExp(String.raw`^[\t ]*(?:[—–-][\t ]*|\()${IDENTIFIER_LABEL}[\t ]*(?:\)|$|[.;]?(?:\r?\n))`, "iu");

function fieldBefore(text: string, index: number): "identifier" | "phone" | null {
  const before = text.slice(Math.max(0, index - 100), index);
  const labels = [...before.matchAll(fieldLabels)];
  const last = labels.at(-1);
  if (!last) return null;
  // The label must describe this value, not another field earlier in a footer.
  const between = before.slice(last.index! + last[0].length);
  if (/\p{L}/u.test(between)) return null;
  // A phone label can introduce a comma-separated list, but not the next row.
  if (/\d/u.test(between) && (last.groups?.identifier || /[\r\n]/.test(between))) return null;
  return last.groups?.identifier ? "identifier" : "phone";
}

export function isIdentifierAt(text: string, start: number, end: number): boolean {
  return fieldBefore(text, start) === "identifier" || identifierAfter.test(text.slice(end, end + 70));
}

export function normalizeDiscoveredPhone(raw: string): string | null {
  let value = raw.trim().replace(/^tel:/i, "");
  try { value = decodeURIComponent(value); } catch { return null; }
  value = value.replace(/[‐‑‒–—−]/g, "-").replace(/\s+/g, " ").split(/[?&#]/)[0];
  const phone = parsePhoneNumberFromString(value, { defaultCountry: "RU", extract: false });
  // Validate prefixes as well as length. Do not manufacture an international
  // country code by prepending '+' to arbitrary digits.
  return phone?.isValid() ? phone.number : null;
}

export function isIdentifierPhoneContext(context: string, phone: string): boolean {
  return findPhoneNumbersInText(context, "RU").some(match =>
    match.number.number === phone && isIdentifierAt(context, match.startsAt, match.endsAt));
}

export function findDiscoveredPhones(text: string): Array<{ raw: string; start: number; end: number }> {
  const results: Array<{ raw: string; start: number; end: number }> = [];
  // Preserve line boundaries, so adjacent table rows / phone numbers cannot merge.
  // Commas can mean a dialing extension to libphonenumber. In public prose,
  // treat list separators as boundaries instead of swallowing the next phone.
  for (const line of text.matchAll(/[^,;|\r\n]+/g)) {
    const normalized = line[0].replace(/[‐‑‒–—−]/g, "-");
    for (const match of findPhoneNumbersInText(normalized, "RU")) {
      const start = line.index! + match.startsAt, end = line.index! + match.endsAt;
      const raw = text.slice(start, end);
      if (isIdentifierAt(text, start, end)) continue;
      // Exclude identifiers embedded in an email, URL, item code or longer number.
      if (/[\p{L}\p{N}_@/]/u.test(text[start - 1] ?? "") || /[\p{L}\p{N}_@/]/u.test(text[end] ?? "")) continue;
      const grouped = (raw.match(/\d+/g)?.length ?? 0) >= 3 && /[() -]/.test(raw);
      const labelled = fieldBefore(text, start) === "phone";
      if (!raw.startsWith("+") && !grouped && !labelled) continue;
      results.push({ raw, start, end });
    }
  }
  return results;
}
