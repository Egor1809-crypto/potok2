import assert from "node:assert/strict";
import test from "node:test";
import { codeImportPath, importCodeLetter, unwrapCodeFence } from "../lib/email-import/code.ts";
import { disposeImportedLetter } from "../lib/email-import/import-letter.ts";
import { compileEmailDocument, parseEmailBuilderDocument } from "../lib/server/email-document.ts";
import { loadAiServer } from "./helpers/ai-server-harness.mjs";

const input = code => ({ code, mode: "auto", instructions: "", resources: [] });
const env = { NAVYAI_API_KEY: "test-key", NAVYAI_EMAIL_MODEL: "gpt-5.6-sol" };
const output = (html, extra = {}) => JSON.stringify({ status: "converted", name: "Приглашение", subject: "Встреча 16 сентября", previewText: "В 14:00", html, notes: [], ...extra });
const reply = body => Response.json({ choices: [{ message: { content: body } }] });
const request = () => new Request("https://example.org/api/email-import/code", { method: "POST" });

test("pasted HTML survives import, document validation and compilation without rewriting or AI", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Static HTML must not call AI"); });
  const html = '\n<!-- исходник -->\n<!doctype html><html><head><title>Приглашение</title><style>@media(max-width:500px){td{color:#123456}}</style></head><body><!--[if mso]><table><tr><td><![endif]--><h1 style="color:#eaba31">До встречи, {{first_name}}</h1><a href="https://example.org/?a=1&amp;b=2">Участвовать</a><!--[if mso]></td></tr></table><![endif]--></body></html>\n';
  const letter = await importCodeLetter(input(html), () => {});
  assert.equal(compileEmailDocument(parseEmailBuilderDocument(letter.document)), html);
  assert.equal(letter.name, "Приглашение");
  assert.equal(letter.document.subject, "Приглашение");
  disposeImportedLetter(letter);
});

test("fragments and code fences are accepted; JSX, MJML, Markdown and programs go to conversion", async () => {
  const html = '<table><tr><td style="color:#123456">До встречи</td></tr></table>';
  assert.equal(unwrapCodeFence('```html\n' + html + '\n```'), html);
  const letter = await importCodeLetter(input('```html\n' + html + '\n```'), () => {});
  assert.ok(compileEmailDocument(parseEmailBuilderDocument(letter.document)).includes(html));
  for (const code of ['<div className="p-4">Привет</div>', '<div>{name}</div>', '<>Привет</>', '<mjml><mj-body>Привет</mj-body></mjml>', '# Приглашение\nДо встречи', 'print("Приглашение")', 'const name = "Иван";']) {
    assert.equal(codeImportPath(code).path, "ai", code);
  }
  assert.equal(codeImportPath('<p>Здравствуйте, {{first_name}}</p>').path, "html");
  assert.equal(codeImportPath('<div><script>alert(1)</script>Привет</div>').path, "ai");
  assert.throws(() => codeImportPath('<div className="p-4">Привет</div>', "html"), /статичный HTML/);
  assert.throws(() => codeImportPath('<html><script>alert(1)</script></html>', "html"), /сценарии/);
  assert.throws(() => codeImportPath(" "), /Вставьте/);
  assert.throws(() => codeImportPath("x".repeat(60_001)), /60 000/);
  disposeImportedLetter(letter);
});

test("attached CSS and local images remain part of the pasted letter", async () => {
  const html = '<!doctype html><html><head><link rel="stylesheet" href="assets/letter.css"></head><body><img src="images/logo.png"><p>Точный текст</p></body></html>';
  const resources = [new File(['p{color:#eaba31}'], "letter.css", { type: "text/css" }), new File([new Uint8Array([137,80,78,71,13,10,26,10])], "logo.png", { type: "image/png" })];
  const letter = await importCodeLetter({ ...input(html), resources }, () => {});
  assert.match(letter.document.rawHtml, /p\{color:#eaba31\}/);
  assert.equal(letter.resources.length, 1);
  assert.ok(letter.document.rawHtml.includes(letter.resources[0].url));
  assert.match(letter.document.rawHtml, /<p>Точный текст<\/p>/);
  disposeImportedLetter(letter);
});

test("AI conversion creates a preview without saving it; explicit wishes enable AI for HTML", async t => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url, data: JSON.parse(init.body) });
    return Response.json(JSON.parse(output('<html><body><h1>Приглашение</h1></body></html>')));
  });
  const code = '<h1>Приглашение</h1>';
  const letter = await importCodeLetter({ ...input(code), instructions: "Сделать заголовок синим" }, () => {});
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/email-import/code");
  assert.deepEqual(calls[0].data, { code, instructions: "Сделать заголовок синим" });
  assert.equal(letter.name, "Приглашение");
  assert.equal(letter.document.subject, "Встреча 16 сентября");
  assert.match(letter.notes[0], /Проверьте/);
  disposeImportedLetter(letter);
});

test("production converter sends code as data and returns static output without executing programs", async () => {
  const calls = [];
  const code = 'globalThis.__codeExecuted = true; const title = "Приглашение"; return <h1>{title}</h1>;';
  const api = await loadAiServer("lib/server/email-code-import.ts", { env, fetch: async (url, init) => {
    calls.push(JSON.parse(init.body));
    return reply(output('<html><body><h1>Приглашение</h1></body></html>'));
  } });
  const converted = await api.convertEmailCode(request(), { code });
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].messages.at(-1).content).sourceCode, code);
  assert.equal(calls[0].response_format.json_schema.strict, true);
  assert.equal(globalThis.__codeExecuted, undefined);
  assert.match(converted.html, /<h1>Приглашение<\/h1>/);
});

test("unsafe AI output gets one repair; repeated unsafe output is rejected", async () => {
  let calls = 0;
  const api = await loadAiServer("lib/server/email-code-import.ts", { env, fetch: async () => {
    calls += 1;
    return reply(output(calls === 1 ? '<html><body><script>alert(1)</script>Привет</body></html>' : '<html><body>Привет</body></html>'));
  } });
  assert.match((await api.convertEmailCode(request(), { code: 'print("Привет")' })).html, /Привет/);
  assert.equal(calls, 2);
  let unsafeCalls = 0;
  const unsafeApi = await loadAiServer("lib/server/email-code-import.ts", { env, fetch: async () => {
    unsafeCalls += 1;
    return reply(output('<html><body><p onclick="alert(1)">Привет</p></body></html>'));
  } });
  await assert.rejects(unsafeApi.convertEmailCode(request(), { code: 'print("Привет")' }), error => error.status === 422);
  assert.equal(unsafeCalls, 2);
});

test("missing data is reported without fabrication or automatic retry", async () => {
  let calls = 0;
  const api = await loadAiServer("lib/server/email-code-import.ts", { env, fetch: async () => {
    calls += 1;
    return reply(output("", { status: "needs_input", notes: ["Укажите дату и текст приглашения."] }));
  } });
  await assert.rejects(api.convertEmailCode(request(), { code: "return render_email(remote_data)" }), error => error.status === 422 && /Укажите дату/.test(error.message));
  assert.equal(calls, 1);
});

test("provider absence and oversize code produce actionable errors without provider calls", async () => {
  const api = await loadAiServer("lib/server/email-code-import.ts", { fetch: () => { throw new Error("No model calls expected"); } });
  await assert.rejects(api.convertEmailCode(request(), { code: "print('Привет')" }), error => error.status === 503);
  await assert.rejects(api.convertEmailCode(request(), { code: "x".repeat(60_001) }), error => error.status === 400);
  assert.throws(() => api.parseConvertedCode(output('<html><head><style>p{color:red}</style></head><body></body></html>')), /нет содержимого/);
});

test("API bounds actual body bytes and rejects invalid JSON before model calls", async () => {
  const api = await loadAiServer("app/api/email-import/code/route.ts", { fetch: () => { throw new Error("No model calls expected"); } });
  const oversized = new Request("https://example.org/api/email-import/code", { method: "POST", body: "x".repeat(250_001) });
  assert.equal((await api.POST(oversized)).status, 413);
  const invalid = new Request("https://example.org/api/email-import/code", { method: "POST", body: "{" });
  assert.equal((await api.POST(invalid)).status, 400);
});
