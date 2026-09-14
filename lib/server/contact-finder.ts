import { getWorkspaceId } from "./workspace-context";
import { ApiRequestError, asObject, cleanText, optionalBoolean } from "./api-utils";
import { getD1 } from "@/db";

import { findDiscoveredPhones, isIdentifierPhoneContext, normalizeDiscoveredPhone } from "@/lib/contact-finder/phones";
import type {
  ContactFinderCandidate,
  ContactFinderPageReport,
  ContactFinderRequest,
  ContactFinderResponse,
} from "@/types/contact-finder";

const SAME_SITE_PAGE_LIMIT = 12;
const FETCH_CONCURRENCY = 3;
const MAX_SOURCE_BYTES = 1_500_000;
const MAX_TEXT_LENGTH = 100_000;
const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "Potok-ContactFinder/1.0";
const REQUEST_WINDOW_MS = 10 * 60 * 1_000;
const REQUEST_LIMIT = 20;

type Extraction = Omit<ContactFinderCandidate, "id">;

type RobotsRules = {
  allow: string[];
  disallow: string[];
  sitemaps: string[];
};

type DnsJsonResponse = {
  Status?: number;
  Answer?: Array<{ type?: number; data?: string }>;
};

type ResolutionCache = Map<string, Promise<void>>;

const blockedHostSuffixes = [
  ".local",
  ".localhost",
  ".internal",
  ".test",
  ".invalid",
];

const pagePathHints = [
  "contact",
  "contacts",
  "about",
  "company",
  "team",
  "support",
  "help",
  "privacy",
  "kontakty",
  "kontakti",
  "o-kompanii",
  "komanda",
  "podderzhka",
  "feedback",
  "leadership",
  "management",
  "staff",
  "people",
  "experts",
  "directory",
  "departments",
  "branches",
  "locations",
  "requisites",
  "rekvizity",
  "rukovodstvo",
  "sotrudniki",
  "specialisty",
  "predstavitelstva",
];

const pageLabelHints = [
  "контакт",
  "о компании",
  "команда",
  "руководство",
  "сотрудники",
  "специалисты",
  "реквизиты",
  "офисы",
  "contact",
  "about",
  "team",
  "leadership",
  "management",
  "people",
  "staff",
  "directory",
  "locations",
];

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] >= 224
  );
}

function isUnsafeIpv6(hostname: string): boolean {
  if (!hostname.includes(":")) return false;
  const normalized = hostname.toLowerCase();
  if (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("::ffff:")
  ) {
    return true;
  }
  // Cloudflare Workers do not expose a reliable DNS-pin primitive to a fetch.
  // Reject every literal IPv6 endpoint so an attacker cannot encode a private
  // address in a notation this guard only partially understands.
  return true;
}

function isPrivateResolvedIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("::ffff:")
  );
}

async function dnsAnswers(hostname: string, type: "A" | "AAAA"): Promise<string[]> {
  const endpoint = new URL("https://cloudflare-dns.com/dns-query");
  endpoint.searchParams.set("name", hostname);
  endpoint.searchParams.set("type", type);
  const response = await fetch(endpoint, {
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`DNS HTTP ${response.status}`);
  const payload = (await response.json()) as DnsJsonResponse;
  if (payload.Status !== 0) return [];
  const expectedType = type === "A" ? 1 : 28;
  return (payload.Answer ?? [])
    .filter((answer) => answer.type === expectedType && typeof answer.data === "string")
    .map((answer) => answer.data!);
}

async function assertPublicDns(hostname: string, cache: ResolutionCache): Promise<void> {
  if (isPrivateIpv4(hostname)) {
    throw new ApiRequestError("Локальные и внутренние адреса анализировать нельзя.");
  }
  if (/^\d+(?:\.\d+){3}$/.test(hostname)) return;
  const existing = cache.get(hostname);
  if (existing) return existing;
  // Cloudflare Workers cannot atomically pin this DoH answer to the following
  // HTTPS fetch. This best-effort validation rejects domains whose public DNS
  // currently exposes any private target; safeFetch repeats it on every
  // redirect, while the platform egress policy remains the final boundary.
  const resolution = (async () => {
    try {
      const [ipv4, ipv6] = await Promise.all([
        dnsAnswers(hostname, "A"),
        dnsAnswers(hostname, "AAAA"),
      ]);
      if (ipv4.length === 0 && ipv6.length === 0) {
        throw new ApiRequestError("Не удалось подтвердить публичный DNS-адрес сайта.");
      }
      if (ipv4.some(isPrivateIpv4) || ipv6.some(isPrivateResolvedIpv6)) {
        throw new ApiRequestError("Домен ведёт на локальный или внутренний адрес.");
      }
    } catch (error) {
      if (error instanceof ApiRequestError) throw error;
      throw new ApiRequestError(
        "Не удалось безопасно проверить DNS-адрес сайта. Повторите позже.",
      );
    }
  })();
  cache.set(hostname, resolution);
  return resolution;
}

function assertPublicHttpsUrl(value: unknown): URL {
  const raw = cleanText(value, "Адрес сайта", 2_048);
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new ApiRequestError("Укажите HTTPS-адрес или домен сайта.");
  }
  if (url.protocol !== "https:") {
    throw new ApiRequestError("Для безопасного анализа поддерживаются только HTTPS-адреса.");
  }
  if (url.username || url.password || (url.port && url.port !== "443")) {
    throw new ApiRequestError("Адрес с учётными данными или нестандартным портом не поддерживается.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "0:0:0:0:0:0:0:1" ||
    hostname === "metadata.google.internal" ||
    blockedHostSuffixes.some((suffix) => hostname.endsWith(suffix)) ||
    isPrivateIpv4(hostname) ||
    isUnsafeIpv6(hostname)
  ) {
    throw new ApiRequestError("Локальные и внутренние адреса анализировать нельзя.");
  }
  url.hash = "";
  return url;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => named[name.toLowerCase()] ?? match);
}

function safeCodePoint(code: number): string {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
    ? String.fromCodePoint(code) : "\uFFFD";
}

function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!--[^]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[^]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|li|h[1-6]|td|th|tr|dt|dd|address|section|footer)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageTitle(html: string, fallback: string): string {
  const match = html.match(/<title\b[^>]*>([^]*?)<\/title>/i);
  const title = match ? visibleText(match[1]).slice(0, 120) : "";
  return title || fallback;
}

function nearbyContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + length + 90);
  return text
    .slice(start, end)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function htmlLinkContext(html: string, index: number, matchLength: number): string {
  const anchorStart = html.lastIndexOf("<a", index);
  const anchorEnd = html.indexOf("</a>", index + matchLength);
  const anchor =
    anchorStart >= 0 && anchorEnd >= 0
      ? visibleText(html.slice(anchorStart, anchorEnd + 4))
      : "";
  const parentTags = ["address", "footer", "p", "li"];
  let parent = "";
  for (const tag of parentTags) {
    const start = html.lastIndexOf(`<${tag}`, index);
    if (start < 0 || index - start > 2_000) continue;
    const end = html.indexOf(`</${tag}>`, index + matchLength);
    if (end < 0 || end - start > 4_000) continue;
    parent = visibleText(html.slice(start, end + tag.length + 3));
    if (parent) break;
  }
  const combined = [anchor, parent && parent !== anchor ? parent : ""]
    .filter(Boolean)
    .join(" · ");
  return combined.slice(0, 240);
}

function titleCase(value: string): string {
  return value
    .split(/[._+\-\s]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function suggestedEmailName(email: string, hostname: string): string {
  const local = email.split("@")[0];
  const generic: Record<string, string> = {
    info: "Общий контакт",
    hello: "Общий контакт",
    contact: "Общий контакт",
    contacts: "Общий контакт",
    office: "Офис",
    sales: "Отдел продаж",
    support: "Поддержка",
    press: "Пресс-служба",
    hr: "Отдел персонала",
    careers: "Отдел персонала",
  };
  return generic[local.toLowerCase()] ?? (titleCase(local) || `Контакт ${hostname}`);
}

function deobfuscateContactText(value: string): string {
  return value
    .replace(/\\u0*040|\\x40|%40/gi, "@")
    .replace(/\\u0*02e|\\x2e|%2e/gi, ".")
    .replace(
      /([A-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|\s+собака\s+)\s*([A-Z0-9.-]+)/gi,
      "$1@$2",
    )
    .replace(
      /([A-Z0-9-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\s+точка\s+)\s*([A-Z]{2,24})(?=\b)/gi,
      "$1.$2",
    );
}

function suggestedNameFromContext(context: string, fallback: string): string {
  const compact = context.replace(/\s+/g, " ").trim();
  const role = compact.match(
    /\b(отдел продаж|коммерческий отдел|служба поддержки|пресс-служба|отдел персонала|при[её]мная|sales team|sales department|customer support|press office|human resources)\b/i,
  )?.[1];
  if (role) return `${role.charAt(0).toUpperCase()}${role.slice(1).toLowerCase()}`;
  const person = compact.match(
    /\b([А-ЯЁ][а-яё]{1,30}\s+[А-ЯЁ][а-яё]{1,30}(?:\s+[А-ЯЁ][а-яё]{1,30})?|[A-Z][a-z]{1,30}\s+[A-Z][a-z]{1,30})\b/,
  )?.[1];
  if (!person) return fallback;
  const ignored = /^(общий контакт|контактная информация|наша команда|служба поддержки|отдел продаж)$/i;
  return ignored.test(person) ? fallback : person;
}

function extractFromText(
  input: string,
  sourceUrl: string | null,
  sourceLabel: string,
  hostname: string,
  html = false,
): Extraction[] {
  const decoded = deobfuscateContactText(decodeEntities(input));
  const text = html ? visibleText(decoded) : decoded;
  const results: Extraction[] = [];
  const emailSeen = new Set<string>();
  const phoneSeen = new Set<string>();
  const addEmail = (
    raw: string,
    index: number,
    confidence: "high" | "medium",
    contextOverride?: string,
  ) => {
    const email = deobfuscateContactText(raw)
      .replace(/^mailto:/i, "")
      .split(/[?&#]/)[0]
      .trim()
      .replace(/^[<({]+/, "")
      .replace(/^\[+/, "")
      .replace(/[>)}\],;:.]+$/, "")
      .toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(email) ||
      /@(example\.(com|org|net)|test\.|localhost$)/i.test(email) ||
      emailSeen.has(email)
    ) return;
    emailSeen.add(email);
    const context =
      contextOverride || nearbyContext(text, Math.min(index, text.length), email.length);
    results.push({
      type: "email",
      value: email,
      suggestedName: suggestedNameFromContext(
        context,
        suggestedEmailName(email, hostname),
      ),
      confidence,
      sourceUrl,
      sourceLabel,
      context,
    });
  };
  const addPhone = (
    raw: string,
    index: number,
    confidence: "high" | "medium",
    contextOverride?: string,
  ) => {
    const phone = normalizeDiscoveredPhone(raw);
    if (!phone || phoneSeen.has(phone)) return;
    const context =
      contextOverride || nearbyContext(text, Math.min(index, text.length), raw.length);
    if (isIdentifierPhoneContext(context, phone)) return;
    phoneSeen.add(phone);
    results.push({
      type: "phone",
      value: phone,
      suggestedName: suggestedNameFromContext(context, `Контакт ${hostname}`),
      confidence,
      sourceUrl,
      sourceLabel,
      context,
    });
  };

  if (html) {
    const markup = decoded.replace(/<!--[^]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template)\b[^>]*>[^]*?<\/\1>/gi, " ");
    for (const match of markup.matchAll(/href\s*=\s*["']mailto:([^"']+)["']/gi)) {
      const index = match.index ?? 0;
      addEmail(
        match[1],
        index,
        "high",
        htmlLinkContext(markup, index, match[0].length),
      );
    }
    for (const match of markup.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
      const index = match.index ?? 0;
      addPhone(
        match[1],
        index,
        "high",
        htmlLinkContext(markup, index, match[0].length),
      );
    }
    for (const match of markup.matchAll(
      /data-(?:email|mail|contact-email)\s*=\s*["']([^"']+)["']/gi,
    )) {
      const index = match.index ?? 0;
      addEmail(match[1], index, "high", htmlLinkContext(markup, index, match[0].length));
    }
    for (const match of markup.matchAll(
      /data-(?:phone|tel|telephone|contact-phone)\s*=\s*["']([^"']+)["']/gi,
    )) {
      const index = match.index ?? 0;
      addPhone(match[1], index, "high", htmlLinkContext(markup, index, match[0].length));
    }
    // Only actual JSON contact fields, not quoted strings in arbitrary JS or CSS.
    for (const script of input.matchAll(/<script\b[^>]*type\s*=\s*["']application\/(?:ld\+)?json["'][^>]*>([^]*?)<\/script>/gi)) {
      let visited = 0;
      const visit = (node: unknown, depth = 0) => {
        if (++visited > 500 || depth > 8 || !node || typeof node !== "object") return;
        for (const [key, value] of Object.entries(node)) {
          if (/^(email|contactEmail|telephone|phone|contactPhone)$/i.test(key)) {
            for (const raw of Array.isArray(value) ? value.slice(0, 30) : [value]) {
              if (typeof raw !== "string") continue;
              const context = `${key}: ${raw}`.slice(0, 240);
              if (/email/i.test(key)) addEmail(raw, 0, "high", context);
              else addPhone(raw, 0, "high", context);
            }
          } else if (value && typeof value === "object") visit(value, depth + 1);
        }
      };
      try { visit(JSON.parse(script[1])); } catch { /* Malformed metadata is not contact evidence. */ }
    }
  }
  for (const match of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi)) {
    addEmail(match[0], match.index ?? 0, "medium");
  }
  for (const match of findDiscoveredPhones(text)) {
    addPhone(match.raw, match.start, "medium");
  }
  const emails = results.filter((candidate) => candidate.type === "email");
  const phones = results.filter((candidate) => candidate.type === "phone");
  if (emails.length === 1 && phones.length === 1) {
    phones[0].suggestedName = emails[0].suggestedName;
  }
  return results;
}

function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [], sitemaps: [] };
  let groupAgents: string[] = [];
  let groupRules: Array<{ kind: "allow" | "disallow"; value: string }> = [];
  const commitGroup = () => {
    if (groupAgents.some((agent) => agent === "*" || USER_AGENT.toLowerCase().startsWith(agent))) {
      for (const rule of groupRules) rules[rule.kind].push(rule.value);
    }
    groupAgents = [];
    groupRules = [];
  };
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (key === "sitemap") {
      rules.sitemaps.push(value);
      continue;
    }
    if (key === "user-agent") {
      if (groupRules.length) commitGroup();
      groupAgents.push(value.toLowerCase());
      continue;
    }
    if ((key === "allow" || key === "disallow") && value.startsWith("/")) {
      if (key === "allow" || value !== "") groupRules.push({ kind: key, value });
    }
  }
  commitGroup();
  return rules;
}

function robotsAllows(url: URL, rules: RobotsRules): boolean {
  const path = `${url.pathname}${url.search}`;
  const matchesRule = (rule: string) => {
    const endAnchored = rule.endsWith("$");
    const body = endAnchored ? rule.slice(0, -1) : rule;
    const pattern = body
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${pattern}${endAnchored ? "$" : ""}`).test(path);
  };
  const matches = [
    ...rules.allow.map((rule) => ({ rule, allow: true })),
    ...rules.disallow.map((rule) => ({ rule, allow: false })),
  ]
    .filter(({ rule }) => matchesRule(rule))
    .sort(
      (left, right) =>
        right.rule.replace(/[*$]/g, "").length - left.rule.replace(/[*$]/g, "").length ||
        Number(right.allow) - Number(left.allow),
    );
  return matches[0]?.allow ?? true;
}

async function readLimited(response: Response, maxBytes = MAX_SOURCE_BYTES): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new ApiRequestError("Страница больше допустимого размера (1 МБ).", 413);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiRequestError("Страница больше допустимого размера (1 МБ).", 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function safeFetch(
  url: URL,
  origin: string,
  resolutions: ResolutionCache,
): Promise<Response> {
  let current = url;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertPublicDns(current.hostname.toLowerCase(), resolutions);
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        Accept: "text/html,text/plain;q=0.9",
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    const next = assertPublicHttpsUrl(new URL(location, current).toString());
    if (next.origin !== origin) {
      throw new ApiRequestError("Страница перенаправляет на другой сайт; переход остановлен.");
    }
    current = next;
  }
  throw new ApiRequestError("Слишком много перенаправлений при загрузке страницы.");
}

async function actorHash(request: Request): Promise<string> {
  const actor = request.headers.get("oai-authenticated-user-id")?.trim() || "mailflow-local-participant";
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(actor));
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function reserveAnalysis(request: Request): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const cutoffIso = new Date(now.getTime() - REQUEST_WINDOW_MS).toISOString();
  const key = `${getWorkspaceId()}:contact-finder:${await actorHash(request)}`;
  const rate = await getD1()
    .prepare(`
      INSERT INTO ai_request_limits (key, workspace_id, scope, window_started_at, request_count, updated_at)
      VALUES (?, ?, 'contact-finder', ?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET
        window_started_at = CASE WHEN window_started_at < ? THEN excluded.window_started_at ELSE window_started_at END,
        request_count = CASE WHEN window_started_at < ? THEN 1 ELSE request_count + 1 END,
        updated_at = excluded.updated_at
      WHERE window_started_at < ? OR request_count < ?
      RETURNING request_count
    `)
    .bind(
      key,
      getWorkspaceId(),
      nowIso,
      nowIso,
      cutoffIso,
      cutoffIso,
      cutoffIso,
      REQUEST_LIMIT,
    )
    .first<{ request_count: number }>();
  if (!rate) {
    throw new ApiRequestError(
      "Слишком много проверок за короткое время. Повторите через несколько минут.",
      429,
      [`Лимит: ${REQUEST_LIMIT} проверок за 10 минут.`],
    );
  }
}

function contactPageScore(url: URL, label = ""): number {
  let lowerPath = url.pathname.toLowerCase();
  try {
    lowerPath = decodeURIComponent(url.pathname).toLowerCase();
  } catch {
    // Keep the encoded pathname when a site publishes malformed escapes.
  }
  const lowerLabel = label.toLowerCase();
  const pathHint = pagePathHints.findIndex((hint) => lowerPath.includes(hint));
  const labelHint = pageLabelHints.findIndex((hint) => lowerLabel.includes(hint));
  if (pathHint === -1 && labelHint === -1) return -1;
  const pathScore = pathHint === -1 ? 0 : 130 - pathHint;
  const labelScore = labelHint === -1 ? 0 : 110 - labelHint;
  const depthPenalty = Math.max(0, url.pathname.split("/").filter(Boolean).length - 3) * 4;
  return Math.max(pathScore, labelScore) - depthPenalty - lowerPath.length / 160;
}

function discoverSameSiteLinks(html: string, base: URL): URL[] {
  const candidates = new Map<string, { url: URL; score: number }>();
  for (const match of html.matchAll(
    /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([^]*?)<\/a>/gi,
  )) {
    try {
      const url = new URL(decodeEntities(match[1]), base);
      url.hash = "";
      if (url.origin !== base.origin || url.protocol !== "https:") continue;
      for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_|yclid|gclid|fbclid)/i.test(key)) url.searchParams.delete(key);
      }
      if ([...url.searchParams.keys()].length) continue;
      if (/\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?)(?:$|\?)/i.test(url.pathname)) continue;
      const score = contactPageScore(url, visibleText(match[2]));
      if (score < 0) continue;
      const key = url.toString();
      const current = candidates.get(key);
      if (!current || score > current.score) candidates.set(key, { url, score });
    } catch {
      // Ignore malformed links from the supplied page.
    }
  }
  return [...candidates.values()]
    .sort((left, right) => right.score - left.score)
    .map(({ url }) => url)
    .slice(0, SAME_SITE_PAGE_LIMIT - 1);
}

async function discoverSitemapLinks(
  origin: URL,
  rules: RobotsRules,
  resolutions: ResolutionCache,
): Promise<URL[]> {
  const sitemapUrls = [
    ...rules.sitemaps,
    new URL("/sitemap.xml", origin).toString(),
  ];
  const candidates = new Map<string, { url: URL; score: number }>();
  for (const value of [...new Set(sitemapUrls)].slice(0, 2)) {
    try {
      const sitemapUrl = assertPublicHttpsUrl(value);
      if (sitemapUrl.origin !== origin.origin) continue;
      const response = await safeFetch(sitemapUrl, origin.origin, resolutions);
      if (!response.ok) continue;
      const source = await readLimited(response, 600_000);
      for (const match of source.matchAll(/<loc\b[^>]*>([^<]+)<\/loc>/gi)) {
        try {
          const url = assertPublicHttpsUrl(decodeEntities(match[1].trim()));
          if (url.origin !== origin.origin) continue;
          const score = contactPageScore(url);
          if (score < 0) continue;
          const key = url.toString();
          const current = candidates.get(key);
          if (!current || score > current.score) candidates.set(key, { url, score });
        } catch {
          // Ignore one malformed sitemap entry without discarding the rest.
        }
      }
    } catch {
      // Sitemap discovery is an optional accelerator. Page links remain the
      // authoritative crawl source when a sitemap is absent or malformed.
    }
  }
  return [...candidates.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, SAME_SITE_PAGE_LIMIT - 1)
    .map(({ url }) => url);
}

function deduplicate(candidates: Extraction[]): ContactFinderCandidate[] {
  const byEndpoint = new Map<string, Extraction>();
  for (const candidate of candidates) {
    const key = `${candidate.type}:${candidate.value.toLowerCase()}`;
    const current = byEndpoint.get(key);
    if (!current || (current.confidence === "medium" && candidate.confidence === "high")) {
      byEndpoint.set(key, candidate);
    }
  }
  return [...byEndpoint.values()]
    .sort((left, right) => left.type.localeCompare(right.type) || left.value.localeCompare(right.value))
    .slice(0, 100)
    .map((candidate) => ({ ...candidate, id: crypto.randomUUID() }));
}

function parseRequest(payload: unknown): ContactFinderRequest {
  const object = asObject(payload);
  if (object.acknowledgedResponsibleUse !== true) {
    throw new ApiRequestError(
      "Подтвердите ответственное использование открытых деловых контактов.",
    );
  }
  if (object.mode !== "url" && object.mode !== "text") {
    throw new ApiRequestError("Выберите анализ сайта или вставленного текста.");
  }
  if (object.mode === "url") {
    return {
      mode: "url",
      acknowledgedResponsibleUse: true,
      url: assertPublicHttpsUrl(object.url).toString(),
      includeSameSitePages: optionalBoolean(object.includeSameSitePages, "Обход связанных страниц") ?? true,
    };
  }
  const text = cleanText(object.text, "Текст", MAX_TEXT_LENGTH);
  if (text.length < 3) throw new ApiRequestError("Вставьте текст для анализа.");
  return { mode: "text", text, acknowledgedResponsibleUse: true };
}

async function robotsFor(
  origin: URL,
  resolutions: ResolutionCache,
): Promise<RobotsRules | null> {
  try {
    const response = await safeFetch(
      new URL("/robots.txt", origin),
      origin.origin,
      resolutions,
    );
    if (response.status === 404 || response.status === 410) {
      return { allow: [], disallow: [], sitemaps: [] };
    }
    if (!response.ok) return null;
    return parseRobots(await readLimited(response, 200_000));
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    return null;
  }
}

async function analyzeUrl(input: ContactFinderRequest): Promise<ContactFinderResponse> {
  const start = assertPublicHttpsUrl(input.url);
  const resolutions: ResolutionCache = new Map();
  const rules = await robotsFor(start, resolutions);
  const pages: ContactFinderPageReport[] = [];
  const found: Extraction[] = [];
  if (!rules) {
    return response([], [
      {
        url: start.toString(),
        status: "skipped",
        reason: "robots.txt недоступен — проверка остановлена",
        foundCount: 0,
      },
    ]);
  }
  const queue: URL[] = [start];
  const visited = new Set<string>();
  const queued = new Set<string>([start.toString()]);
  const sitemapPromise = input.includeSameSitePages
    ? discoverSitemapLinks(start, rules, resolutions)
    : Promise.resolve([]);
  let sitemapMerged = false;

  while (queue.length && visited.size < SAME_SITE_PAGE_LIMIT) {
    const batch: URL[] = [];
    while (
      queue.length &&
      batch.length < FETCH_CONCURRENCY &&
      visited.size + batch.length < SAME_SITE_PAGE_LIMIT
    ) {
      const url = queue.shift()!;
      const key = url.toString();
      if (visited.has(key) || batch.some((item) => item.toString() === key)) continue;
      batch.push(url);
    }
    const outcomes = await Promise.all(
      batch.map(async (url) => {
        const key = url.toString();
        if (!robotsAllows(url, rules)) {
          return {
            page: {
              url: key,
              status: "skipped" as const,
              reason: "Запрещено robots.txt",
              foundCount: 0,
            },
            extracted: [] as Extraction[],
            links: [] as URL[],
          };
        }
        try {
          const fetched = await safeFetch(url, start.origin, resolutions);
          if (!fetched.ok) {
            return {
              page: {
                url: key,
                status: "skipped" as const,
                reason: `HTTP ${fetched.status}`,
                foundCount: 0,
              },
              extracted: [] as Extraction[],
              links: [] as URL[],
            };
          }
          const contentType = fetched.headers.get("content-type")?.toLowerCase() ?? "";
          if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            return {
              page: {
                url: key,
                status: "skipped" as const,
                reason: "Формат страницы не поддерживается",
                foundCount: 0,
              },
              extracted: [] as Extraction[],
              links: [] as URL[],
            };
          }
          const source = await readLimited(fetched);
          const extracted = extractFromText(
            source,
            key,
            pageTitle(source, url.hostname),
            url.hostname,
            contentType.includes("html"),
          );
          return {
            page: {
              url: key,
              status: "scanned" as const,
              reason: null,
              foundCount: extracted.length,
            },
            extracted,
            links: input.includeSameSitePages
              ? discoverSameSiteLinks(source, url)
              : [],
          };
        } catch (error) {
          const message = error instanceof ApiRequestError
            ? error.message
            : error instanceof Error && error.name === "TimeoutError"
              ? "Время загрузки истекло"
              : "Не удалось загрузить страницу";
          return {
            page: {
              url: key,
              status: "skipped" as const,
              reason: message,
              foundCount: 0,
            },
            extracted: [] as Extraction[],
            links: [] as URL[],
          };
        }
      }),
    );
    for (let index = 0; index < outcomes.length; index += 1) {
      const outcome = outcomes[index];
      const url = batch[index];
      visited.add(url.toString());
      pages.push(outcome.page);
      found.push(...outcome.extracted);
      for (const link of outcome.links) {
        const key = link.toString();
        if (!visited.has(key) && !queued.has(key)) {
          queued.add(key);
          queue.push(link);
        }
      }
    }
    if (!sitemapMerged && input.includeSameSitePages) {
      sitemapMerged = true;
      for (const link of await sitemapPromise) {
        const key = link.toString();
        if (!visited.has(key) && !queued.has(key)) {
          queued.add(key);
          queue.push(link);
        }
      }
    }
  }

  const candidates = deduplicate(found);
  return response(candidates, pages);
}

function response(
  candidates: ContactFinderCandidate[],
  pages: ContactFinderPageReport[],
): ContactFinderResponse {
  return {
    candidates,
    pages,
    summary: {
      emailCount: candidates.filter((candidate) => candidate.type === "email").length,
      phoneCount: candidates.filter((candidate) => candidate.type === "phone").length,
      scannedPageCount: pages.filter((page) => page.status === "scanned").length,
    },
    policy: {
      persisted: false,
      sameSiteLimit: SAME_SITE_PAGE_LIMIT,
      message: "Результаты анализа не сохраняются. В контакты попадут только выбранные вами записи, без согласия на рассылку.",
    },
  };
}

export async function findPublicContacts(
  payload: unknown,
  request?: Request,
): Promise<ContactFinderResponse> {
  if (request) await reserveAnalysis(request);
  const input = parseRequest(payload);
  if (input.mode === "url") return analyzeUrl(input);
  const candidates = deduplicate(
    extractFromText(input.text ?? "", null, "Вставленный текст", "из текста"),
  );
  return response(candidates, []);
}
