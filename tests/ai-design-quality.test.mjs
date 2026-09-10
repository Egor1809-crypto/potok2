import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { loadAiServer } from "./helpers/ai-server-harness.mjs";
import { contrastRatio } from "../lib/design-readability.ts";
import { presentationChartData, presentationVisualIssues, requestedPresentationColors, presentationStepText } from "../lib/presentation-design-quality.ts";

const fixture = async (name) => JSON.parse(await readFile(new URL(`./fixtures/ai-design/${name}.json`, import.meta.url), "utf8"));
const request = () => new Request("https://design-test.example/api/ai");
const env = { NAVYAI_API_KEY: "test-key", NAVYAI_EMAIL_MODEL: "gpt-5.6-sol" };
const providerResponse = (text) => Response.json({ choices: [{ message: { content: text } }] });

async function generateEmail(name) {
  const example = await fixture(name);
  const calls = [];
  const server = await loadAiServer("lib/server/email-ai.ts", { env, fetch: async (url, init) => {
    assert.match(String(url), /chat\/completions$/); // A no-image brief must never call image generation.
    const payload = JSON.parse(init.body);
    if (payload.response_format?.json_schema?.name === "email_brief_review") return providerResponse(JSON.stringify({ issues: [] }));
    calls.push(payload);
    return providerResponse(example.providerText);
  } });
  return { result: await server.generateEmailSuggestion(request(), example.input), calls, example };
}

test("a real personal design keeps its short composition, time and individual spacing", async () => {
  const { result, calls } = await generateEmail("email-personal");
  const blocks = result.suggestion.document.blocks;
  assert.deepEqual(Array.from(blocks, (block) => block.type), ["hero", "text", "text", "text"]);
  assert.match(blocks.map((block) => block.content).join(" "), /18 сентября[\s\S]*19:00[\s\S]*Сад/);
  assert.equal(blocks[0].content, "Ужин в «Саду»|Анна, добрый день!");
  assert.equal(blocks[0].fontWeight, 400);
  assert.equal(blocks[0].paddingTop, 32);
  assert.equal(blocks[2].paddingTop, 24);
  assert.ok(blocks.every((block) => block.paddingLeft === 40 && block.paddingRight === 40));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].response_format.json_schema.strict, true);
  assert.equal(result.generationNotice, undefined);
});

test("real event output keeps unfamiliar program/details blocks and the exact CTA", async () => {
  const { result, example } = await generateEmail("email-event");
  const doc = result.suggestion.document;
  const content = doc.blocks.map((block) => block.content).join(" ");
  for (const fact of ["Автоматизация договоров", "Безопасность данных", "Судебная аналитика", "24 сентября 2026", "10:00"]) assert.ok(content.includes(fact), fact);
  const button = doc.blocks.find((block) => block.type === "button");
  assert.equal(button.content, example.input.ctaLabel);
  assert.equal(button.label, example.input.ctaLabel);
  assert.equal(button.href, example.input.websiteUrl);
  assert.ok(doc.blocks.filter((block) => block.backgroundColor === "#0a0a0a").length >= 2);
  for (const block of doc.blocks.filter((block) => block.type !== "button")) {
    assert.ok(contrastRatio(block.textColor, block.backgroundColor === "transparent" ? doc.bodyBackground : block.backgroundColor) >= 4.5);
  }
  const compiler = await loadAiServer("lib/server/email-document.ts");
  const html = compiler.compileEmailDocument(doc);
  assert.match(html, /Автоматизация договоров/);
  assert.match(html, /padding:30px 40px 32px 40px/);
  assert.match(html, /href="https:\/\/example.com\/register"/);
});

test("provider failure never returns an unrelated basic letter as a successful design", async () => {
  const server = await loadAiServer("lib/server/email-ai.ts", { env, fetch: async () => Response.json({ error: "unavailable" }, { status: 500 }) });
  const input = { action: "design", goal: "Встреча команды 28 сентября в 17:00", visualContent: "none", imageSource: "none" };
  await assert.rejects(server.generateEmailSuggestion(request(), input), /ИИ не смог подготовить письмо/);
});

test("real presentation has the requested slide count, readable layouts and no unwanted artwork", async () => {
  const example = await fixture("presentation-report");
  let calls = 0;
  const server = await loadAiServer("lib/server/presentation-ai.ts", { env, fetch: async (url) => {
    assert.match(String(url), /chat\/completions$/);
    calls++;
    return providerResponse(example.providerText);
  } });
  const result = await server.generatePresentationOutline(request(), example.input);
  const slides = result.outline.slides;
  assert.equal(result.generationMode, "provider");
  assert.equal(slides.length, 7);
  assert.equal(calls, 1);
  assert.equal(slides[0].title, "Автоматизация ускорила проверку договоров");
  assert.ok(slides.every((slide) => slide.patternId === "none" && !slide.imagePrompt));
  assert.ok(new Set(slides.map((slide) => slide.layout)).size >= 5);
  assert.deepEqual(presentationVisualIssues(slides), []);
  assert.equal(result.outline.backgroundColor, "#FFFFFF");
  assert.equal(result.outline.accentColor, "#245BD8");
  const exporter = await loadAiServer("lib/server/presentation-pptx.ts");
  const zip = unzipSync(await exporter.buildPresentationPptx(request(), { ...result.outline, id: "eval", name: "Проверка" }));
  const second = strFromU8(zip["ppt/slides/slide2.xml"]);
  assert.match(second, /До пилота, минут/);
  assert.match(second, /Снижение с 40 до 28 минут/);
  assert.match(second, /typeface="Georgia"/);
  for (const shape of second.match(/<p:sp>[\s\S]*?<\/p:sp>/g) ?? []) {
    if (/name="Столбец/.test(shape)) assert.doesNotMatch(shape, /roundRect/);
  }
});

test("art direction preserves the model's image placement and an explicit empty pattern", async () => {
  const server = await loadAiServer("lib/server/presentation-ai.ts", { expose: ["applyPresentationArtDirection"] });
  const slide = { title: "Продукт", body: "", bullets: [], eyebrow: "", speakerNotes: "", themeId: "modern", patternId: "none" };
  const result = server.applyPresentationArtDirection([
    { ...slide, id: "one", layout: "title" },
    { ...slide, id: "two", layout: "chart", bullets: ["40|минут"] },
    { ...slide, id: "three", layout: "gallery", imagePrompt: "Предмет на светлом фоне" },
    { ...slide, id: "four", layout: "closing" },
  ], { goal: "Презентация продукта", designBrief: "Светлая редакционная композиция" }, "modern");
  assert.deepEqual(Array.from(result, (item) => Boolean(item.imagePrompt)), [false, false, true, false]);
  assert.ok(result.every((item) => item.patternId === "none"));
});

test("layout review catches overfull slides and charts scale actual values including zero", () => {
  const issues = presentationVisualIssues([{ layout: "split", title: "Тема", body: "Объяснение ".repeat(40), bullets: ["Аргумент"], imagePrompt: "Иллюстрация" }]);
  assert.ok(issues.some((issue) => issue.includes("не помещается")));
  assert.ok(issues.some((issue) => issue.includes("место списка")));
  assert.deepEqual(presentationChartData(["400|До", "280|После", "0|Без случаев"]).map((item) => item.fraction), [1, 0.7, 0]);
  assert.deepEqual(requestedPresentationColors("Белое поле, тёмный текст, синий акцент"), { accentColor: "#245BD8", backgroundColor: "#FFFFFF", textColor: "#17191C" });
  assert.equal(presentationStepText("1. Определить расположение", 0), "Определить расположение");
  assert.equal(presentationStepText("2026 — начало пилота", 0), "2026 — начало пилота");
});
