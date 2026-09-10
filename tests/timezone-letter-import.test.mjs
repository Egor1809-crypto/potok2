import assert from "node:assert/strict";
import test from "node:test";
import { russianTimeZones, zonedInputToIso, zonedInputValue } from "../lib/russian-timezones.ts";
import { completeHtml, decodeDocument, textLetter } from "../lib/email-import/formats.ts";
import { importLetter, disposeImportedLetter } from "../lib/email-import/import-letter.ts";
import { parseEmailBuilderDocument, compileEmailDocument, emailDocumentPlainText } from "../lib/server/email-document.ts";

test("all eleven Russian zones round-trip calendar input across a day boundary", () => {
  assert.equal(russianTimeZones.length, 11);
  for (const [index, zone] of russianTimeZones.entries()) {
    const utc = zonedInputToIso("2026-09-10T01:15", zone.value);
    assert.equal(utc, new Date(Date.UTC(2026,8,10,1-(index+2),15)).toISOString());
    assert.equal(zonedInputValue(utc, zone.value), "2026-09-10T01:15");
  }
  assert.equal(zonedInputToIso("2026-02-30T10:00", "Europe/Moscow"), null);
});

test("HTML retains CSS, conditional Outlook markup, links and text through parsing and compilation", async () => {
  const original = '\n<!-- исходник -->\n<!doctype html><html><head><style>@media(max-width:500px){td{font-size:14px}}</style></head><body><!--[if mso]><table><tr><td><![endif]--><table width="640" cellpadding="0"><tr><td style="color:#123456"><a href="https://example.org/?a=1&amp;b=2">Привет &amp; до встречи</a></td></tr></table><!--[if mso]></td></tr></table><![endif]--></body></html>\n';
  assert.equal(completeHtml(original), original);
  assert.equal((completeHtml('<body style="margin:0">Письмо</body>').match(/<body/g) ?? []).length, 1);
  const imported = await importLetter([new File([original], "letter.html")], () => {});
  const parsed = parseEmailBuilderDocument(imported.document);
  assert.equal(compileEmailDocument(parsed), original);
  assert.equal(imported.resources.length, 0);
  disposeImportedLetter(imported);
});

test("HTML with local images requires its assets and replaces only resource locations", async () => {
  const html = '<!doctype html><html><body><img src="images/logo.png" width="280" style="border:0"><p>images/logo.png</p></body></html>';
  await assert.rejects(importLetter([new File([html], "letter.html")], () => {}), /Не найден ресурс/);
  const image = new File([new Uint8Array([137,80,78,71,13,10,26,10])], "logo.png", {type:"image/png"});
  const imported = await importLetter([new File([html], "letter.html"), image], () => {});
  assert.equal(imported.resources.length, 1);
  assert.equal(imported.document.rawHtml.replace(imported.resources[0].url,"images/logo.png"), html);
  assert.ok(imported.document.rawHtml.includes('<p>images/logo.png</p>'));
  disposeImportedLetter(imported);
});

test("TXT preserves Cyrillic, whitespace and literal HTML characters; unsafe HTML is rejected", async () => {
  const text = '  Первая строка\n\n\tВторая <не тег> & конец  ';
  const imported = await importLetter([new File([text], "letter.txt")], () => {});
  assert.equal(imported.document.rawHtml, textLetter(text));
  assert.equal(emailDocumentPlainText(parseEmailBuilderDocument(imported.document)), text);
  assert.ok(imported.document.rawHtml.includes('  Первая строка\n\n\tВторая &lt;не тег&gt; &amp; конец  '));
  assert.equal(decodeDocument(new Uint8Array([0xff,0xfe,0x1f,0x04,0x40,0x04])), "Пр");
  await assert.rejects(importLetter([new File(['<html><script>alert(1)</script></html>'], "letter.html")], () => {}), /сценарии/);
  assert.throws(() => parseEmailBuilderDocument({ ...imported.document, rawHtml: '<html><script>alert(1)</script></html>' }), /сценарии/);
  disposeImportedLetter(imported);
});

test("image-only letters retain their visual HTML and receive a plain-text alternative", async () => {
 const html = '<!doctype html><html><body><img src="https://example.org/page.png" alt="Текст страницы &amp; подробности"></body></html>';
 const imported = await importLetter([new File([html], "page.html")], () => {});
 const document = parseEmailBuilderDocument(imported.document);
 assert.equal(compileEmailDocument(document), html);
 assert.equal(emailDocumentPlainText(document), "Текст страницы & подробности");
 disposeImportedLetter(imported);
});
