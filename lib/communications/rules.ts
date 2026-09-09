import type { ContactRecord } from "@/types/api";
export const replyCategories = {
    interested: "Интересуется", later: "Не сейчас", details: "Просит подробности", colleague: "Передал коллегу",
    call: "Просит позвонить", refusal: "Отказ", unsubscribe: "Отписка", automatic: "Автоответ", review: "Требует разбора",
} as const;
export type ReplyCategory = keyof typeof replyCategories;
export type Channel = "email" | "telegram" | "vk";
export type ConsentState = "confirmed" | "review" | "missing" | "expired" | "revoked";
export type Evidence = {
    id: string;
    endpoint: string;
    channel: string;
    purpose: string;
    kind: string;
    source: string;
    obtained_at: string;
    expires_at: string | null;
    version: string;
    statement: string;
    operator: string;
    created_at: string;
    digest: string;
};
export type ReplyAnalysis = {
    category: ReplyCategory;
    confidence: number;
    quote: string;
    suggestedDate: string | null;
    suggestedAction: string | null;
    classifier: string;
};
export function endpointFor(contact: ContactRecord, channel: Channel) {
    return (channel === "email" ? contact.email.trim().toLowerCase() : channel === "telegram" ? contact.telegramChatId : contact.vkUserId) || "";
}
export function companyKey(contact: ContactRecord) {
    return contact.companyId ? `id:${contact.companyId}` : contact.companyName.trim() ? `name:${contact.companyName.trim()}` : "";
}
export function consentState(contact: ContactRecord, channel: Channel, purpose: string, evidence: Evidence[], at: string): ConsentState {
    const endpoint = endpointFor(contact, channel);
    if (contact.status === "unsubscribed")
        return "revoked";
    const latest = evidence.filter(e => e.endpoint === endpoint && e.channel === channel && e.purpose === purpose)
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || Number(b.kind === "revoke") - Number(a.kind === "revoke") || b.obtained_at.localeCompare(a.obtained_at) || b.id.localeCompare(a.id))[0];
    if (latest) {
        if (latest.kind === "revoke")
            return "revoked";
        if (latest.expires_at && Date.parse(latest.expires_at) <= Date.parse(at))
            return "expired";
        if (Date.parse(latest.obtained_at) > Date.parse(at))
            return "review";
        return latest.operator && latest.version && latest.statement && latest.source ? "confirmed" : "review";
    }
    if (purpose === "transactional" && channel === "email" && contact.serviceEmailAllowed && contact.serviceEmailBasis && contact.serviceEmailAllowedAt)
        return "confirmed";
    const oldConsent = channel === "email" ? contact.emailConsent : channel === "telegram" ? contact.telegramConsent : contact.vkConsent;
    return oldConsent ? "review" : "missing";
}
export function usagePercent(count: number, limit: number) { return Math.round(count / Math.max(1, limit) * 100); }
export function classifyReply(text: string, receivedAt: string): ReplyAnalysis {
    const clean = text.replace(/\r/g, "").split(/\n(?:On .+wrote:|От:|From:|_{4,}|>{1,})/i)[0].trim();
    const patterns: [
        ReplyCategory,
        RegExp
    ][] = [
        ["unsubscribe", /отпиш|не (?:пишите|присылайте|отправляйте)|удалите (?:меня|мой)|unsubscribe|remove me/i],
        ["automatic", /автоответ|автоматический ответ|out of office|automatic reply|в отпуске/i],
        ["later", /не сейчас|позже|после\s+\d|вернитесь|свяжитесь.*(?:сентябр|октябр|ноябр|декабр|январ|феврал|март|апрел|ма[йя]|июн|июл|август)/i],
        ["call", /позвон|созвон|call me/i], ["colleague", /коллег|передал|переслал|forwarded/i],
        ["details", /подробност|пришлите|расскажите|more info/i], ["refusal", /не интерес|не актуал|отказыва|not interested/i],
        ["interested", /интересно|интересует|готов.*(?:обсуд|участв)|давайте|interested/i],
    ];
    const category = patterns.find(([, pattern]) => pattern.test(clean))?.[0] ?? "review";
    const months = ["январ", "феврал", "март", "апрел", "мая", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
    const date = clean.match(/(после|с|до)\s+(\d{1,2})\s+(январ\S*|феврал\S*|март\S*|апрел\S*|мая|июн\S*|июл\S*|август\S*|сентябр\S*|октябр\S*|ноябр\S*|декабр\S*)(?:\s+(20\d{2}))?/i);
    let suggestedDate: string | null = null;
    if (date) {
        const year = date[4] ? Number(date[4]) : new Date(receivedAt).getUTCFullYear();
        const month = months.findIndex(m => date[3].toLowerCase().startsWith(m));
        const day = Number(date[2]);
        const candidate = new Date(Date.UTC(year, month, day));
        if (candidate.getUTCMonth() === month && day > 0) {
            if (date[1].toLowerCase() === "после")
                candidate.setUTCDate(day + 1);
            // Never silently guess next year if the inferred date has already passed.
            if (candidate.toISOString().slice(0, 10) >= receivedAt.slice(0, 10))
                suggestedDate = candidate.toISOString().slice(0, 10);
        }
    }
    return { category, confidence: category === "review" ? 0 : 80, quote: clean.slice(0, 500), suggestedDate,
        suggestedAction: /позвон|созвон|call me/i.test(clean) ? "Позвонить" : ["unsubscribe", "automatic", "refusal"].includes(category) ? null : "Связаться",
        classifier: "Правила; требуется проверка" };
}
