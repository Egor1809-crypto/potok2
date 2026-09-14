import assert from "node:assert/strict";
import test from "node:test";
import * as phones from "../lib/contact-finder/phones.ts";
import { loadAiServer } from "./helpers/ai-server-harness.mjs";

const extractor = await loadAiServer("lib/server/contact-finder.ts", {
  overrides: { "@/lib/contact-finder/phones": phones }, expose: ["extractFromText"],
});
const values = (rows, type = "phone") => Array.from(rows).filter(row => row.type === type).map(row => row.value).sort();
const text = async input => (await extractor.findPublicContacts({mode:"text", text:input, acknowledgedResponsibleUse:true})).candidates;
const html = input => extractor.extractFromText(input, "https://business.example.org/contacts", "Контакты", "business.example.org", true);

test("the screenshot INN and OGRN are not phone contacts; the email survives", async () => {
  const rows = await text('ООО «АСПБ», ИНН 6452098049, КПП 645001001, ОГРН 1126450005406. Контакт по вопросам обработки персональных данных: hello@legalhunter.ru');
  assert.deepEqual(values(rows), []);
  assert.deepEqual(values(rows, "email"), ["hello@legalhunter.ru"]);
});

test("registration and bank identifiers are excluded even if their digits match a valid phone plan", async () => {
  for (const label of ['ИНН','КПП','ОГРН','ОГРНИП','СНИЛС','БИК','р/с','к/с','Расчётный счёт','Паспорт','Артикул','Номер заказа','VAT ID','Tax number','Account number']) {
    assert.deepEqual(values(await text(`${label}: 9123456789`)), [], label);
  }
  assert.deepEqual(values(await text('Р/с 40702810900000123456, ОГРН 1126450005406, 9123456789 — ИНН')), []);
});

test("nearby legal details do not hide real telephone fields", async () => {
  const rows = await text('ИНН: 9123456789; тел.: 8 (495) 123-45-67; ОГРН 1126450005406.\nТелефон: 9161234567; ИНН 6452098049');
  assert.deepEqual(values(rows), ['+74951234567', '+79161234567']);
});

test("valid Russian and international phones normalize, deduplicate and keep extension in evidence", async () => {
  const rows = await text('Телефон 8 (916) 123-45-67\n+7 916 123 45 67\nТел.: (495) 123-45-67 доб. 123\nLondon +44 20 7946 0958\nNew York +1 212 555 0123');
  assert.deepEqual(values(rows), ['+12125550123', '+442079460958', '+74951234567', '+79161234567']);
  assert.match(rows.find(r => r.value === '+74951234567').context, /доб\. 123/);
});

test("unlabelled digits, dates, item codes and URL paths are not invented phones", async () => {
  for (const input of ['9123456789','79161234567','2026-09-14 10:30:00','ID_79161234567','https://business.example.org/79161234567','0000000000','+1126450005406','+6452098049']) {
    assert.deepEqual(values(await text(input)), [], input);
  }
});

test("multiple phones retain separate lines and HTML table boundaries", () => {
  const rows = html('<table><tr><th>ИНН</th><td>9123456789</td></tr><tr><th>Телефон</th><td>8 (495) 123-45-67</td></tr><tr><td>+7 916 123-45-67</td><td>+44 20 7946 0958</td></tr></table>');
  assert.deepEqual(values(rows), ['+442079460958', '+74951234567', '+79161234567']);
});

test("a telephone label supports a list of unformatted numbers without treating the second as an extension", async () => {
  assert.deepEqual(values(await text('Телефоны: 84951234567, 89161234567; +44 20 7946 0958')), ['+442079460958', '+74951234567', '+79161234567']);
  assert.deepEqual(values(await text('Телефон для связи: 9161234567')), ['+79161234567']);
});

test("direct telephone links are validated and cannot turn mislabelled INN into a contact", () => {
  const rows = html('<p><a href="tel:9123456789">ИНН 9123456789</a></p><p><a href="tel:1126450005406">ОГРН 1126450005406</a></p><p><a href="tel:%2B7-495-123-45-67;ext=123">Позвонить</a></p><p>8 (495) 123-45-67</p>');
  assert.deepEqual(values(rows), ['+74951234567']);
  assert.equal(rows.find(r => r.type === 'phone').confidence, 'high');
});

test("structured contact metadata uses real JSON and not arbitrary JavaScript, comments or tax IDs", () => {
  const rows = html(`<script type="application/ld+json">{"@type":"Organization","taxID":"9123456789","contactPoint":[{"telephone":"+7 495 123-45-67","email":"office@business.ru"},{"telephone":["+44 20 7946 0958"]}]}</script>
    <script>const demo={"phone":"+7 916 123-45-67"}; const link='<a href="tel:+79161234567">x</a>';</script>
    <!-- <a href="tel:+79161234567">demo</a> -->
    <script type="application/ld+json">{"phone":"+7 916 123-45-67",}</script>`);
  assert.deepEqual(values(rows), ['+442079460958', '+74951234567']);
  assert.deepEqual(values(rows, 'email'), ['office@business.ru']);
});

test("encoded phone attributes and malformed entities cannot break extraction", () => {
  const rows = html('<p>&#999999999999; <a href="tel:&#43;7&#160;916&#160;123-45-67">Телефон</a></p><div data-phone="+44 20 7946 0958"></div><a href="mailto:hello@business.ru">hello@business.ru</a>');
  assert.deepEqual(values(rows), ['+442079460958', '+79161234567']);
  assert.deepEqual(values(rows, 'email'), ['hello@business.ru']);
});

test("URL crawl uses the same strict extraction and leaves results unsaved", async () => {
  const calls = [];
  const server = await loadAiServer("lib/server/contact-finder.ts", {
    overrides: { "@/lib/contact-finder/phones": phones },
    fetch: async input => {
      const url = new URL(String(input)); calls.push(url);
      if (url.hostname === 'cloudflare-dns.com') return Response.json({Status:0,Answer:url.searchParams.get('type')==='A' ? [{type:1,data:'8.8.8.8'}] : []});
      assert.equal(url.origin, 'https://business.example.org');
      if (url.pathname === '/robots.txt') return new Response('', {status:404});
      return new Response('<title>Контакты компании</title><p>ИНН 6452098049, ОГРН 1126450005406</p><p>Телефон: +7 (495) 123-45-67</p><a href="mailto:hello@legalhunter.ru">Написать</a>',{headers:{'content-type':'text/html'}});
    },
  });
  const result = await server.findPublicContacts({mode:'url',url:'https://business.example.org/',includeSameSitePages:false,acknowledgedResponsibleUse:true});
  assert.deepEqual(values(result.candidates), ['+74951234567']);
  assert.deepEqual(values(result.candidates, 'email'), ['hello@legalhunter.ru']);
  assert.equal(result.summary.scannedPageCount, 1);
  assert.equal(result.policy.persisted, false);
  assert.equal(result.candidates[0].sourceUrl, 'https://business.example.org/');
});
