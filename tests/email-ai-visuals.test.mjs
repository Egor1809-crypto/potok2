import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadAiServer } from './helpers/ai-server-harness.mjs';

const goal = 'Нужно сделать пригласительно письмо для абитуриентов на первое ознакомительное собрание';
const request = () => new Request('https://evaluation.example/api/ai/email-assistant');
const block = (type, content = '', extra = {}) => ({ type, content, backgroundColor: '#FFFFFF', textColor: '#172A38', paddingTop: 12, paddingBottom: 12, paddingLeft: 32, ...extra });
const draft = (media = []) => ({ subject: 'Первое знакомство', previewText: 'Приглашение абитуриентам', body: 'Приглашаем на ознакомительное собрание.', cta: 'Ответить', design: { accentColor: '#24736A', bodyBackground: '#FFFFFF', workspaceBackground: '#F3F0E9', blocks: [block('heading', 'Первое знакомство'), ...media, block('text', 'Приглашаем на ознакомительное собрание.', { backgroundColor: '#E5F1ED' })] } });
const image = () => block('image', '', { imagePrompt: 'Editorial illustration of applicants learning together, open books, teal #24736A and amber palette. No text.' });
const pattern = () => block('pattern', '', { imagePrompt: 'A small geometric rhythm of open pages in teal #24736A and amber on cream, flat ornament, no text.' });
const response = (value) => Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });

async function serverWith(replies, { imageFailure = false, networkFailure = false } = {}) {
  const calls = []; const saved = [];
  const server = await loadAiServer('lib/server/email-ai.ts', {
    env: { NAVYAI_API_KEY: 'test-key' }, expose: ['emailVisualIntent', 'parseSuggestion', 'generateDesignImages'],
    fetch: async (url, init) => {
      const payload = JSON.parse(init.body); calls.push({ url: String(url), payload });
      if (networkFailure && calls.length === 1) throw new Error('Provider connection timed out');
      if (String(url).endsWith('/images/generations')) return imageFailure ? Response.json({ error: 'Unavailable' }, { status: 503 }) : Response.json({ data: [{ b64_json: btoa('image-bytes'.repeat(20)) }] });
      assert.ok(replies.length, 'Unexpected text request');
      return response(replies.shift());
    },
    assetStore: {
      storeGeneratedEmailAsset: async () => { throw new Error('Unexpected URL output'); },
      storeGeneratedEmailAssetBytes: async (_request, bytes, mime, kind, filename) => {
        saved.push({ size: bytes.length, mime, kind, filename });
        return { url: `https://evaluation.example/api/assets/saved-${saved.length}` };
      },
    },
  });
  return { server, calls, saved };
}

test('the exact institute prompt defaults to topical imagery, with no requirement imposed on personal text or targeted edits', async () => {
  const { server } = await serverWith([]);
  assert.equal(server.emailVisualIntent({ action: 'design', goal }).requireImage, true);
  for (const text of ['Личное письмо Анне: приглашение на собрание.', 'Приглашение, только обычный текст.', 'Приглашение. Без изображений.', 'Письмо о встрече. Замени время 19:00 на 20:00.']) {
    assert.equal(server.emailVisualIntent({ action: 'design', goal: text }).requireImage, false, text);
  }
  assert.equal(server.emailVisualIntent({ action: 'design', goal, imageSource: 'none' }).requireImage, false);
});

test('empty image alt and decorative content survive parsing, generate actual assets, and retain chosen colors', async () => {
  const { server, calls, saved } = await serverWith([draft([image(), pattern()]), { issues: [] }]);
  const { suggestion } = await server.generateEmailSuggestion(request(), { action: 'design', goal, useLinkedContext: false });
  const media = suggestion.document.blocks.filter(b => ['image', 'pattern'].includes(b.type));
  assert.equal(media.length, 2);
  assert.equal(saved.length, 2);
  assert.ok(media.every(b => b.href.startsWith('https://evaluation.example/api/assets/saved-')));
  assert.equal(media[0].content, 'Первое знакомство');
  assert.equal(media[1].content, '');
  assert.equal(suggestion.document.accentColor.toUpperCase(), '#24736A');
  assert.equal(suggestion.document.bodyBackground.toUpperCase(), '#FFFFFF');
  assert.ok(suggestion.document.blocks.some(b => b.backgroundColor.toUpperCase() === '#E5F1ED'));
  assert.ok(calls.filter(c => c.url.endsWith('/images/generations')).every(c => c.payload.prompt.includes('#24736A')));
  assert.equal(JSON.parse(calls[0].payload.messages[1].content).visualIntent.requireImage, true);
  const compiler = await loadAiServer('lib/server/email-document.ts');
  assert.doesNotMatch(JSON.stringify(compiler.compileEmailDocument(suggestion.document)), /placehold\.co/);
});

test('a bland auto invitation is repaired before generating its image', async () => {
  const { server, calls, saved } = await serverWith([draft(), { issues: [] }, draft([image()]), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { action: 'design', goal, useLinkedContext: false });
  assert.equal(saved.length, 1);
  assert.match(JSON.parse(calls[2].payload.messages[1].content).qualityIssues[0], /тематическое изображение/);
  assert.ok(result.suggestion.document.blocks.some(b => b.type === 'image'));
});

test('text-only overrides both an unsolicited photo and a pattern without calling the image API', async () => {
  const { server, saved } = await serverWith([draft([image(), pattern()]), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { action: 'design', goal: `${goal}. Только обычный текст.`, useLinkedContext: false });
  assert.equal(saved.length, 0);
  assert.ok(result.suggestion.document.blocks.every(b => !['image', 'pattern'].includes(b.type)));
  assert.doesNotMatch(result.suggestion.artDirection, /и тематическое изображение|Уникальный орнамент/);
});

test('an explicitly requested ornament works with photo generation disabled', async () => {
  const { server, saved } = await serverWith([draft([pattern()]), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { action: 'design', goal, visualContent: 'pattern', imageSource: 'none', useLinkedContext: false });
  assert.equal(saved.length, 1);
  assert.ok(result.suggestion.document.blocks.some(b => b.type === 'pattern' && b.href.includes('/api/assets/')));
});

test('failed original or library visuals cannot silently become a successful text-only design', async () => {
  const { server } = await serverWith([], { imageFailure: true });
  for (const creationMode of ['original', 'library']) {
    const suggestion = server.parseSuggestion(JSON.stringify(draft([image()])), { action: 'design', goal });
    suggestion.creationMode = creationMode;
    await assert.rejects(server.generateDesignImages(request(), { key: 'test-key', imageEndpoint: 'https://test.example/images/generations', imageModel: 'test-model' }, suggestion), error => error.status === 502);
  }
});

test('real institute response preserves patternPrompt, image alt, nested art direction and heading size', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/ai-design/email-institute.json', import.meta.url), 'utf8'));
  const { server } = await serverWith([]);
  const suggestion = server.parseSuggestion(fixture.providerText, fixture.input);
  assert.equal(suggestion.imagePrompts.length, 2);
  assert.deepEqual(Array.from(suggestion.imagePrompts, p => p.kind), ['photo', 'pattern']);
  assert.match(suggestion.imagePrompts[1].prompt, /контуров раскрытых страниц/);
  assert.equal(suggestion.document.blocks[0].content, 'Абитуриенты знакомятся с учебной средой');
  assert.equal(suggestion.document.blocks.find(b => b.type === 'heading').fontSize, 32);
  assert.match(suggestion.artDirection, /терракотовая деталь/);
});

test('a malformed text response retries on the configured fallback and reviews the resulting document', async () => {
  const { server, calls } = await serverWith(['Bare text instead of the document', draft(), { issues: [] }]);
  const result = await server.generateEmailSuggestion(request(), { action: 'design', goal: 'Только обычный текст письма клиенту.', useLinkedContext: false });
  assert.ok(result.suggestion.document);
  assert.equal(calls[1].payload.model, 'gpt-5.6-terra');
  assert.equal(calls[2].payload.model, 'gpt-5.6-terra');
});

test('a network timeout also uses the fallback instead of discarding the generation immediately', async () => {
  const { server, calls } = await serverWith([draft(), { issues: [] }], { networkFailure: true });
  const result = await server.generateEmailSuggestion(request(), { action: 'design', goal: 'Только обычный текст письма клиенту.', useLinkedContext: false });
  assert.ok(result.suggestion.document);
  assert.equal(calls[1].payload.model, 'gpt-5.6-terra');
  assert.equal(calls[2].payload.model, 'gpt-5.6-terra');
});
