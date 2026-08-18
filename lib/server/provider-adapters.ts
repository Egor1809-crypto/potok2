/**
 * Thin, stateless adapters for the provider APIs used by MAILFLOW.
 *
 * They deliberately accept `fetchFn` and credentials as arguments. This keeps
 * secrets in the server runtime and makes every external call mockable in unit
 * tests. None of the functions retries: a timeout, network error or HTTP 5xx is
 * classified as ambiguous because the provider may have accepted the request.
 */

export const SUPPORTED_MERGE_TOKENS = [
  "first_name",
  "last_name",
  "company",
  "position",
  "city",
] as const;

export type MergeToken = (typeof SUPPORTED_MERGE_TOKENS)[number];
export type MergeFields = Partial<Record<MergeToken, string>>;

const SUPPORTED_TOKEN_SET = new Set<string>(SUPPORTED_MERGE_TOKENS);
const TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_]+)(?:\|([^}]*))?\s*}}/g;

export function extractMergeTokens(value: string): string[] {
  return Array.from(value.matchAll(TOKEN_PATTERN), (match) => match[1]);
}

export function unknownMergeTokens(...values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .flatMap(extractMergeTokens)
        .filter((token) => !SUPPORTED_TOKEN_SET.has(token)),
    ),
  );
}

export function renderMergeTemplate(value: string, fields: MergeFields): string {
  const unknown = unknownMergeTokens(value);
  if (unknown.length) {
    throw new Error(`Неизвестные поля персонализации: ${unknown.join(", ")}.`);
  }
  return value.replace(
    TOKEN_PATTERN,
    (_token, field: MergeToken, fallback?: string) =>
      fields[field]?.trim() || fallback?.trim() || "",
  );
}

export type ProviderCallStatus = "accepted" | "rejected" | "ambiguous";

export type ProviderCallResult = {
  status: ProviderCallStatus;
  externalId?: string;
  message: string;
};

export type ProviderCheckResult = {
  ok: boolean;
  message: string;
  identity?: string;
};

export type FetchLike = typeof fetch;

const TELEGRAM_API = "https://api.telegram.org";
const VK_API = "https://api.vk.com/method";
const VK_API_VERSION = "5.199";
const UNISENDER_API = "https://api.unisender.com/ru/api";

function providerMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  for (const candidate of [record.description, record.error, record.message]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim().slice(0, 500);
    }
  }
  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    if (typeof nested.error_msg === "string") {
      return nested.error_msg.trim().slice(0, 500);
    }
  }
  return fallback;
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function ambiguousFailure(error: unknown, provider: string): ProviderCallResult {
  const reason = error instanceof Error && error.name === "AbortError"
    ? "тайм-аут"
    : "сетевая ошибка";
  return {
    status: "ambiguous",
    message: `${provider}: ${reason}; результат нужно сверить у провайдера перед повтором.`,
  };
}

function formBody(entries: Array<[string, string | number]>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of entries) body.append(key, String(value));
  return body;
}

function encodedBinaryField(name: string, bytes: Uint8Array) {
  const encodedName = encodeURIComponent(name);
  let encodedValue = "";
  for (const byte of bytes) {
    const character = String.fromCharCode(byte);
    encodedValue += /[A-Za-z0-9_.~-]/.test(character)
      ? character
      : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return `${encodedName}=${encodedValue}`;
}

export async function checkTelegramBot(input: {
  token: string;
  expectedUsername?: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<ProviderCheckResult> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const response = await fetchFn(
      `${TELEGRAM_API}/bot${encodeURIComponent(input.token)}/getMe`,
      { method: "GET", signal: input.signal },
    );
    const body = await responseJson(response) as {
      ok?: boolean;
      description?: string;
      result?: { username?: string; id?: number };
    } | null;
    if (!response.ok || !body?.ok || !body.result) {
      return { ok: false, message: providerMessage(body, `Telegram вернул HTTP ${response.status}.`) };
    }
    const username = body.result.username ?? "";
    if (
      input.expectedUsername &&
      username.toLocaleLowerCase("en") !== input.expectedUsername.replace(/^@/, "").toLocaleLowerCase("en")
    ) {
      return {
        ok: false,
        message: `Токен принадлежит боту @${username || "без имени"}, а в настройках указан другой бот.`,
      };
    }
    return {
      ok: true,
      identity: username ? `@${username}` : String(body.result.id ?? ""),
      message: `Telegram Bot API подтвердил бота ${username ? `@${username}` : body.result.id}.`,
    };
  } catch (error) {
    return { ok: false, message: ambiguousFailure(error, "Telegram Bot API").message };
  }
}

export async function sendTelegramMessage(input: {
  token: string;
  chatId: string;
  text: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<ProviderCallResult> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const response = await fetchFn(
      `${TELEGRAM_API}/bot${encodeURIComponent(input.token)}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: input.chatId, text: input.text }),
        signal: input.signal,
      },
    );
    const body = await responseJson(response) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    } | null;
    if (response.status >= 500) {
      return { status: "ambiguous", message: `Telegram вернул HTTP ${response.status}; автоматический повтор отключён.` };
    }
    if (!response.ok || !body?.ok || !body.result?.message_id) {
      return { status: "rejected", message: providerMessage(body, `Telegram отклонил запрос (HTTP ${response.status}).`) };
    }
    return {
      status: "accepted",
      externalId: String(body.result.message_id),
      message: "Telegram принял сообщение.",
    };
  } catch (error) {
    return ambiguousFailure(error, "Telegram");
  }
}

export async function checkVkCommunity(input: {
  accessToken: string;
  communityId: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<ProviderCheckResult> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const body = formBody([
      ["group_id", input.communityId],
      ["access_token", input.accessToken],
      ["v", VK_API_VERSION],
    ]);
    const response = await fetchFn(`${VK_API}/groups.getById`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: input.signal,
    });
    const payload = await responseJson(response) as {
      response?: { groups?: Array<{ id?: number; name?: string }> } | Array<{ id?: number; name?: string }>;
      error?: { error_msg?: string };
    } | null;
    const groups = Array.isArray(payload?.response)
      ? payload.response
      : payload?.response?.groups;
    const group = groups?.[0];
    if (!response.ok || payload?.error || !group) {
      return { ok: false, message: providerMessage(payload, `VK API вернул HTTP ${response.status}.`) };
    }
    if (group.id !== undefined && String(group.id) !== String(input.communityId).replace(/^-/, "")) {
      return { ok: false, message: "Ключ VK не подтвердил указанное сообщество." };
    }
    return {
      ok: true,
      identity: group.name ?? String(group.id ?? input.communityId),
      message: `VK API подтвердил сообщество «${group.name ?? group.id}».`,
    };
  } catch (error) {
    return { ok: false, message: ambiguousFailure(error, "VK API").message };
  }
}

export function deterministicVkRandomId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) & 0x7fffffff || 1;
}

export async function sendVkMessage(input: {
  accessToken: string;
  peerId: string;
  message: string;
  idempotencyKey: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<ProviderCallResult> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const randomId = deterministicVkRandomId(input.idempotencyKey);
    const body = formBody([
      ["peer_id", input.peerId],
      ["random_id", randomId],
      ["message", input.message],
      ["access_token", input.accessToken],
      ["v", VK_API_VERSION],
    ]);
    const response = await fetchFn(`${VK_API}/messages.send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: input.signal,
    });
    const payload = await responseJson(response) as {
      response?: number | { message_id?: number };
      error?: { error_msg?: string };
    } | null;
    if (response.status >= 500) {
      return { status: "ambiguous", message: `VK вернул HTTP ${response.status}; повтор не выполнялся. random_id=${randomId}.` };
    }
    if (!response.ok || payload?.error || payload?.response === undefined) {
      return { status: "rejected", message: providerMessage(payload, `VK отклонил запрос (HTTP ${response.status}).`) };
    }
    const externalId = typeof payload.response === "number"
      ? payload.response
      : payload.response.message_id;
    return {
      status: "accepted",
      externalId: externalId === undefined ? String(randomId) : String(externalId),
      message: "VK принял сообщение.",
    };
  } catch (error) {
    return ambiguousFailure(error, "VK");
  }
}

type UniSenderEnvelope<T> = {
  result?: T;
  error?: string;
  code?: string;
  warnings?: Array<{ warning?: string }>;
};

async function callUniSender<T>(input: {
  method: string;
  apiKey: string;
  parameters?: Array<[string, string | number]>;
  binaryParameters?: Array<[string, Uint8Array]>;
  fetchFn: FetchLike;
  signal?: AbortSignal;
}): Promise<{ response: Response; body: UniSenderEnvelope<T> | null }> {
  const body = formBody([
    ["format", "json"],
    ["api_key", input.apiKey],
    ...(input.parameters ?? []),
  ]);
  const encoded = [body.toString(), ...(input.binaryParameters ?? []).map(([name, bytes]) => encodedBinaryField(name, bytes))].filter(Boolean).join("&");
  const response = await input.fetchFn(`${UNISENDER_API}/${input.method}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encoded,
    signal: input.signal,
  });
  return { response, body: await responseJson(response) as UniSenderEnvelope<T> | null };
}

export async function checkUniSender(input: {
  apiKey: string;
  expectedListId?: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<ProviderCheckResult> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const { response, body } = await callUniSender<Array<{ id?: number; title?: string }>>({
      method: "getLists",
      apiKey: input.apiKey,
      fetchFn,
      signal: input.signal,
    });
    if (!response.ok || body?.error || !Array.isArray(body?.result)) {
      return { ok: false, message: providerMessage(body, `UniSender вернул HTTP ${response.status}.`) };
    }
    if (input.expectedListId && !body.result.some((list) => String(list.id) === input.expectedListId)) {
      return { ok: false, message: "UniSender не вернул указанный список получателей." };
    }
    return {
      ok: true,
      identity: input.expectedListId || `${body.result.length} списков`,
      message: input.expectedListId
        ? "UniSender подтвердил API-ключ и список получателей. Адрес отправителя проверяется отдельно при создании письма."
        : "UniSender подтвердил API-ключ.",
    };
  } catch (error) {
    return { ok: false, message: ambiguousFailure(error, "UniSender").message };
  }
}

export type UniSenderRecipient = {
  email: string;
  name: string;
  outboxId: string;
  mergeFields?: MergeFields;
};

export type UniSenderCampaignResult = ProviderCallResult & {
  messageId?: string;
  campaignId?: string;
  acceptedOutboxIds: string[];
  rejectedOutboxIds: string[];
};

export type UniSenderCampaignStatsResult = ProviderCallResult & {
  providerStatus?: string;
  total: number;
  sent: number;
  delivered: number;
  readUnique: number;
  clickedUnique: number;
  unsubscribed: number;
  spam: number;
};

export async function getUniSenderCampaignStats(input: {
  apiKey: string;
  campaignId: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<UniSenderCampaignStatsResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const empty = {
    total: 0,
    sent: 0,
    delivered: 0,
    readUnique: 0,
    clickedUnique: 0,
    unsubscribed: 0,
    spam: 0,
  };
  try {
    const [campaignStatus, commonStats] = await Promise.all([
      callUniSender<{ status?: string; status_comment?: string }>({
        method: "getCampaignStatus",
        apiKey: input.apiKey,
        parameters: [["campaign_id", input.campaignId]],
        fetchFn,
        signal: input.signal,
      }),
      callUniSender<{
        total?: number;
        sent?: number;
        delivered?: number;
        read_unique?: number;
        clicked_unique?: number;
        unsubscribed?: number;
        spam?: number;
      }>({
        method: "getCampaignCommonStats",
        apiKey: input.apiKey,
        parameters: [["campaign_id", input.campaignId]],
        fetchFn,
        signal: input.signal,
      }),
    ]);
    if (campaignStatus.response.status >= 500 || commonStats.response.status >= 500) {
      return { status: "ambiguous", message: "UniSender временно не вернул статус доставки.", ...empty };
    }
    if (!campaignStatus.response.ok || campaignStatus.body?.error || !campaignStatus.body?.result?.status) {
      return { status: "rejected", message: providerMessage(campaignStatus.body, "UniSender не вернул статус кампании."), ...empty };
    }
    if (!commonStats.response.ok || commonStats.body?.error || !commonStats.body?.result) {
      return { status: "rejected", message: providerMessage(commonStats.body, "UniSender не вернул статистику доставки."), ...empty };
    }
    const stats = commonStats.body.result;
    const providerStatus = campaignStatus.body.result.status;
    const sent = Number(stats.sent ?? 0);
    const delivered = Number(stats.delivered ?? 0);
    return {
      status: "accepted",
      externalId: input.campaignId,
      providerStatus,
      total: Number(stats.total ?? 0),
      sent,
      delivered,
      readUnique: Number(stats.read_unique ?? 0),
      clickedUnique: Number(stats.clicked_unique ?? 0),
      unsubscribed: Number(stats.unsubscribed ?? 0),
      spam: Number(stats.spam ?? 0),
      message: providerStatus === "analysed"
        ? `UniSender завершил рассылку: доставлено ${delivered} из ${sent}.`
        : `UniSender обрабатывает рассылку, текущий статус: ${providerStatus}.`,
    };
  } catch (error) {
    return { ...ambiguousFailure(error, "UniSender"), ...empty };
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function createUniSenderCampaign(input: {
  apiKey: string;
  listId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: Array<{ filename: string; bytes: Uint8Array }>;
  recipients: UniSenderRecipient[];
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<UniSenderCampaignResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const allOutboxIds = input.recipients.map((recipient) => recipient.outboxId);
  try {
    const providerFieldByToken = {
      first_name: "mailflow_first_name",
      last_name: "mailflow_last_name",
      company: "mailflow_company",
      position: "mailflow_position",
      city: "mailflow_city",
    } as const;
    const sourceWithTokens = `${input.subject}\n${input.textBody}\n${input.htmlBody ?? ""}`;
    const requestedTokens = Array.from(new Set(extractMergeTokens(sourceWithTokens)));
    const unknownTokens = unknownMergeTokens(sourceWithTokens);
    if (unknownTokens.length) {
      return {
        status: "rejected",
        message: `UniSender: неизвестные поля персонализации ${unknownTokens.join(", ")}.`,
        acceptedOutboxIds: [],
        rejectedOutboxIds: allOutboxIds,
      };
    }
    const mergeTokens = requestedTokens as MergeToken[];
    if (mergeTokens.length) {
      const fields = await callUniSender<Array<{ name?: string }>>({
        method: "getFields",
        apiKey: input.apiKey,
        fetchFn,
        signal: input.signal,
      });
      if (fields.response.status >= 500) {
        return {
          status: "ambiguous",
          message: `UniSender вернул HTTP ${fields.response.status} при проверке merge-полей; повтор отключён.`,
          acceptedOutboxIds: [],
          rejectedOutboxIds: [],
        };
      }
      if (!fields.response.ok || fields.body?.error || !Array.isArray(fields.body?.result)) {
        return {
          status: "rejected",
          message: providerMessage(fields.body, "UniSender не вернул список merge-полей."),
          acceptedOutboxIds: [],
          rejectedOutboxIds: allOutboxIds,
        };
      }
      const existingFields = new Set(
        fields.body.result.map((field) => field.name?.toLocaleLowerCase("en")),
      );
      for (const token of mergeTokens) {
        const providerField = providerFieldByToken[token];
        if (existingFields.has(providerField.toLocaleLowerCase("en"))) continue;
        const created = await callUniSender<{ id?: number }>({
          method: "createField",
          apiKey: input.apiKey,
          parameters: [
            ["name", providerField],
            ["type", "string"],
            ["public_name", `Поток ${token}`],
          ],
          fetchFn,
          signal: input.signal,
        });
        if (created.response.status >= 500) {
          return {
            status: "ambiguous",
            message: `UniSender вернул HTTP ${created.response.status} при создании merge-поля; повтор отключён.`,
            acceptedOutboxIds: [],
            rejectedOutboxIds: [],
          };
        }
        if (!created.response.ok || created.body?.error || !created.body?.result?.id) {
          return {
            status: "rejected",
            message: providerMessage(created.body, `UniSender не создал поле ${providerField}.`),
            acceptedOutboxIds: [],
            rejectedOutboxIds: allOutboxIds,
          };
        }
      }
    }
    const translateTokens = (value: string) => value.replace(
      /{{\s*([a-zA-Z0-9_]+)(\|[^}]*)?\s*}}/g,
      (_token, rawField: string, fallback = "") =>
        `{{${providerFieldByToken[rawField as keyof typeof providerFieldByToken]}${fallback}}}`,
    );
    const validRecipients: UniSenderRecipient[] = [];
    const rejectedOutboxIds: string[] = [];
    const importErrorCodes = new Map<string, number>();
    for (let offset = 0; offset < input.recipients.length; offset += 500) {
      const batch = input.recipients.slice(offset, offset + 500);
      const importParameters: Array<[string, string | number]> = [
        ["field_names[0]", "email"],
        ["field_names[1]", "Name"],
        ["field_names[2]", "email_list_ids"],
        ["overwrite_lists", 0],
      ];
      mergeTokens.forEach((token, index) => {
        importParameters.push([
          `field_names[${index + 3}]`,
          providerFieldByToken[token],
        ]);
      });
      batch.forEach((recipient, index) => {
        importParameters.push(
          [`data[${index}][0]`, recipient.email],
          [`data[${index}][1]`, recipient.name],
          [`data[${index}][2]`, input.listId],
        );
        mergeTokens.forEach((token, fieldIndex) => {
          importParameters.push([
            `data[${index}][${fieldIndex + 3}]`,
            recipient.mergeFields?.[token] ?? "",
          ]);
        });
      });
      const imported = await callUniSender<{
        invalid?: number;
        log?: Array<{ index?: number | string; code?: string; message?: string }>;
      }>({
        method: "importContacts",
        apiKey: input.apiKey,
        parameters: importParameters,
        fetchFn,
        signal: input.signal,
      });
      if (imported.response.status >= 500) {
        return {
          status: "ambiguous",
          message: `UniSender вернул HTTP ${imported.response.status} при импорте партии; повтор отключён.`,
          acceptedOutboxIds: [],
          rejectedOutboxIds,
        };
      }
      if (!imported.response.ok || imported.body?.error || !imported.body?.result) {
        return {
          status: "rejected",
          message: providerMessage(imported.body, "UniSender отклонил импорт партии контактов."),
          acceptedOutboxIds: [],
          rejectedOutboxIds: allOutboxIds,
        };
      }
      const invalidIndexes = new Set(
        (imported.body.result.log ?? [])
          .filter((entry) => String(entry.code ?? "").startsWith("e_"))
          .map((entry) => Number(entry.index))
          .filter(Number.isInteger),
      );
      for (const entry of imported.body.result.log ?? []) {
        const code = String(entry.code ?? "");
        if (!code.startsWith("e_")) continue;
        importErrorCodes.set(code, (importErrorCodes.get(code) ?? 0) + 1);
      }
      batch.forEach((recipient, index) => {
        if (invalidIndexes.has(index)) rejectedOutboxIds.push(recipient.outboxId);
        else validRecipients.push(recipient);
      });
    }
    if (!validRecipients.length) {
      const details = Array.from(importErrorCodes.entries())
        .map(([code, count]) => `${code} (${count})`)
        .join(", ");
      return {
        status: "rejected",
        message: details
          ? `UniSender не принял ни одного email-адреса из аудитории: ${details}.`
          : "UniSender не принял ни одного email-адреса из аудитории.",
        acceptedOutboxIds: [],
        rejectedOutboxIds: allOutboxIds,
      };
    }

    const htmlBody = input.htmlBody
      ? translateTokens(input.htmlBody)
      : `<div>${escapeHtml(translateTokens(input.textBody)).replaceAll("\n", "<br>")}</div>`;
    const message = await callUniSender<{ message_id?: number }>({
      method: "createEmailMessage",
      apiKey: input.apiKey,
      parameters: [
        ["sender_name", input.senderName],
        ["sender_email", input.senderEmail],
        ["subject", translateTokens(input.subject)],
        ["body", htmlBody],
        ["text_body", translateTokens(input.textBody)],
        ["list_id", input.listId],
        ["lang", "ru"],
        ["images_as", "attachments"],
      ],
      binaryParameters: input.attachments?.map((attachment) => [
        `attachments[${attachment.filename.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._ -]/g, "_")}]`,
        attachment.bytes,
      ]),
      fetchFn,
      signal: input.signal,
    });
    if (message.response.status >= 500) {
      return {
        status: "ambiguous",
        message: `UniSender вернул HTTP ${message.response.status} при создании письма; повтор отключён.`,
        acceptedOutboxIds: [],
        rejectedOutboxIds,
      };
    }
    if (!message.response.ok || message.body?.error || !message.body?.result?.message_id) {
      return {
        status: "rejected",
        message: providerMessage(message.body, "UniSender не создал email-сообщение."),
        acceptedOutboxIds: [],
        rejectedOutboxIds: allOutboxIds,
      };
    }
    const messageId = String(message.body.result.message_id);

    const campaign = await callUniSender<{ campaign_id?: number }>({
      method: "createCampaign",
      apiKey: input.apiKey,
      parameters: [
        ["message_id", messageId],
        ["track_read", 1],
        ["track_links", 1],
        // The configured list can contain contacts from other MAILFLOW
        // campaigns. The provider-supported contacts filter is therefore the
        // final, explicit audience boundary for this immutable dispatch.
        ["contacts", validRecipients.map((recipient) => recipient.email).join(",")],
      ],
      fetchFn,
      signal: input.signal,
    });
    if (campaign.response.status >= 500) {
      return {
        status: "ambiguous",
        message: `UniSender вернул HTTP ${campaign.response.status} при запуске; message_id=${messageId}, повтор отключён.`,
        messageId,
        acceptedOutboxIds: [],
        rejectedOutboxIds,
      };
    }
    if (!campaign.response.ok || campaign.body?.error || !campaign.body?.result?.campaign_id) {
      return {
        status: "rejected",
        message: providerMessage(campaign.body, `UniSender не запустил письмо message_id=${messageId}.`),
        messageId,
        acceptedOutboxIds: [],
        rejectedOutboxIds: allOutboxIds,
      };
    }
    const campaignId = String(campaign.body.result.campaign_id);
    return {
      status: "accepted",
      externalId: campaignId,
      messageId,
      campaignId,
      message: "UniSender импортировал аудиторию и принял массовую email-кампанию.",
      acceptedOutboxIds: validRecipients.map((recipient) => recipient.outboxId),
      rejectedOutboxIds,
    };
  } catch (error) {
    return {
      ...ambiguousFailure(error, "UniSender"),
      acceptedOutboxIds: [],
      rejectedOutboxIds: [],
    };
  }
}

export async function sendUniSenderTransactionalEmail(input: {
  apiKey: string;
  listId: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  htmlBody: string;
  attachments?: Array<{ filename: string; bytes: Uint8Array }>;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<ProviderCallResult> {
  const fetchFn = input.fetchFn ?? fetch;
  const body = input.htmlBody.includes("{{UnsubscribeUrl}}")
    ? input.htmlBody
    : `${input.htmlBody}<div style="margin-top:24px;font-size:11px;color:#718096"><a href="{{UnsubscribeUrl}}" style="color:#718096">Отписаться от уведомлений</a></div>`;
  try {
    const sent = await callUniSender<{ email_id?: number | string }>({
      method: "sendEmail",
      apiKey: input.apiKey,
      parameters: [
        ["email", input.recipientName?.trim() ? `${input.recipientName.trim()} <${input.recipientEmail}>` : input.recipientEmail],
        ["sender_name", input.senderName],
        ["sender_email", input.senderEmail],
        ["subject", input.subject],
        ["body", body],
        ["list_id", input.listId],
        ["lang", "ru"],
        ["images_as", "attachments"],
        ["track_read", 0],
        ["track_links", 0],
      ],
      binaryParameters: input.attachments?.map((attachment) => [
        `attachments[${attachment.filename.replace(/[^a-zA-Z0-9а-яА-ЯёЁ._ -]/g, "_")}]`,
        attachment.bytes,
      ]),
      fetchFn,
      signal: input.signal,
    });
    if (sent.response.status >= 500) {
      return { status: "ambiguous", message: `UniSender вернул HTTP ${sent.response.status}; перед повтором проверьте статус письма.` };
    }
    if (!sent.response.ok || sent.body?.error || !sent.body?.result?.email_id) {
      return { status: "rejected", message: providerMessage(sent.body, "UniSender не принял сервисное письмо.") };
    }
    return {
      status: "accepted",
      externalId: String(sent.body.result.email_id),
      message: "UniSender принял персональное сервисное письмо. Доставка проверяется отдельно.",
    };
  } catch (error) {
    return ambiguousFailure(error, "UniSender");
  }
}

export async function checkUniSenderEmail(input: {
  apiKey: string;
  emailId: string;
  fetchFn?: FetchLike;
  signal?: AbortSignal;
}): Promise<ProviderCallResult & { delivered?: boolean; opened?: boolean; pending?: boolean }> {
  const fetchFn = input.fetchFn ?? fetch;
  try {
    const checked = await callUniSender<{ statuses?: Array<{ id?: number | string; status?: string }> }>({
      method: "checkEmail",
      apiKey: input.apiKey,
      parameters: [["email_id", input.emailId]],
      fetchFn,
      signal: input.signal,
    });
    const status = checked.body?.result?.statuses?.[0]?.status ?? "";
    if (checked.response.status >= 500) return { status: "ambiguous", pending: true, message: `UniSender вернул HTTP ${checked.response.status}.` };
    if (!checked.response.ok || checked.body?.error || !status) return { status: "rejected", message: providerMessage(checked.body, "UniSender не вернул статус сервисного письма.") };
    if (status.startsWith("err_")) return { status: "rejected", delivered: false, message: `UniSender: ${status}.` };
    const opened = status === "ok_read" || status === "ok_link_visited";
    const delivered = opened || status === "ok_delivered";
    return {
      status: "accepted",
      externalId: input.emailId,
      delivered,
      opened,
      pending: !delivered,
      message: delivered ? `UniSender подтвердил доставку сервисного письма (${status}).` : `UniSender ещё обрабатывает сервисное письмо (${status}).`,
    };
  } catch (error) {
    return { ...ambiguousFailure(error, "UniSender"), pending: true };
  }
}
