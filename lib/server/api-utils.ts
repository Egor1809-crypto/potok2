import type { ApiError } from "@/types/api";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly details?: string[];

  constructor(message: string, status = 400, details?: string[]) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.details = details;
  }
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiRequestError("Не удалось прочитать данные запроса.");
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof ApiRequestError) {
    const body: ApiError = { error: error.message };
    if (error.details?.length) body.details = error.details;
    return Response.json(body, { status: error.status });
  }

  const message = error instanceof Error ? error.message : String(error);
  const isDatabaseUnavailable =
    message.includes("D1") ||
    message.includes("no such table") ||
    message.includes("database");

  console.error("Поток API error", error);
  return Response.json(
    {
      error: isDatabaseUnavailable
        ? "Хранилище Поток временно недоступно. Повторите попытку позже."
        : "Не удалось выполнить операцию. Повторите попытку позже.",
    },
    { status: 500 },
  );
}

export function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiRequestError("Ожидался объект с данными.");
  }
  return value as Record<string, unknown>;
}

export function cleanText(value: unknown, field: string, max = 500): string {
  if (typeof value !== "string") {
    throw new ApiRequestError(`Поле «${field}» должно быть текстом.`);
  }
  const result = value.trim();
  if (result.length > max) {
    throw new ApiRequestError(
      `Поле «${field}» не должно быть длиннее ${max} символов.`,
    );
  }
  return result;
}

export function optionalText(
  value: unknown,
  field: string,
  max = 500,
): string | undefined {
  if (value === undefined) return undefined;
  return cleanText(value, field, max);
}

export function nullableText(
  value: unknown,
  field: string,
  max = 500,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const result = cleanText(value, field, max);
  return result || null;
}

export function optionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ApiRequestError(`Поле «${field}» должно быть логическим.`);
  }
  return value;
}

export function optionalInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new ApiRequestError(
      `Поле «${field}» должно быть целым числом от ${min} до ${max}.`,
    );
  }
  return value as number;
}

export function normalizeEmail(value: unknown, field = "Email"): string {
  const email = cleanText(value, field, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiRequestError(`В поле «${field}» указан некорректный адрес.`);
  }
  return email;
}

export function optionalEmail(
  value: unknown,
  field = "Email",
): string | undefined {
  if (value === undefined) return undefined;
  return normalizeEmail(value, field);
}

export function optionalStringArray(
  value: unknown,
  field: string,
  maxItems = 50,
): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ApiRequestError(
      `Поле «${field}» должно быть списком не более чем из ${maxItems} значений.`,
    );
  }
  const cleaned = value.map((item) => cleanText(item, field, 100)).filter(Boolean);
  return [...new Set(cleaned)];
}

export function parseIsoDate(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ApiRequestError(`Поле «${field}» содержит некорректную дату.`);
  }
  return new Date(value).toISOString();
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
