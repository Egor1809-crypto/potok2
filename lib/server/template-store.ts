import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { campaigns, emailTemplates } from "@/db/schema";
import type {
  EmailBuilderDocumentInput,
  EmailTemplateCreateInput,
  EmailTemplateDeleteResponse,
  EmailTemplateMutationResponse,
  EmailTemplatePatchInput,
  EmailTemplateRecord,
  EmailTemplatesListResponse,
} from "@/types/api";
import type { TemplateCategory } from "@/types/template";

import {
  ApiRequestError,
  asObject,
  cleanText,
  newId,
  optionalText,
} from "./api-utils";
import {
  compileEmailDocument,
  emailDocumentPlainText,
  parseEmailBuilderDocument,
} from "./email-document";
import { ensureDatabase, WORKSPACE_ID } from "./database-init";
import { unknownMergeTokens } from "./provider-adapters";
import { isStarterEmailTemplateId } from "./starter-template-library";

type EmailTemplateRow = typeof emailTemplates.$inferSelect;

const TEMPLATE_CATEGORIES = new Set<TemplateCategory>([
  "Business",
  "Events",
  "Outreach",
  "Newsletter",
  "Follow-up",
  "Transactional",
]);

const CREATE_KEYS = new Set([
  "name",
  "description",
  "category",
  "subject",
  "previewText",
  "builderDocument",
  "isFavorite",
]);
const PATCH_KEYS = new Set([...CREATE_KEYS, "id", "expectedUpdatedAt"]);
const CLONE_KEYS = new Set(["action", "id", "name"]);

function assertAllowedKeys(
  object: Record<string, unknown>,
  allowed: Set<string>,
) {
  const unexpected = Object.keys(object).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    throw new ApiRequestError(
      `Неизвестные поля шаблона: ${unexpected.join(", ")}.`,
    );
  }
}

function templateName(value: unknown): string {
  const name = cleanText(value, "Название шаблона", 160);
  if (name.length < 2) {
    throw new ApiRequestError(
      "Название шаблона должно содержать не менее двух символов.",
    );
  }
  return name;
}

function templateNameKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ru-RU");
}

function expectedTemplateRevision(value: unknown): string {
  const revision = cleanText(value, "Версия шаблона", 64);
  if (!revision || Number.isNaN(Date.parse(revision))) {
    throw new ApiRequestError(
      "Поле «expectedUpdatedAt» должно содержать дату версии шаблона из API.",
    );
  }
  return revision;
}

function staleTemplateError(currentUpdatedAt: string): ApiRequestError {
  return new ApiRequestError(
    "Шаблон уже изменён в другом окне. Обновите данные и повторите изменения.",
    409,
    [
      `Текущая версия шаблона: ${currentUpdatedAt}`,
      "Получите свежий шаблон через GET /api/templates и повторите сохранение.",
    ],
  );
}

function templateCategory(value: unknown): TemplateCategory {
  if (typeof value !== "string" || !TEMPLATE_CATEGORIES.has(value as TemplateCategory)) {
    throw new ApiRequestError("Выберите допустимую категорию шаблона.");
  }
  return value as TemplateCategory;
}

function canonicalDocument(
  value: unknown,
  id: string,
  subject: string,
  previewText: string,
): EmailBuilderDocumentInput {
  const parsed = parseEmailBuilderDocument(value);
  if (!parsed) {
    throw new ApiRequestError("Добавьте документ email-редактора.");
  }
  const blockIds = parsed.blocks.map((block) => block.id);
  if (new Set(blockIds).size !== blockIds.length) {
    throw new ApiRequestError("Идентификаторы блоков email-макета должны быть уникальными.");
  }
  const document = {
    ...parsed,
    templateId: id,
    subject,
    previewText,
  };
  const unknownTokens = unknownMergeTokens(
    subject,
    previewText,
    ...document.blocks.flatMap((block) => [block.content, block.label ?? ""]),
  );
  if (unknownTokens.length) {
    throw new ApiRequestError(
      `Неизвестные поля персонализации: ${unknownTokens.join(", ")}.`,
    );
  }
  return document;
}

type ParsedTemplate = {
  name: string;
  nameKey: string;
  description: string;
  category: TemplateCategory;
  subject: string;
  previewText: string;
  builderDocument: EmailBuilderDocumentInput;
  emailBodyHtml: string;
  emailBodyText: string;
  isFavorite: boolean;
};

function parseTemplate(
  payload: unknown,
  id: string,
  existing?: EmailTemplateRecord,
): ParsedTemplate {
  const object = asObject(payload);
  const name =
    object.name === undefined && existing
      ? existing.name
      : templateName(object.name);
  const description =
    optionalText(object.description, "Описание шаблона", 1_000) ??
    existing?.description ??
    "";
  const category =
    object.category === undefined && existing
      ? existing.category
      : templateCategory(object.category);
  const subject =
    object.subject === undefined && existing
      ? existing.subject
      : cleanText(object.subject, "Тема письма", 300);
  if (!subject) throw new ApiRequestError("Укажите тему письма.");
  const previewText =
    optionalText(object.previewText, "Прехедер", 500) ??
    existing?.previewText ??
    "";
  const rawDocument =
    object.builderDocument === undefined && existing
      ? existing.builderDocument
      : object.builderDocument;
  const builderDocument = canonicalDocument(
    rawDocument,
    id,
    subject,
    previewText,
  );
  const emailBodyText = emailDocumentPlainText(builderDocument);
  const emailBodyHtml = compileEmailDocument(builderDocument);
  const isFavorite = object.isFavorite === undefined
    ? existing?.isFavorite ?? false
    : object.isFavorite;
  if (typeof isFavorite !== "boolean") {
    throw new ApiRequestError("Поле «Избранное» должно быть логическим значением.");
  }
  return {
    name,
    nameKey: templateNameKey(name),
    description,
    category,
    subject,
    previewText,
    builderDocument,
    emailBodyHtml,
    emailBodyText,
    isFavorite,
  };
}

export function toEmailTemplateRecord(
  row: EmailTemplateRow,
): EmailTemplateRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    isStarter: isStarterEmailTemplateId(row.id),
    isFavorite: row.isFavorite,
    name: row.name,
    description: row.description,
    category: row.category,
    subject: row.subject,
    previewText: row.previewText,
    builderDocument: row.builderDocument,
    emailBodyHtml: row.emailBodyHtml,
    emailBodyText: row.emailBodyText,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function templateById(id: string): Promise<EmailTemplateRecord> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.id, id),
        eq(emailTemplates.workspaceId, WORKSPACE_ID),
      ),
    )
    .limit(1);
  if (!row) throw new ApiRequestError("Email-шаблон не найден.", 404);
  return toEmailTemplateRecord(row);
}

async function assertNameAvailable(nameKey: string, exceptId?: string) {
  const rows = await getDb()
    .select({ id: emailTemplates.id })
    .from(emailTemplates)
    .where(
      and(
        eq(emailTemplates.workspaceId, WORKSPACE_ID),
        eq(emailTemplates.nameKey, nameKey),
      ),
    );
  if (rows.some((row) => row.id !== exceptId)) {
    throw new ApiRequestError(
      "Email-шаблон с таким названием уже существует.",
      409,
    );
  }
}

function isUniqueNameError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("idx_email_templates_workspace_name_key") ||
    message.includes("email_templates.workspace_id, email_templates.name_key")
  );
}

export async function listEmailTemplates(
  request: Request,
): Promise<EmailTemplatesListResponse> {
  await ensureDatabase(request);
  const rows = await getDb()
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.workspaceId, WORKSPACE_ID))
    .orderBy(desc(emailTemplates.updatedAt));
  return {
    templates: rows.map(toEmailTemplateRecord),
  };
}

export async function getEmailTemplate(
  request: Request,
  idValue: unknown,
): Promise<EmailTemplateMutationResponse> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Идентификатор шаблона", 160);
  return { template: await templateById(id) };
}

export async function assertEmailTemplateReference(
  request: Request,
  idValue: unknown,
): Promise<EmailTemplateRecord> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Идентификатор шаблона", 160);
  return templateById(id);
}

export async function createEmailTemplate(
  request: Request,
  payload: unknown,
): Promise<EmailTemplateMutationResponse> {
  await ensureDatabase(request);
  const object = asObject(payload);
  assertAllowedKeys(object, CREATE_KEYS);
  const id = newId("template");
  const input = parseTemplate(object as EmailTemplateCreateInput, id);
  await assertNameAvailable(input.nameKey);
  const now = new Date().toISOString();
  try {
    await getDb().insert(emailTemplates).values({
      id,
      workspaceId: WORKSPACE_ID,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (isUniqueNameError(error)) {
      throw new ApiRequestError(
        "Email-шаблон с таким названием уже существует.",
        409,
      );
    }
    throw error;
  }
  return { template: await templateById(id) };
}

export async function updateEmailTemplate(
  request: Request,
  payload: unknown,
): Promise<EmailTemplateMutationResponse> {
  await ensureDatabase(request);
  const object = asObject(payload);
  assertAllowedKeys(object, PATCH_KEYS);
  const id = cleanText(object.id, "Идентификатор шаблона", 160);
  const expectedUpdatedAt = expectedTemplateRevision(object.expectedUpdatedAt);
  if (
    !Object.keys(object).some(
      (key) => key !== "id" && key !== "expectedUpdatedAt",
    )
  ) {
    throw new ApiRequestError("Нет изменений для сохранения шаблона.");
  }
  const existing = await templateById(id);
  if (existing.updatedAt !== expectedUpdatedAt) {
    throw staleTemplateError(existing.updatedAt);
  }
  const input = parseTemplate(object as EmailTemplatePatchInput, id, existing);
  await assertNameAvailable(input.nameKey, id);
  const updatedAt = new Date(
    Math.max(Date.now(), Date.parse(existing.updatedAt) + 1),
  ).toISOString();
  try {
    const [updated] = await getDb()
      .update(emailTemplates)
      .set({ ...input, updatedAt })
      .where(
        and(
          eq(emailTemplates.id, id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
          eq(emailTemplates.updatedAt, expectedUpdatedAt),
        ),
      )
      .returning();
    if (!updated) {
      const current = await templateById(id);
      throw staleTemplateError(current.updatedAt);
    }
    return { template: toEmailTemplateRecord(updated) };
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (isUniqueNameError(error)) {
      throw new ApiRequestError(
        "Email-шаблон с таким названием уже существует.",
        409,
      );
    }
    throw error;
  }
}

async function availableCloneName(sourceName: string): Promise<string> {
  const rows = await getDb()
    .select({ nameKey: emailTemplates.nameKey })
    .from(emailTemplates)
    .where(eq(emailTemplates.workspaceId, WORKSPACE_ID));
  const occupied = new Set(rows.map((row) => row.nameKey));
  const root = sourceName.slice(0, 140).trimEnd();
  for (let number = 1; number <= 10_000; number += 1) {
    const name = `${root} — копия${number === 1 ? "" : ` ${number}`}`;
    if (!occupied.has(templateNameKey(name))) return name;
  }
  throw new ApiRequestError("Не удалось подобрать название для копии шаблона.");
}

export async function cloneEmailTemplate(
  request: Request,
  payload: unknown,
): Promise<EmailTemplateMutationResponse> {
  await ensureDatabase(request);
  const object = asObject(payload);
  assertAllowedKeys(object, CLONE_KEYS);
  if (object.action !== "clone") {
    throw new ApiRequestError("Неизвестное действие с email-шаблоном.");
  }
  const sourceId = cleanText(object.id, "Исходный шаблон", 160);
  const source = await templateById(sourceId);
  const name =
    object.name === undefined
      ? await availableCloneName(source.name)
      : templateName(object.name);
  const createInput: EmailTemplateCreateInput = {
    name,
    description: source.description,
    category: source.category,
    subject: source.subject,
    previewText: source.previewText,
    builderDocument: source.builderDocument,
  };
  return createEmailTemplate(request, createInput);
}

export async function deleteEmailTemplate(
  request: Request,
  idValue: unknown,
): Promise<EmailTemplateDeleteResponse> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Идентификатор шаблона", 160);
  await templateById(id);
  const db = getDb();
  const references = await db
    .select({ name: campaigns.name })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.workspaceId, WORKSPACE_ID),
        eq(campaigns.templateId, id),
      ),
    );
  const now = new Date().toISOString();
  await db.batch([
    db
      .update(campaigns)
      .set({ templateId: null, updatedAt: now })
      .where(
        and(
          eq(campaigns.workspaceId, WORKSPACE_ID),
          eq(campaigns.templateId, id),
        ),
      ),
    db
      .delete(emailTemplates)
      .where(
        and(
          eq(emailTemplates.id, id),
          eq(emailTemplates.workspaceId, WORKSPACE_ID),
        ),
      ),
  ]);
  return {
    deletedId: id,
    detachedCampaignCount: references.length,
    detachedCampaignNames: references.map((campaign) => campaign.name),
  };
}
