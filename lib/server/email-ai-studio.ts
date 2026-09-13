import { selectEmailIcons } from "@/lib/email-ai/icon-selection";
import { emailIconUrl } from "@/lib/email-icons";
import type { AiEmailBrief, AiEmailDocument, AiEmailReview, AiEmailEditorialReview, AiEmailStudioResponse } from "@/types/email-ai";
import type { EmailBuilderDocumentInput, EmailAiSuggestion } from "@/types/api";
import { aiEmailSchemasForIcons, aiEmailReviewSchema, object, parseAiEmailBlock, parseAiEmailBrief, parseAiEmailDocument, subjectVariantsSchema, validateEmailSchema, withEmailIconDefaults } from "@/lib/email-ai/schema";
import { EMAIL_EDIT_PROMPT, EMAIL_REVIEW_PROMPT, EMAIL_STRATEGIST_PROMPT } from "@/lib/email-ai/prompts";
import { builderToAiEmail, mapAiEmailToBuilderDocument } from "@/lib/email-ai/mapping";
import { emailFactIssues, emailSourceOfTruth } from "@/lib/email-ai/facts";
import { emailReviewFingerprint, reviewEmailDocument } from "@/lib/email-ai/review";
import { emailBlockVariants } from "@/lib/email-ai/variants";
import { emailImageReplacement } from "@/lib/email-ai/edit-intent";
import { aiProvider, generateDesignImages } from "./email-ai";
import { parseEmailBuilderDocument, emailDocumentPlainText } from "./email-document";
import { getEmailAssetRecord } from "./email-asset-store";
import { ensureDatabase } from "./database-init";
import { ApiRequestError } from "./api-utils";

type Provider = NonNullable<ReturnType<typeof aiProvider>>;
const actions = new Set(["generate", "rewrite", "rewrite-block", "review", "subject-variants"]);
class EmailJsonError extends Error {
  constructor(message: string, readonly draft: unknown) { super(message); }
}

async function aiJson(provider: Provider, request: Request, name: string, schema: Record<string, unknown>, instructions: string, input: unknown, fallback = false) {
  const model = fallback && provider.fallbackModel ? provider.fallbackModel : provider.model;
  const contract = name === "email_document" || name === "email_block" ? `Каждый блок содержит СТРОГО поля id,type,variant,title,text,badge,items,button,image,backgroundColor,textColor. badge обязателен, пустой="". Никакого eyebrow или features. Каждый item содержит все строки title,text,value,label, даже пустые, и iconId (id значка из iconLibrary или null). Полное имя variant обязательно с префиксом типа: ${JSON.stringify(emailBlockVariants)}. ${name === "email_document" ? "Корень: version=1.0,subject,preheader,meta,theme,blocks. meta: goal,language,tone,length. theme: emailWidth,backgroundColor,contentBackgroundColor,textColor,mutedTextColor,primaryColor,accentColor,borderColor,borderRadius,fontFamily." : "Корень ответа — один блок, без обёртки."} image=null либо {assetId:null или строка,alt:строка,prompt:null или строка}; button=null либо {text:строка,url:строка}.` : "Верни только JSON с обязательными полями указанной схемы.";
  const themeContract = name === "email_document" ? 'Theme example (colors may change): {"emailWidth":640,"backgroundColor":"#F4F7FB","contentBackgroundColor":"#FFFFFF","textColor":"#172033","mutedTextColor":"#667080","primaryColor":"#087F73","accentColor":"#C06532","borderColor":"#DCE5E7","borderRadius":12,"fontFamily":"Arial"}. emailWidth and borderRadius MUST be JSON numbers, never strings/px. fontFamily exactly one of Arial, Georgia, Verdana, Trebuchet MS. meta.goal one of sale,invite,announcement,reminder,welcome,reactivation,promo,education,custom. meta.tone one of business,friendly,premium,tech,energetic,minimal,expert. meta.length short,medium,long. image/pattern blocks require image with assetId or prompt, never empty decorative blocks.' : '';
  const system = `${contract}\n${themeContract}\n${instructions}\nОбязательная JSON Schema: ${JSON.stringify(schema)}`;
  const userInput = JSON.stringify({ outputContract: `${contract}\n${themeContract}`, task: input });
  const body = provider.provider === "navyai"
    ? { model, messages: [{ role: "system", content: system }, { role: "user", content: userInput }], response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }, max_tokens: name === "email_document" ? 14000 : 4000, reasoning_effort: "low" }
    : { model, instructions: system, input: userInput, store: false, max_output_tokens: name === "email_document" ? 14000 : 4000, text: { format: { type: "json_schema", name, strict: true, schema } } };
  const timeout = name === "email_review" ? 20000 : name === "email_subjects" ? 30000 : 120000;
  const response = await fetch(provider.endpoint, { method: "POST", headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.any([request.signal, AbortSignal.timeout(timeout)]) });
  if (!response.ok) { console.warn("Email studio provider request failed", { action: name, status: response.status }); throw new Error("ИИ временно недоступен."); }
  const data = object(await response.json());
  const choices = Array.isArray(data.choices) ? data.choices : [];
  let text = typeof data.output_text === "string" ? data.output_text : choices.length ? object(object(choices[0]).message).content : undefined;
  if (!text && Array.isArray(data.output)) for (const item of data.output) {
    const row = object(item); if (!Array.isArray(row.content)) continue;
    const content = row.content.map(object).find(x => x.type === "output_text"); if (content) text = content.text;
  }
  if (typeof text !== "string") throw new Error("ИИ не вернул документ.");
  // No Markdown recovery or raw HTML fallback: one bounded repair handles invalid output.
  const value: unknown = withEmailIconDefaults(JSON.parse(text));
  try { validateEmailSchema(value, schema); }
  catch (error) { throw new EmailJsonError(error instanceof Error ? error.message : "Некорректная структура.", value); }
  return { value, model };
}

async function review(provider: Provider | null, request: Request, document: EmailBuilderDocumentInput, brief: AiEmailBrief, existingText: string): Promise<AiEmailReview> {
  const cached = document.aiMetadata?.review;
  if (cached?.rubricVersion === "rules-v1" && !cached.unavailable && cached.fingerprint === emailReviewFingerprint(document, brief)) return cached;
  const measured = reviewEmailDocument(document, brief);
  if (!provider) return measured;
  try {
    const result = await aiJson(provider, request, "email_review", aiEmailReviewSchema, EMAIL_REVIEW_PROMPT, { document: { ...document, aiMetadata: undefined }, brief, checks: measured.checks, sourceOfTruth: emailSourceOfTruth(brief, existingText) });
    return reviewEmailDocument(document, brief, result.value as AiEmailEditorialReview);
  } catch {
    if (request.signal.aborted) throw new ApiRequestError("Создание письма отменено.", 499);
    return measured;
  }
}

async function prepareImages(request: Request, provider: Provider, email: AiEmailDocument, known: Map<string, string>) {
  const assets = new Map(known);
  const pending = email.blocks.filter(b => b.image && !b.image.assetId && b.image.prompt);
  if (pending.length > 3) throw new Error("За один раз можно создать до трёх изображений.");
  for (const block of email.blocks) if (block.image?.assetId && !assets.has(block.image.assetId)) throw new Error("ИИ выбрал недоступное изображение.");
  if (!pending.length) return assets;
  const suggestion: EmailAiSuggestion = {
    creationMode: "original", subject: email.subject, previewText: email.preheader, body: "", cta: "",
    document: { templateId: "", subject: email.subject, previewText: email.preheader, contentWidth: 640, accentColor: email.theme.primaryColor, bodyBackground: email.theme.contentBackgroundColor, workspaceBackground: email.theme.backgroundColor, blocks: pending.map(b => ({ id: b.id, type: b.type === "pattern" ? "pattern" : "image", content: b.image?.alt || "", href: "https://placehold.co/1200x675/png", paddingTop: 0, paddingBottom: 0, backgroundColor: b.backgroundColor || email.theme.contentBackgroundColor, textColor: b.textColor || email.theme.textColor, fontSize: 16, borderRadius: 0 })) },
    imagePrompts: pending.map(b => ({ blockId: b.id, prompt: b.image!.prompt!, alt: b.image!.alt, kind: b.type === "pattern" ? "pattern" : "photo" })),
  };
  await generateDesignImages(request, provider, suggestion, false, request.signal);
  for (const block of pending) {
    const url = suggestion.document?.blocks.find(b => b.id === block.id)?.href;
    if (!url || url.includes("placehold.co")) throw new Error("Изображение не подготовлено.");
    const id = `generated-${block.id}`; assets.set(id, url); block.image = { ...block.image!, assetId: id, prompt: null };
  }
  return assets;
}

export async function emailAiStudio(request: Request, action: string, input: unknown): Promise<AiEmailStudioResponse> {
  await ensureDatabase(request);
  if (!actions.has(action)) throw new ApiRequestError("Действие ИИ не найдено.", 404);
  const provider = aiProvider(); if (!provider && action !== "review") throw new ApiRequestError("ИИ не подключён. Добавьте серверный ключ существующего AI-провайдера.", 503);
  let brief: AiEmailBrief; let current: EmailBuilderDocumentInput | null; const row = object(input);
  try { brief = parseAiEmailBrief(row.brief); current = row.document ? parseEmailBuilderDocument(row.document) : null; }
  catch (error) { throw new ApiRequestError(error instanceof Error ? error.message : "Проверьте поля письма."); }
  if (action !== "generate" && (!current || current.rawHtml)) throw new ApiRequestError("Откройте письмо из редактируемых блоков.");
  const instruction = typeof row.instruction === "string" ? row.instruction.trim().slice(0, 2500) : "";
  if (["rewrite", "rewrite-block"].includes(action) && !instruction) throw new ApiRequestError("Напишите, что изменить.");
  const context = current ? builderToAiEmail(current, brief) : null;
  const existingText = [instruction, current ? [emailDocumentPlainText(current), ...current.blocks.flatMap(b => [b.href || "", b.linkHref || ""])].join("\n") : ""].filter(Boolean).join("\n");
  if (action === "review") return { review: await review(provider, request, current!, brief, existingText) };
  if (!provider) throw new ApiRequestError("ИИ не подключён.", 503);
  const imageChange = current && ["rewrite", "rewrite-block"].includes(action) ? emailImageReplacement(current, instruction, typeof row.blockId === "string" ? row.blockId : undefined) : undefined;
  if (imageChange?.requested) {
    if (!imageChange.blockId) throw new ApiRequestError(imageChange.error || "Выберите изображение.", 422);
    const target = context!.email.blocks.find(b => b.id === imageChange.blockId)!;
    // Replace the visual directly. A text model cannot silently keep an old
    // asset or rewrite the selected paragraph for a photo replacement request.
    const replacement = { ...target, image: { assetId: null, alt: target.image?.alt || "Иллюстрация к письму", prompt: `${instruction}\nСоздай новую тематическую фотографию, без надписей. Тема письма: ${current!.subject}. ${brief.description}\nКонтекст: ${emailDocumentPlainText(current!).slice(0, 5000)}\nПредыдущее описание: ${target.image?.alt || ""}` } };
    try {
      const draft = { ...context!.email, blocks: [replacement] };
      const assets = await prepareImages(request, provider, draft, new Map(context!.assets));
      const url = assets.get(replacement.image.assetId!);
      if (!url) throw new Error("Missing replacement image");
      const metadata = { brief, generationId: crypto.randomUUID(), generatedAt: new Date().toISOString(), model: provider.model };
      const next = { ...current!, aiMetadata: metadata, blocks: current!.blocks.map(b => b.id !== target.id ? b : b.type === "hero" ? { ...b, imageHref: url, imageAlt: replacement.image.alt } : { ...b, href: url }) };
      const report = await review(provider, request, next, brief, existingText);
      return { document: { ...next, aiMetadata: { ...metadata, review: report } }, review: report, changedBlockId: target.id, message: "Изображение заменено. Текст и оформление сохранены. Изменение можно отменить." };
    } catch (error) {
      if (request.signal.aborted) throw new ApiRequestError("Замена изображения отменена.", 499);
      if (error instanceof ApiRequestError) throw error;
      throw new ApiRequestError("Не удалось создать новое изображение. Повторите команду — прежняя картинка сохранена.", 502);
    }
  }
  if (action === "subject-variants") {
    let repair: string | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      let received = false;
      try {
        const result = await aiJson(provider, request, "email_subjects", subjectVariantsSchema, "Предложи ровно 3 разные пары subject/preheader по текущему письму. Прехедер дополняет тему. Не меняй факты и числа, без выдуманной срочности, без HTML. Верни только JSON по схеме.", { email: context!.email, brief, repair }, attempt > 0);
        received = true;
        const variants = object(result.value).variants as Array<{ subject: string; preheader: string }>;
        if (new Set(variants.map(v => v.subject.trim().toLocaleLowerCase("ru"))).size !== 3) throw new Error("Предложи три разные темы, без повторений.");
        for (const variant of variants) if (emailFactIssues({ ...context!.email, ...variant, blocks: [] }, brief, existingText).length) throw new Error("Тема меняет факты. Используй только исходные сведения.");
        return { variants };
      } catch (error) {
        if (request.signal.aborted) throw new ApiRequestError("Подбор тем отменён.", 499);
        if (attempt === 0 && (received || error instanceof EmailJsonError || error instanceof SyntaxError)) { repair = error instanceof Error ? error.message : "Исправь структуру JSON."; continue; }
        throw new ApiRequestError("Не удалось подобрать темы. Повторите подбор — текущая тема письма сохранена.", 502);
      }
    }
  }

  const selected = action === "rewrite-block" ? context?.email.blocks.find(b => b.id === row.blockId) : undefined;
  if (action === "rewrite-block" && !selected) throw new ApiRequestError("Выберите блок для изменения.");
  const iconLibrary = brief.visuals === "none" ? [] : selectEmailIcons([brief.description, brief.requiredContent, ...brief.requiredFacts, instruction].join(" "), context?.email.blocks.flatMap(block => block.items.map(item => item.iconId || "")) ?? []);
  const iconSchemas = aiEmailSchemasForIcons(iconLibrary.map(icon => icon.id));
  const knownAssets = new Map(context?.assets);
  for (const icon of iconLibrary) knownAssets.set(`icon-${icon.id}`, emailIconUrl(icon.id));
  for (const asset of brief.assets) {
    const stored = await getEmailAssetRecord(request, asset.id);
    knownAssets.set(asset.id, stored.url);
  }
  const payload = { brief, sourceOfTruth: emailSourceOfTruth(brief, existingText), email: selected ? undefined : context?.email, block: selected, blockOnly: Boolean(selected), instruction, availableAssets: [...knownAssets.keys()], iconLibrary: iconLibrary.map(({ id, name, collection, category }) => ({ id, name, collection, category, assetId: `icon-${id}` })) };
  let email: AiEmailDocument | undefined; let failedDraft: unknown; let model = provider.model; let repaired = false;
  const generate = async (repair?: string[]) => {
    const result = await aiJson(provider, request, selected ? "email_block" : "email_document", selected ? iconSchemas.block : iconSchemas.document, `${action === "generate" ? EMAIL_STRATEGIST_PROMPT : EMAIL_EDIT_PROMPT}${repair ? "\nИсправь ТОЛЬКО перечисленные ошибки в previousDraft. Не создавай новый дизайн и не переписывай остальные блоки. Верни полный исправленный JSON." : ""}`, { ...payload, previousDraft: failedDraft || email, repairIssues: repair }, Boolean(repair));
    failedDraft = result.value;
    model = result.model;
    if (selected) {
      const block = parseAiEmailBlock(result.value);
      if (selected.type === "pattern" && /пересозда|прозрач|без фона/iu.test(instruction) && (!block.image?.prompt || block.image.assetId)) throw new Error("Для нового прозрачного орнамента верни image с новым prompt и assetId=null.");
      if (block.id !== selected.id || block.type !== selected.type) throw new Error("Сохрани тип и ID выбранного блока.");
      if (["benefits", "cards", "speakers", "products", "stats"].includes(block.type) && (block.title || block.text)) throw new Error("При редактировании этого блока запиши весь контент в items; title и text оставь пустыми. Не добавляй соседние заголовки.");
      if (selected.button && block.type === "cta" && (block.title || block.text)) throw new Error("При редактировании кнопки меняй button, title и text оставь пустыми.");
      email = { ...context!.email, blocks: [block] };
    } else email = parseAiEmailDocument(result.value);
    const issues = emailFactIssues(email, brief, existingText);
    if (issues.length) throw new Error(issues.join(" "));
  };
  try {
    try { await generate(); } catch (error) { if (request.signal.aborted) throw error; if (error instanceof EmailJsonError) failedDraft = error.draft; repaired = true; await generate([error instanceof Error ? error.message : "Некорректная структура."]); }
    const assets = await prepareImages(request, provider, email!, knownAssets);
    const metadata = { brief, generationId: crypto.randomUUID(), generatedAt: new Date().toISOString(), model };
    const mapped = mapAiEmailToBuilderDocument(email!, brief, assets, metadata);
    let document = mapped;
    if (selected && current) {
      const replacement = mapped.blocks.find(b => b.id === selected.id);
      if (!replacement) throw new Error("ИИ не вернул выбранный блок.");
      document = { ...current, aiMetadata: metadata, blocks: current.blocks.map(block => block.id === selected.id ? { ...block, content: replacement.content, badge: replacement.badge, href: replacement.href, label: replacement.label, variant: replacement.variant, backgroundColor: replacement.backgroundColor, textColor: replacement.textColor, imageHref: replacement.imageHref, imageAlt: replacement.imageAlt, itemIcons: replacement.itemIcons } : block) };
    } else if (current) {
      const changeDesign = /дизайн|оформлен|стил|композици|цвет|палитр|шрифт|вариант|премиальн|технологич|макет|фон|layout|design/iu.test(instruction);
      document = { ...mapped, templateId: current.templateId };
      if (!changeDesign) {
        // Copy edits do not erase manual typography, frame, spacing or untouched variants.
        document = { ...current, subject: mapped.subject, previewText: mapped.previewText, aiMetadata: metadata, blocks: mapped.blocks.map(next => {
          const old = current.blocks.find(block => block.id === next.id && block.type === next.type);
          return old ? { ...old, content: next.content, badge: next.badge, href: next.href, label: next.label, imageHref: next.imageHref, imageAlt: next.imageAlt, itemIcons: next.itemIcons, aiRole: next.aiRole, variant: old.variant || next.variant } : next;
        }) };
      }
    }
    const valid = parseEmailBuilderDocument(document);
    if (!valid) throw new Error("Пустое письмо.");
    if (current && emailReviewFingerprint(valid, brief) === emailReviewFingerprint(current, brief)) throw new ApiRequestError("ИИ вернул письмо без изменений. Уточните команду или выберите другой блок.", 422);
    const report = await review(provider, request, valid, brief, existingText);
    valid.aiMetadata = { ...metadata, review: report };
    return { document: valid, review: report };
  } catch (error) {
    if (request.signal.aborted) throw new ApiRequestError("Создание письма отменено.", 499);
    console.warn("Email studio generation failed", { action, stage: email ? "review-or-mapping" : "generation", repaired });
    if (error instanceof ApiRequestError) throw error;
    throw new ApiRequestError("Не удалось собрать письмо. Попробуйте повторить генерацию — текущий макет сохранён.", 502);
  }
}
