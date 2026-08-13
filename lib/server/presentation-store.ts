import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { emailTemplates, presentationProjects } from "@/db/schema";
import { defaultPresentationSlides, presentationTheme } from "@/data/presentation-templates";
import type {
  DeleteResponse,
  PresentationCreateInput,
  PresentationMutationResponse,
  PresentationPatchInput,
  PresentationProjectRecord,
  PresentationSlide,
  PresentationSlideLayout,
  PresentationSourceType,
  PresentationThemeId,
  PresentationsListResponse,
} from "@/types/api";

import {
  ApiRequestError,
  asObject,
  cleanText,
  newId,
  optionalText,
} from "./api-utils";
import { ensureDatabase, WORKSPACE_ID } from "./database-init";

const THEMES = new Set<PresentationThemeId>(["atelier", "violet", "noir", "ocean", "sunrise"]);
const LAYOUTS = new Set<PresentationSlideLayout>(["title", "statement", "split", "bullets", "quote", "stats", "closing"]);
const SOURCES = new Set<PresentationSourceType>(["blank", "template", "ai", "email"]);
const HEX = /^#[0-9a-f]{6}$/i;

function color(value: unknown, field: string, fallback: string) {
  if (value === undefined) return fallback;
  const result = cleanText(value, field, 7);
  if (!HEX.test(result)) throw new ApiRequestError(`Поле «${field}» должно содержать цвет в формате #RRGGBB.`);
  return result.toUpperCase();
}

function assetIdFromImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = new URL(value.trim(), "https://mailflow.local");
    const match = parsed.pathname.match(/^\/api\/assets\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function safeImageUrl(value: unknown, assetId?: string) {
  const resolvedId = assetId ?? assetIdFromImageUrl(value);
  if (resolvedId) return `/api/assets/${encodeURIComponent(resolvedId)}`;
  if (value === undefined || value === "") return undefined;
  throw new ApiRequestError("Для слайда можно выбрать только изображение из общей медиатеки MAILFLOW.");
}

function parseBullets(value: unknown, index: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ApiRequestError(`Список на слайде ${index + 1} имеет неверный формат.`);
  return value.slice(0, 8).map((item) => cleanText(item, `Пункт слайда ${index + 1}`, 240)).filter(Boolean);
}

function parseSlide(value: unknown, index: number): PresentationSlide {
  const object = asObject(value);
  const rawLayout = optionalText(object.layout, `Макет слайда ${index + 1}`, 30) ?? "statement";
  if (!LAYOUTS.has(rawLayout as PresentationSlideLayout)) throw new ApiRequestError(`Выберите допустимый макет слайда ${index + 1}.`);
  const assetId = optionalText(object.assetId, `Изображение слайда ${index + 1}`, 160) ?? assetIdFromImageUrl(object.imageUrl);
  return {
    id: optionalText(object.id, `Идентификатор слайда ${index + 1}`, 160) || newId("slide"),
    layout: rawLayout as PresentationSlideLayout,
    eyebrow: optionalText(object.eyebrow, `Надзаголовок слайда ${index + 1}`, 120) ?? "",
    title: cleanText(object.title ?? "", `Заголовок слайда ${index + 1}`, 300),
    body: optionalText(object.body, `Текст слайда ${index + 1}`, 1_500) ?? "",
    bullets: parseBullets(object.bullets, index),
    speakerNotes: optionalText(object.speakerNotes, `Заметки слайда ${index + 1}`, 3_000) ?? "",
    ...(assetId ? { assetId } : {}),
    ...(safeImageUrl(object.imageUrl, assetId) ? { imageUrl: safeImageUrl(object.imageUrl, assetId) } : {}),
  };
}

function parseSlides(value: unknown, fallback = defaultPresentationSlides): PresentationSlide[] {
  if (value === undefined) return fallback.map((item) => ({ ...item, id: newId("slide"), bullets: [...item.bullets] }));
  if (!Array.isArray(value) || value.length < 1 || value.length > 40) {
    throw new ApiRequestError("Презентация должна содержать от 1 до 40 слайдов.");
  }
  return value.map(parseSlide);
}

function sourceType(value: unknown, fallback: PresentationSourceType): PresentationSourceType {
  if (value === undefined) return fallback;
  const result = cleanText(value, "Источник презентации", 20) as PresentationSourceType;
  if (!SOURCES.has(result)) throw new ApiRequestError("Указан неизвестный источник презентации.");
  return result;
}

function themeId(value: unknown, fallback: PresentationThemeId): PresentationThemeId {
  if (value === undefined) return fallback;
  const result = cleanText(value, "Тема презентации", 30) as PresentationThemeId;
  if (!THEMES.has(result)) throw new ApiRequestError("Выберите допустимую тему презентации.");
  return result;
}

function toRecord(row: typeof presentationProjects.$inferSelect): PresentationProjectRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    themeId: row.themeId,
    accentColor: row.accentColor,
    backgroundColor: row.backgroundColor,
    textColor: row.textColor,
    slides: row.slides,
    sourceType: row.sourceType,
    sourceEmailTemplateId: row.sourceEmailTemplateId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function splitContent(value: string) {
  return value.split("|").map((item) => item.trim()).filter(Boolean);
}

function plainBlockText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slidesFromEmailTemplate(row: typeof emailTemplates.$inferSelect): PresentationSlide[] {
  const slides: PresentationSlide[] = [{
    id: newId("slide"),
    layout: "title",
    eyebrow: "ИЗ ПИСЬМА MAILFLOW",
    title: row.subject || row.name,
    body: row.previewText || row.description,
    bullets: [],
    speakerNotes: `Источник: email-шаблон «${row.name}».`,
  }];

  for (const block of row.builderDocument.blocks) {
    if (slides.length >= 10 || ["logo", "divider", "spacer", "social", "footer", "pattern"].includes(block.type)) continue;
    const parts = splitContent(block.content);
    const title = plainBlockText(parts[0] || block.label || "Содержание письма");
    const rest = parts.slice(1).map(plainBlockText).filter(Boolean);
    const common = {
      id: newId("slide"),
      eyebrow: block.type === "button" ? "СЛЕДУЮЩИЙ ШАГ" : "ИЗ ПИСЬМА",
      title: title.slice(0, 300),
      body: rest[0]?.slice(0, 1_500) ?? "",
      bullets: rest.slice(1, 8).map((item) => item.slice(0, 240)),
      speakerNotes: `Источник: блок «${block.type}» email-шаблона «${row.name}».`,
      ...(block.type === "image" && assetIdFromImageUrl(block.href)
        ? {
            assetId: assetIdFromImageUrl(block.href),
            imageUrl: `/api/assets/${encodeURIComponent(assetIdFromImageUrl(block.href)!)}`,
          }
        : {}),
    };
    if (block.type === "image") {
      if (!assetIdFromImageUrl(block.href)) continue;
      slides.push({ ...common, layout: "split", title: block.label || "Визуальный материал", body: "", bullets: [] });
    } else if (block.type === "quote") {
      slides.push({ ...common, layout: "quote" });
    } else if (block.type === "stats") {
      slides.push({ ...common, layout: "stats", bullets: parts.map(plainBlockText).filter(Boolean).slice(0, 6) });
    } else if (["checklist", "timeline", "faq"].includes(block.type)) {
      slides.push({ ...common, layout: "bullets", bullets: parts.map(plainBlockText).filter(Boolean).slice(0, 8) });
    } else if (["columns", "comparison", "product", "document", "notice", "compliance"].includes(block.type)) {
      slides.push({ ...common, layout: "split", bullets: rest.slice(0, 8) });
    } else if (block.type === "button") {
      slides.push({ ...common, layout: "closing", body: block.href ? `Ссылка: ${block.href}` : common.body });
    } else {
      slides.push({ ...common, layout: block.type === "hero" || block.type === "banner" || block.type === "heading" ? "statement" : "bullets" });
    }
  }

  if (slides.length === 1) {
    slides.push({
      id: newId("slide"),
      layout: "statement",
      eyebrow: "ОСНОВНАЯ МЫСЛЬ",
      title: row.name,
      body: row.emailBodyText.slice(0, 1_500),
      bullets: [],
      speakerNotes: `Источник: текст email-шаблона «${row.name}».`,
    });
  }
  return slides;
}

async function parseCreate(value: unknown): Promise<PresentationCreateInput & Required<Pick<PresentationCreateInput, "slides" | "themeId" | "accentColor" | "backgroundColor" | "textColor" | "sourceType">>> {
  const object = asObject(value);
  const sourceEmailTemplateId = object.sourceEmailTemplateId === null
    ? null
    : optionalText(object.sourceEmailTemplateId, "Email-шаблон", 160) ?? null;
  let emailSource: typeof emailTemplates.$inferSelect | undefined;
  if (sourceEmailTemplateId) {
    [emailSource] = await getDb().select().from(emailTemplates).where(and(eq(emailTemplates.id, sourceEmailTemplateId), eq(emailTemplates.workspaceId, WORKSPACE_ID))).limit(1);
    if (!emailSource) throw new ApiRequestError("Email-шаблон для презентации не найден.", 404);
  }
  const selectedTheme = themeId(object.themeId, "atelier");
  const palette = presentationTheme(selectedTheme);
  return {
    name: cleanText(object.name ?? emailSource?.name ?? "Новая презентация", "Название презентации", 120) || "Новая презентация",
    description: optionalText(object.description, "Описание презентации", 500) ?? (emailSource ? `Создано из письма «${emailSource.name}».` : ""),
    themeId: selectedTheme,
    accentColor: color(object.accentColor, "Акцент", palette.accentColor),
    backgroundColor: color(object.backgroundColor, "Фон", palette.backgroundColor),
    textColor: color(object.textColor, "Цвет текста", palette.textColor),
    slides: emailSource && object.slides === undefined ? slidesFromEmailTemplate(emailSource) : parseSlides(object.slides),
    sourceType: sourceType(object.sourceType, emailSource ? "email" : "blank"),
    sourceEmailTemplateId,
  };
}

export async function listPresentationProjects(request: Request): Promise<PresentationsListResponse> {
  await ensureDatabase(request);
  const rows = await getDb().select().from(presentationProjects).where(eq(presentationProjects.workspaceId, WORKSPACE_ID)).orderBy(desc(presentationProjects.updatedAt)).limit(100);
  return { presentations: rows.map(toRecord) };
}

export async function getPresentationProject(request: Request, idValue: unknown): Promise<PresentationMutationResponse> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Презентация", 160);
  const [row] = await getDb().select().from(presentationProjects).where(and(eq(presentationProjects.id, id), eq(presentationProjects.workspaceId, WORKSPACE_ID))).limit(1);
  if (!row) throw new ApiRequestError("Презентация не найдена.", 404);
  return { presentation: toRecord(row) };
}

export async function createPresentationProject(request: Request, value: unknown): Promise<PresentationMutationResponse> {
  await ensureDatabase(request);
  const input = await parseCreate(value);
  const now = new Date().toISOString();
  const id = newId("presentation");
  await getDb().insert(presentationProjects).values({
    id,
    workspaceId: WORKSPACE_ID,
    ...input,
    createdAt: now,
    updatedAt: now,
  });
  return getPresentationProject(request, id);
}

export async function updatePresentationProject(request: Request, value: unknown): Promise<PresentationMutationResponse> {
  await ensureDatabase(request);
  const object = asObject(value);
  const id = cleanText(object.id, "Презентация", 160);
  const [current] = await getDb().select().from(presentationProjects).where(and(eq(presentationProjects.id, id), eq(presentationProjects.workspaceId, WORKSPACE_ID))).limit(1);
  if (!current) throw new ApiRequestError("Презентация не найдена.", 404);
  const expectedUpdatedAt = optionalText(object.expectedUpdatedAt, "Версия презентации", 80);
  if (expectedUpdatedAt && expectedUpdatedAt !== current.updatedAt) {
    throw new ApiRequestError("Презентация уже изменилась в другой вкладке. Обновите страницу перед сохранением.", 409);
  }
  const patch = object as PresentationPatchInput & Record<string, unknown>;
  const selectedTheme = themeId(patch.themeId, current.themeId);
  const palette = presentationTheme(selectedTheme);
  const now = new Date().toISOString();
  await getDb().update(presentationProjects).set({
    name: patch.name === undefined ? current.name : cleanText(patch.name, "Название презентации", 120) || current.name,
    description: patch.description === undefined ? current.description : cleanText(patch.description, "Описание презентации", 500),
    themeId: selectedTheme,
    accentColor: color(patch.accentColor, "Акцент", patch.themeId === undefined ? current.accentColor : palette.accentColor),
    backgroundColor: color(patch.backgroundColor, "Фон", patch.themeId === undefined ? current.backgroundColor : palette.backgroundColor),
    textColor: color(patch.textColor, "Цвет текста", patch.themeId === undefined ? current.textColor : palette.textColor),
    slides: patch.slides === undefined ? current.slides : parseSlides(patch.slides),
    updatedAt: now,
  }).where(and(eq(presentationProjects.id, id), eq(presentationProjects.workspaceId, WORKSPACE_ID)));
  return getPresentationProject(request, id);
}

export async function deletePresentationProject(request: Request, idValue: unknown): Promise<DeleteResponse> {
  await ensureDatabase(request);
  const id = cleanText(idValue, "Презентация", 160);
  const result = await getDb().delete(presentationProjects).where(and(eq(presentationProjects.id, id), eq(presentationProjects.workspaceId, WORKSPACE_ID))).returning({ id: presentationProjects.id });
  if (!result.length) throw new ApiRequestError("Презентация не найдена.", 404);
  return { deletedId: id };
}
