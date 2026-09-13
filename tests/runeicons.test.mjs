import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { loadAiServer } from './helpers/ai-server-harness.mjs';

test('the complete pinned Runeicons pixel collection retains its original artwork, transparency and license', async () => {
  const { runeEmailIcons } = await loadAiServer('lib/runeicons.ts');
  const manifest = JSON.parse(await readFile('lib/runeicons.generated.json', 'utf8'));
  const source = JSON.parse(await readFile('vendor/runeicons/source.json', 'utf8'));
  const license = await readFile('vendor/runeicons/LICENSE', 'utf8');
  assert.equal(source.revision, 'f649e467d1bc9f272aae3f8daa329d4c924e7340');
  assert.equal(runeEmailIcons.length, 215);
  assert.equal(new Set(runeEmailIcons.map(icon => icon.id)).size, 215);
  assert.equal(new Set(runeEmailIcons.map(icon => icon.category)).size, 16);
  for (const entry of manifest) {
    const icon = runeEmailIcons.find(icon => icon.id === entry.id);
    assert.ok(icon.category && icon.name !== entry.basename, entry.id + ' translated name');
    const svg = await readFile(`vendor/runeicons/pixelated/${entry.folder}/${entry.basename}.svg`, 'utf8');
    const file = await readFile('public' + icon.path);
    assert.ok(file.includes(Buffer.from(license, 'latin1')), icon.id + ' license');
    assert.ok(file.includes(Buffer.from(source.revision)), icon.id + ' source attribution');
    const { data, info } = await sharp(file).raw().toBuffer({resolveWithObject: true});
    assert.equal(info.width, 192); assert.equal(info.height, 192); assert.equal(info.channels, 4);
    let drawn = 0, clear = 0;
    for (let i = 3; i < data.length; i += 4) { if (data[i]) drawn++; else clear++; }
    assert.ok(drawn > 50 && clear > 500, icon.id + ' visible transparent artwork');
    const expected = await sharp(Buffer.from(svg.replaceAll('fill="black"', 'fill="#7c35f2"'))).resize(192, 192, {fit: 'contain', background: '#00000000'}).raw().toBuffer();
    assert.deepEqual(data, expected, icon.id + ' preserves the original shapes');
  }
});

test('AI candidates cover relevant pixel icons and retain existing choices without flooding the brief', async () => {
  const { selectEmailIcons } = await loadAiServer('lib/email-ai/icon-selection.ts');
  const { aiEmailSchemasForIcons, validateEmailSchema, aiEmailBlockSchema } = await loadAiServer('lib/email-ai/schema.ts');
  const chosen = selectEmailIcons('Пиксельные Runeicons: замок, команда, диаграмма.');
  assert.ok(chosen.length <= 32);
  for(const id of ['rune-identity-lock','rune-identity-users','rune-metrics-chart-bar']) assert.ok(chosen.some(icon=>icon.id===id),id);
  assert.ok(selectEmailIcons('Кинохлопушка и микрофон').some(icon=>icon.id==='rune-playback-clapperboard'));
  const retained = selectEmailIcons('Команда', ['rune-nature-sunrise']);
  assert.ok(retained.some(icon=>icon.id==='rune-nature-sunrise'));
  const schema = aiEmailSchemasForIcons(chosen.map(icon=>icon.id)).block;
  const iconSchema = schema.properties.items.items.properties.iconId;
  for(const id of chosen.map(icon=>icon.id)) validateEmailSchema(id,iconSchema);
  assert.throws(()=>validateEmailSchema('rune-unknown',iconSchema));
  validateEmailSchema(null,aiEmailSchemasForIcons([]).block.properties.items.items.properties.iconId);
  assert.throws(()=>validateEmailSchema('rune-identity-lock',aiEmailSchemasForIcons([]).block.properties.items.items.properties.iconId));
  assert.ok(aiEmailBlockSchema.properties.items.items.properties.iconId.anyOf[0].enum.length===233,'request-specific schema never mutates the full saved-document validator');
});
