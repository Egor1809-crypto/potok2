import type { ContactCreateInput, ContactStatus } from "@/types/api";
import type { ExistingContactEndpoints } from "@/components/imports/import-api";

export const MAX_TABLE_BYTES = 50 * 1024 * 1024;

export const targetFieldOptions = [
  { value: "ignore", label: "Не импортировать" },
  { value: "email", label: "Email" },
  { value: "emailConsent", label: "Согласие Email" },
  { value: "fullName", label: "ФИО" },
  { value: "firstName", label: "Имя" },
  { value: "lastName", label: "Фамилия" },
  { value: "phone", label: "Телефон" },
  { value: "companyName", label: "Компания" },
  { value: "jobTitle", label: "Должность" },
  { value: "category", label: "Категория" },
  { value: "city", label: "Город" },
  { value: "country", label: "Страна" },
  { value: "tags", label: "Теги" },
  { value: "status", label: "Статус" },
  { value: "engagementScore", label: "Вовлечённость, 0–100" },
  { value: "telegramChatId", label: "Идентификатор чата Telegram" },
  { value: "telegramConsent", label: "Согласие Telegram" },
  { value: "vkUserId", label: "Идентификатор пользователя ВКонтакте" },
  { value: "vkConsent", label: "Согласие ВКонтакте" },
] as const;

export type TargetField = (typeof targetFieldOptions)[number]["value"];
export type FieldMapping = TargetField[];

export type CsvRow = {
  rowNumber: number;
  sheetName?: string;
  values: string[];
  columnMismatch: boolean;
};

export type ParsedCsv = {
  headers: string[];
  rows: CsvRow[];
  delimiter: "," | ";" | "\t";
  encoding: "UTF-8" | "Windows-1251";
  format: "CSV" | "TSV" | "XLSX" | "XLS";
  sheetName?: string;
  sheetNames?: string[];
};

export type RowIssue =
  | "ready"
  | "column-count"
  | "missing-endpoint"
  | "invalid-email"
  | "duplicate-file"
  | "duplicate-existing"
  | "missing-name"
  | "invalid-status"
  | "invalid-score"
  | "value-too-long"
  | "invalid-channel";

export type ValidatedRow = CsvRow & {
  email: string;
  endpointLabel: string;
  displayName: string;
  issue: RowIssue;
  input: ContactCreateInput | null;
};

export type ValidationSummary = {
  total: number;
  ready: number;
  columnCount: number;
  missingEndpoint: number;
  invalidEmail: number;
  duplicateFile: number;
  duplicateExisting: number;
  missingName: number;
  invalidStatus: number;
  invalidScore: number;
  valueTooLong: number;
  invalidChannel: number;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const aliases: Record<Exclude<TargetField, "ignore">, string[]> = {
  email: [
    "email",
    "emailaddress",
    "e-mail",
    "mail",
    "элпочта",
    "электроннаяпочта",
    "рабочаяэлпочта",
  ],
  emailConsent: [
    "emailconsent",
    "mailconsent",
    "согласиеemail",
    "согласиепочта",
    "согласиеэлектроннаяпочта",
  ],
  fullName: ["fullname", "name", "фио", "полноеимя", "имяконтакта"],
  firstName: ["firstname", "givenname", "имя"],
  lastName: ["lastname", "surname", "familyname", "фамилия"],
  phone: ["phone", "phonenumber", "mobile", "телефон", "мобильный"],
  companyName: [
    "company",
    "companyname",
    "organization",
    "компания",
    "организация",
  ],
  jobTitle: ["jobtitle", "title", "position", "role", "должность", "роль"],
  category: ["category", "type", "категория", "тип"],
  city: ["city", "town", "город"],
  country: ["country", "страна"],
  tags: ["tags", "tag", "labels", "теги", "тег", "метки"],
  status: ["status", "статус"],
  engagementScore: [
    "engagementscore",
    "score",
    "вовлеченность",
    "вовлечённость",
    "оценкавовлеченности",
  ],
  telegramChatId: [
    "telegramchatid",
    "telegramid",
    "tgchatid",
    "tgid",
    "телеграмid",
    "идентификаторчатателеграм",
    "идентификаторчатаtelegram",
  ],
  telegramConsent: [
    "telegramconsent",
    "tgconsent",
    "согласиеtelegram",
    "согласиетелеграм",
  ],
  vkUserId: [
    "vkuserid",
    "vkid",
    "вкid",
    "идентификаторvk",
    "идентификаторпользователявконтакте",
  ],
  vkConsent: [
    "vkconsent",
    "согласиеvk",
    "согласиевк",
    "согласиевконтакте",
  ],
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/[\s_.()\-/\\]+/g, "");
}

function delimiterInFirstRecord(text: string): "," | ";" | "\t" {
  const counts: Record<"," | ";" | "\t", number> = {
    ",": 0,
    ";": 0,
    "\t": 0,
  };
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (character === "\n" || character === "\r")) {
      break;
    } else if (!quoted && (character === "," || character === ";" || character === "\t")) {
      counts[character] += 1;
    }
  }

  const candidates = Object.entries(counts) as Array<
    ["," | ";" | "\t", number]
  >;
  candidates.sort((left, right) => right[1] - left[1]);
  if (candidates[0][1] === 0) {
    throw new Error(
      "Не удалось определить разделитель. Нужен CSV с двумя или более столбцами.",
    );
  }
  return candidates[0][0];
}

function parseRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === delimiter) {
      record.push(value);
      value = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      record.push(value);
      records.push(record);
      record = [];
      value = "";
      continue;
    }

    value += character;
  }

  if (quoted) {
    throw new Error("В CSV есть незакрытая кавычка.");
  }

  if (value.length > 0 || record.length > 0) {
    record.push(value);
    records.push(record);
  }

  return records;
}

function uniqueHeaders(values: string[]): string[] {
  const used = new Map<string, number>();
  return values.map((value, index) => {
    const base = value.replace(/^\uFEFF/, "").trim() || `Столбец ${index + 1}`;
    const key = base.toLocaleLowerCase("ru-RU");
    const count = (used.get(key) ?? 0) + 1;
    used.set(key, count);
    return count === 1 ? base : `${base} (${count})`;
  });
}

async function decodeFile(file: File): Promise<{
  text: string;
  encoding: ParsedCsv["encoding"];
}> {
  const buffer = await file.arrayBuffer();
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(buffer),
      encoding: "UTF-8",
    };
  } catch {
    return {
      text: new TextDecoder("windows-1251").decode(buffer),
      encoding: "Windows-1251",
    };
  }
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  const extension = file.name.toLocaleLowerCase().split(".").pop() ?? "";
  if (!new Set(["csv", "tsv", "xlsx", "xls"]).has(extension)) {
    throw new Error("Поддерживаются таблицы CSV, TSV, XLSX и XLS.");
  }
  if (file.size === 0) throw new Error("Файл пустой.");
  if (file.size > MAX_TABLE_BYTES) {
    throw new Error("Файл больше 50 МБ. Разделите его на несколько таблиц.");
  }

  if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("@e965/xlsx");
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true, dense: true });
    if (!workbook.SheetNames.length) throw new Error("В книге нет листов.");
    const sheets = workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return [];
      const records = XLSX.utils.sheet_to_json<Array<string | number | boolean | Date>>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
        dateNF: "yyyy-mm-dd",
      }).map((row) => row.map((value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value)));
      if (!records[0]?.some((value) => value.trim().length > 0)) return [];
      return [{ sheetName, records }];
    });
    if (!sheets.length) throw new Error("В книге нет листов с заголовками.");
    return parsedWorkbook(
      sheets,
      extension === "xlsx" ? "XLSX" : "XLS",
    );
  }

  const decoded = await decodeFile(file);
  const delimiter = extension === "tsv" ? "\t" : delimiterInFirstRecord(decoded.text);
  const records = parseRecords(decoded.text, delimiter);
  return parsedRecords(records, extension === "tsv" ? "TSV" : "CSV", decoded.encoding, undefined, delimiter);
}

function parsedWorkbook(
  sheets: Array<{ sheetName: string; records: string[][] }>,
  format: "XLSX" | "XLS",
): ParsedCsv {
  const headerKeys = new Map<string, number>();
  const headers: string[] = [];
  const sheetHeaders = sheets.map(({ sheetName, records }) => {
    const localHeaders = uniqueHeaders(records[0]);
    if (localHeaders.length < 2) {
      throw new Error(`На листе «${sheetName}» должно быть не менее двух столбцов.`);
    }
    const indexes = localHeaders.map((header) => {
      const key = normalizeHeader(header.replace(/ \(\d+\)$/, ""));
      const existing = headerKeys.get(key);
      if (existing !== undefined) return existing;
      const next = headers.length;
      headers.push(header);
      headerKeys.set(key, next);
      return next;
    });
    return { sheetName, records, indexes };
  });

  const rows = sheetHeaders.flatMap(({ sheetName, records, indexes }) =>
    records
      .slice(1)
      .map((values, index) => ({ values, rowNumber: index + 2 }))
      .filter(({ values }) => values.some((value) => value.trim().length > 0))
      .map(({ values, rowNumber }) => {
        const aligned = Array.from({ length: headers.length }, () => "");
        values.forEach((value, index) => {
          const targetIndex = indexes[index];
          if (targetIndex !== undefined) aligned[targetIndex] = value.trim();
        });
        return {
          rowNumber,
          sheetName,
          values: aligned,
          columnMismatch: values.length !== indexes.length,
        };
      }),
  );
  if (!rows.length) throw new Error("В книге нет строк с контактами.");

  return {
    headers,
    rows,
    delimiter: "\t",
    encoding: "UTF-8",
    format,
    sheetName: sheets.length === 1 ? sheets[0].sheetName : undefined,
    sheetNames: sheets.map((sheet) => sheet.sheetName),
  };
}

function parsedRecords(
  records: string[][],
  format: ParsedCsv["format"],
  encoding: ParsedCsv["encoding"],
  sheetName?: string,
  delimiter: ParsedCsv["delimiter"] = "\t",
): ParsedCsv {
  const dataRows = records
    .slice(1)
    .map((values, index) => ({ values, rowNumber: index + 2 }))
    .filter(({ values }) =>
      values.some((value) => value.trim().length > 0),
    );

  if (!records[0]?.some((value) => value.trim().length > 0)) {
    throw new Error("В таблице нет строки с заголовками.");
  }
  if (dataRows.length === 0) {
    throw new Error("В таблице нет строк с контактами.");
  }

  const headers = uniqueHeaders(records[0]);
  if (headers.length < 2) {
    throw new Error("В таблице должно быть не менее двух столбцов.");
  }

  return {
    headers,
    rows: dataRows.map(({ values, rowNumber }) => ({
      rowNumber,
      values: values.map((value) => value.trim()),
      columnMismatch: values.length !== headers.length,
    })),
    delimiter,
    encoding,
    format,
    ...(sheetName ? { sheetName } : {}),
  };
}

export function suggestMapping(headers: string[]): FieldMapping {
  const claimed = new Set<TargetField>();
  return headers.map((header) => {
    const normalized = normalizeHeader(header.replace(/ \(\d+\)$/, ""));
    const match = Object.entries(aliases).find(([, values]) =>
      values.some((value) => normalizeHeader(value) === normalized),
    )?.[0] as Exclude<TargetField, "ignore"> | undefined;
    if (!match || claimed.has(match)) return "ignore";
    claimed.add(match);
    return match;
  });
}

export function mappingError(mapping: FieldMapping): string | null {
  if (
    !mapping.includes("email") &&
    !mapping.includes("telegramChatId") &&
    !mapping.includes("vkUserId")
  ) {
    return "Сопоставьте хотя бы один канал: адрес электронной почты, идентификатор чата Telegram или идентификатор пользователя ВКонтакте.";
  }
  const hasFullName = mapping.includes("fullName");
  const hasSeparateName =
    mapping.includes("firstName") && mapping.includes("lastName");
  if (!hasFullName && !hasSeparateName) {
    return "Сопоставьте ФИО или отдельные столбцы Имя и Фамилия.";
  }
  const selected = mapping.filter((field) => field !== "ignore");
  if (new Set(selected).size !== selected.length) {
    return "Каждое поле контакта можно выбрать только один раз.";
  }
  return null;
}

function valueFor(
  row: CsvRow,
  mapping: FieldMapping,
  target: TargetField,
): string {
  const index = mapping.indexOf(target);
  const value = index < 0 ? "" : (row.values[index] ?? "").trim();
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

function normalizedStatus(value: string): ContactStatus | null {
  const normalized = value.trim().toLocaleLowerCase("ru-RU");
  const statuses: Record<string, ContactStatus> = {
    active: "active",
    "активен": "active",
    "активный": "active",
    unsubscribed: "unsubscribed",
    "отписан": "unsubscribed",
    "отписался": "unsubscribed",
    bounced: "bounced",
    "недоставлено": "bounced",
    "недоставляемый": "bounced",
    "возврат": "bounced",
    invalid: "invalid",
    "некорректен": "invalid",
    "некорректный": "invalid",
    "некорректный адрес": "invalid",
  };
  return statuses[normalized] ?? null;
}

function normalizedBoolean(value: string): {
  value: boolean;
  invalid: boolean;
} {
  const normalized = value.trim().toLocaleLowerCase("ru-RU");
  if (!normalized) return { value: false, invalid: false };
  if (["1", "true", "yes", "y", "да", "+", "есть"].includes(normalized)) {
    return { value: true, invalid: false };
  }
  if (["0", "false", "no", "n", "нет", "-"].includes(normalized)) {
    return { value: false, invalid: false };
  }
  return { value: false, invalid: true };
}

function mappedContact(
  row: CsvRow,
  mapping: FieldMapping,
): {
  input: ContactCreateInput;
  displayName: string;
  invalidStatus: boolean;
  invalidScore: boolean;
  invalidChannel: boolean;
} {
  const fullName = valueFor(row, mapping, "fullName");
  const nameParts = fullName.split(/\s+/).filter(Boolean);
  const firstName = valueFor(row, mapping, "firstName") || nameParts[0] || "";
  const lastName =
    valueFor(row, mapping, "lastName") || nameParts.slice(1).join(" ");
  const email = valueFor(row, mapping, "email").toLocaleLowerCase("ru-RU");
  const emailConsent = normalizedBoolean(
    valueFor(row, mapping, "emailConsent"),
  );
  const input: ContactCreateInput = {
    firstName,
    lastName,
    emailConsent: emailConsent.value,
  };
  if (email) input.email = email;

  const optionalTextFields = [
    "phone",
    "companyName",
    "jobTitle",
    "category",
    "city",
    "country",
  ] as const;
  optionalTextFields.forEach((field) => {
    const value = valueFor(row, mapping, field);
    if (value) input[field] = value;
  });

  const tags = valueFor(row, mapping, "tags")
    .split(/[;|,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  if (tags.length) input.tags = Array.from(new Set(tags));

  const status = valueFor(row, mapping, "status");
  const parsedStatus = status ? normalizedStatus(status) : null;
  if (parsedStatus) input.status = parsedStatus;

  const engagementScoreRaw = valueFor(row, mapping, "engagementScore");
  const engagementScore = Number(engagementScoreRaw);
  const invalidScore = Boolean(
    engagementScoreRaw &&
      (!Number.isInteger(engagementScore) ||
        engagementScore < 0 ||
        engagementScore > 100),
  );
  if (engagementScoreRaw && !invalidScore) {
    input.engagementScore = engagementScore;
  }

  const telegramChatId = valueFor(row, mapping, "telegramChatId");
  const telegramConsent = normalizedBoolean(
    valueFor(row, mapping, "telegramConsent"),
  );
  const vkUserId = valueFor(row, mapping, "vkUserId");
  const vkConsent = normalizedBoolean(valueFor(row, mapping, "vkConsent"));
  if (telegramChatId) input.telegramChatId = telegramChatId;
  input.telegramConsent = telegramConsent.value;
  if (vkUserId) input.vkUserId = vkUserId;
  input.vkConsent = vkConsent.value;

  const invalidChannel =
    emailConsent.invalid ||
    telegramConsent.invalid ||
    vkConsent.invalid ||
    Boolean(telegramChatId && !/^-?\d+$/.test(telegramChatId)) ||
    Boolean(vkUserId && !/^\d+$/.test(vkUserId)) ||
    (emailConsent.value && !email) ||
    (telegramConsent.value && !telegramChatId) ||
    (vkConsent.value && !vkUserId);

  return {
    input,
    displayName: [firstName, lastName].filter(Boolean).join(" "),
    invalidStatus: Boolean(status && !parsedStatus),
    invalidScore,
    invalidChannel,
  };
}

function hasOversizedValue(input: ContactCreateInput): boolean {
  return (
    input.firstName.length > 100 ||
    input.lastName.length > 100 ||
    (input.email?.length ?? 0) > 254 ||
    (input.phone?.length ?? 0) > 80 ||
    (input.companyName?.length ?? 0) > 200 ||
    (input.jobTitle?.length ?? 0) > 200 ||
    (input.category?.length ?? 0) > 100 ||
    (input.city?.length ?? 0) > 120 ||
    (input.country?.length ?? 0) > 120 ||
    (input.telegramChatId?.length ?? 0) > 80 ||
    (input.vkUserId?.length ?? 0) > 80 ||
    (input.tags?.length ?? 0) > 50 ||
    Boolean(input.tags?.some((tag) => tag.length > 100))
  );
}

export function validateRows(
  rows: CsvRow[],
  mapping: FieldMapping,
  existing: ExistingContactEndpoints,
): { rows: ValidatedRow[]; summary: ValidationSummary } {
  const seenEmails = new Set<string>();
  const seenTelegram = new Set<string>();
  const seenVk = new Set<string>();
  const validated = rows.map<ValidatedRow>((row) => {
    const mapped = mappedContact(row, mapping);
    const email = mapped.input.email ?? "";
    const telegramChatId = mapped.input.telegramChatId ?? "";
    const vkUserId = mapped.input.vkUserId ?? "";
    const hasEndpoint = Boolean(email || telegramChatId || vkUserId);
    const exists =
      Boolean(email && existing.emails.has(email)) ||
      Boolean(telegramChatId && existing.telegramChatIds.has(telegramChatId)) ||
      Boolean(vkUserId && existing.vkUserIds.has(vkUserId));
    const seen =
      Boolean(email && seenEmails.has(email)) ||
      Boolean(telegramChatId && seenTelegram.has(telegramChatId)) ||
      Boolean(vkUserId && seenVk.has(vkUserId));
    let issue: RowIssue = "ready";

    if (row.columnMismatch) issue = "column-count";
    else if (!hasEndpoint) issue = "missing-endpoint";
    else if (email && !emailPattern.test(email)) issue = "invalid-email";
    else if (exists) issue = "duplicate-existing";
    else if (!mapped.input.firstName.trim() || !mapped.input.lastName.trim()) {
      issue = "missing-name";
    } else if (mapped.invalidStatus) issue = "invalid-status";
    else if (mapped.invalidScore) issue = "invalid-score";
    else if (mapped.invalidChannel) issue = "invalid-channel";
    else if (hasOversizedValue(mapped.input)) issue = "value-too-long";
    else if (seen) issue = "duplicate-file";

    if (issue === "ready") {
      if (email) seenEmails.add(email);
      if (telegramChatId) seenTelegram.add(telegramChatId);
      if (vkUserId) seenVk.add(vkUserId);
    }
    return {
      ...row,
      email,
      endpointLabel:
        email ||
        (telegramChatId ? `Telegram: ${telegramChatId}` : "") ||
        (vkUserId ? `VK: ${vkUserId}` : ""),
      displayName: mapped.displayName,
      issue,
      input: issue === "ready" ? mapped.input : null,
    };
  });

  const summary: ValidationSummary = {
    total: validated.length,
    ready: 0,
    columnCount: 0,
    missingEndpoint: 0,
    invalidEmail: 0,
    duplicateFile: 0,
    duplicateExisting: 0,
    missingName: 0,
    invalidStatus: 0,
    invalidScore: 0,
    valueTooLong: 0,
    invalidChannel: 0,
  };
  validated.forEach((row) => {
    if (row.issue === "ready") summary.ready += 1;
    if (row.issue === "column-count") summary.columnCount += 1;
    if (row.issue === "missing-endpoint") summary.missingEndpoint += 1;
    if (row.issue === "invalid-email") summary.invalidEmail += 1;
    if (row.issue === "duplicate-file") summary.duplicateFile += 1;
    if (row.issue === "duplicate-existing") summary.duplicateExisting += 1;
    if (row.issue === "missing-name") summary.missingName += 1;
    if (row.issue === "invalid-status") summary.invalidStatus += 1;
    if (row.issue === "invalid-score") summary.invalidScore += 1;
    if (row.issue === "value-too-long") summary.valueTooLong += 1;
    if (row.issue === "invalid-channel") summary.invalidChannel += 1;
  });

  return { rows: validated, summary };
}
