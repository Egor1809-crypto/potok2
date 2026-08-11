import type {
  ContactCreateInput,
  ContactsBatchCreateResponse,
  ContactsListResponse,
} from "@/types/api";

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string; details?: string[] })
    | null;

  if (!response.ok) {
    const details = payload?.details?.filter(Boolean).join(" ");
    throw new Error(
      [payload?.error, details].filter(Boolean).join(" ") ||
        `Сервер вернул ошибку ${response.status}.`,
    );
  }
  if (!payload) throw new Error("Сервер вернул пустой ответ.");
  return payload;
}

export type ExistingContactEndpoints = {
  emails: Set<string>;
  telegramChatIds: Set<string>;
  vkUserIds: Set<string>;
};

export async function getExistingContactEndpoints(
  signal?: AbortSignal,
): Promise<ExistingContactEndpoints> {
  const response = await fetch("/api/contacts", {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await readResponse<ContactsListResponse>(response);
  if (!Array.isArray(payload.contacts)) {
    throw new Error("Сервер вернул неверный список контактов.");
  }
  return {
    emails: new Set(
      payload.contacts
        .map((contact) => contact.email.trim().toLocaleLowerCase("ru-RU"))
        .filter(Boolean),
    ),
    telegramChatIds: new Set(
      payload.contacts
        .map((contact) => contact.telegramChatId?.trim() ?? "")
        .filter(Boolean),
    ),
    vkUserIds: new Set(
      payload.contacts
        .map((contact) => contact.vkUserId?.trim() ?? "")
        .filter(Boolean),
    ),
  };
}

export async function postContactsBatch(
  contacts: ContactCreateInput[],
): Promise<ContactsBatchCreateResponse> {
  const response = await fetch("/api/contacts", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ contacts, duplicateStrategy: "skip" }),
  });
  const payload = await readResponse<ContactsBatchCreateResponse>(response);
  if (
    !Number.isInteger(payload.createdCount) ||
    !Number.isInteger(payload.updatedCount) ||
    !Number.isInteger(payload.skippedCount)
  ) {
    throw new Error("Сервер вернул неверный итог импорта.");
  }
  return payload;
}
