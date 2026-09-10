import assert from 'node:assert/strict';
import test from 'node:test';
import { emailPromptFields, emailBriefConstraints } from '../lib/email-ai-brief.ts';
import { loadAiServer } from './helpers/ai-server-harness.mjs';

const response = (value) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
const block = (type, content, other = {}) => ({ type, content, backgroundColor: '#FFFFFF', textColor: '#17191C', alignment: 'left', paddingLeft: 36, paddingTop: 16, paddingBottom: 16, ...other });
const design = (blocks) => ({ subject: 'Точное письмо', previewText: 'Детали встречи', body: blocks.map((b) => b.content).join('\n'), cta: 'Другой текст', design: { accentColor: '#D4AF37', bodyBackground: '#FFFFFF', workspaceBackground: '#EEEEEE', headingFont: 'Arial', bodyFont: 'Arial', blocks } });
const base = { action: 'design', goal: 'Подготовь короткое письмо клиенту.', useLinkedContext: false };
const request = () => new Request('https://evaluation.example/api/ai/email-assistant');
async function serverWith(replies) {
  const calls = [];
  const server = await loadAiServer('lib/server/email-ai.ts', { env: { NAVYAI_API_KEY: 'test-key' }, fetch: async (url, init) => {
    assert.match(String(url), /chat\/completions$/);
    const body = JSON.parse(init.body); calls.push(body);
    assert.ok(replies.length, 'Unexpected model call');
    return response(replies.shift());
  } });
  return { server, calls };
}

test('prompt payload keeps newlines and URLs when page reading is disabled, without invented CTA defaults', () => {
  const goal = 'Заголовок: «вы приглашены»\nТекст без изменений.\nСправка: https://example.org/about';
  const payload = emailPromptFields(goal, false);
  assert.equal(payload.goal, goal);
  assert.equal(payload.useLinkedContext, false);
  assert.equal(payload.websiteUrl, undefined);
  assert.equal(payload.ctaLabel, undefined);
  assert.equal(emailPromptFields(goal, true, '  записаться  ', 'https://example.org/rsvp').ctaLabel, 'записаться');
});

test('clear negative instructions cover illustrations, patterns and buttons without turning a reference URL into a CTA', () => {
  assert.deepEqual(emailBriefConstraints({ ...base, goal: 'Без иллюстраций, без узоров и без кнопок. Справка https://example.org.' }), { noImages: true, noPatterns: true, noButtons: true, noLogos: false });
  assert.equal(emailBriefConstraints(base).noImages, false);
});

test('exact lowercase heading, typography copy and white/gold color roles survive final rendering unchanged', async () => {
  const blocks = [block('heading', 'типографика без ошибок'), block('text', 'Белый текст и стиль письма обсудим 18 сентября в 19:00.')];
  const { server, calls } = await serverWith([design(blocks), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Заголовок дословно: «типографика без ошибок». Текст: «Белый текст и стиль письма обсудим 18 сентября в 19:00.». Справка https://example.org. Без иллюстраций, без кнопок.', designBrief: 'Фон #FFFFFF, текст #17191C, золотой акцент #D4AF37. Без узоров.' });
  const doc = result.suggestion.document;
  assert.deepEqual(Array.from(doc.blocks, (b) => b.content), blocks.map((b) => b.content));
  assert.equal(doc.bodyBackground.toUpperCase(), '#FFFFFF');
  assert.equal(doc.accentColor.toUpperCase(), '#D4AF37');
  assert.equal(doc.blocks[0].textColor.toUpperCase(), '#17191C');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].response_format.json_schema.name, 'email_brief_review');
  const finalCheck = JSON.parse(calls[1].messages[1].content);
  assert.equal(finalCheck.actualDocument.blocks[0].content, blocks[0].content);
});

test('text-only letters do not acquire a hero, footer, image or default button', async () => {
  const blocks = [block('text', 'Анна, добрый день!'), block('text', 'Спасибо за встречу. Напишите, когда удобно созвониться.')];
  const { server } = await serverWith([design(blocks), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Личное письмо Анне. Только обычный текст, без заголовка, подписи, кнопок и иллюстраций.' });
  assert.deepEqual(Array.from(result.suggestion.document.blocks, (b) => b.type), ['text', 'text']);
});

test('two specified buttons retain distinct labels and destinations', async () => {
  const blocks = [block('heading', 'Приглашение'), block('button', 'записаться', { href: 'https://example.org/register' }), block('button', 'смотреть программу', { href: 'https://example.org/program' })];
  const { server } = await serverWith([design(blocks), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Две кнопки: «записаться» https://example.org/register и «смотреть программу» https://example.org/program. Без иллюстраций.' });
  const buttons = result.suggestion.document.blocks.filter((b) => b.type === 'button');
  assert.deepEqual(Array.from(buttons, (b) => [b.content, b.href]), [['записаться', 'https://example.org/register'], ['смотреть программу', 'https://example.org/program']]);
});

test('semantic review catches a lost condition and checks the repaired visible document again', async () => {
  const problem = 'В запросе указано участие только по приглашению, но в письме это условие отсутствует.';
  const { server, calls } = await serverWith([design([block('text', 'Приходите на встречу.')]), { issues: [problem] }, design([block('text', 'Приходите на встречу. Участие только по приглашению.')]), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Приглашение на встречу. Обязательно укажи: участие только по приглашению. Без изображений.' });
  assert.match(result.suggestion.document.blocks[0].content, /только по приглашению/);
  assert.equal(calls.length, 4);
  assert.ok(JSON.parse(calls[2].messages[1].content).qualityIssues.includes(problem));
  assert.match(JSON.parse(calls[3].messages[1].content).actualDocument.blocks[0].content, /только по приглашению/);
});

test('a repeatedly noncompliant letter is not returned as a successful result', async () => {
  const wrong = design([block('text', 'Приходите на встречу.')]);
  const { server } = await serverWith([wrong, { issues: ['Не указан срок 18 сентября.'] }, wrong, { issues: ['Не указан срок 18 сентября.'] }]);
  await assert.rejects(server.generateEmailSuggestion(request(), { ...base, goal: 'Приглашение. Записаться до 18 сентября.' }), (error) => error.status === 422 && /18 сентября/.test(error.message));
});

test('a failed review cannot silently approve an unchecked letter', async () => {
  const { server } = await serverWith([design([block('text', 'Встреча завтра.')]), { unrelated: true }]);
  await assert.rejects(server.generateEmailSuggestion(request(), base), /Не удалось проверить письмо/);
});

test('replacing a time does not reintroduce the old time from the instruction', async () => {
  const { server } = await serverWith([design([block('text', 'Встреча начнётся в 20:00.')]), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Письмо о встрече. Замени прежнее время 19:00 на 20:00. Старое время не упоминай.' });
  assert.equal(result.suggestion.document.blocks[0].content, 'Встреча начнётся в 20:00.');
});

test('uploaded images keep their order and are not regenerated or moved under an injected hero', async () => {
  const assets = [{ id: 'photo-a', filename: 'Первое фото', kind: 'photo', url: 'https://evaluation.example/api/assets/a' }, { id: 'photo-b', filename: 'Второе фото', kind: 'photo', url: 'https://evaluation.example/api/assets/b' }];
  const blocks = [block('image', 'Первое фото', { assetId: 'photo-a', imagePrompt: 'Should not generate' }), block('image', 'Второе фото', { assetId: 'photo-b', imagePrompt: 'Should not generate' }), block('text', 'Два варианта оформления.')];
  const { server, calls } = await serverWith([design(blocks), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Две загруженные фотографии в указанном порядке. Под ними текст. Без заголовка.', availableAssets: assets });
  assert.deepEqual(Array.from(result.suggestion.document.blocks, (b) => b.type), ['image', 'image', 'text']);
  assert.deepEqual(Array.from(result.suggestion.document.blocks.slice(0, 2), (b) => b.href), assets.map((a) => a.url));
  assert.equal(calls.length, 2);
});

test('adapting a one-section template does not discard additional requested paragraphs', async () => {
  const compiler = await loadAiServer('lib/server/email-document.ts');
  const reference = compiler.parseEmailBuilderDocument({ templateId: 'old', previewText: '', contentWidth: 620, subject: 'Прежняя тема', accentColor: '#333333', bodyBackground: '#FFFFFF', workspaceBackground: '#FFFFFF', blocks: [block('text', 'Прежнее содержимое', {id: 'old-block', fontSize: 16, borderRadius: 0})] });
  const blocks = [block('text', 'Первый раздел.'), block('text', 'Второй раздел.'), block('text', 'Третий раздел.')];
  const { server } = await serverWith([design(blocks), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Адаптируй шаблон: три раздела в указанном порядке.', creativeSource: 'library', templateReference: { id: 'test-template', name: 'Текстовый', category: 'news', description: '', isStarter: false, document: reference } });
  assert.equal(result.suggestion.document.templateId, 'test-template');
  assert.deepEqual(Array.from(result.suggestion.document.blocks, (b) => b.content), blocks.map((b) => b.content));
});

test('provider shorthand for a gold divider and nested padding is preserved, not replaced with theme defaults', async () => {
  const { server, calls } = await serverWith([design([{ type: 'divider', color: '#D4AF37', padding: { top: 24, bottom: 24, left: 32 } }, block('text', 'Письмо без изменений.')]), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { ...base, goal: 'Тонкая золотая линия. Под ней текст: «Письмо без изменений». Белый фон.' });
  const divider = result.suggestion.document.blocks[0];
  assert.equal(divider.textColor.toUpperCase(), '#D4AF37');
  assert.equal(divider.paddingLeft, 32);
  assert.equal(divider.paddingTop, 24);
  const rendered = JSON.parse(calls[1].messages[1].content).renderedBlocks[0];
  assert.equal(rendered.lineColor.toUpperCase(), '#D4AF37');
});
