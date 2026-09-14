import assert from 'node:assert/strict';
import test from 'node:test';
import { alignElement, transformElement, reorderElement } from '../lib/presentation-import/editor.ts';
import { parseDeckDirection, slideFingerprint } from '../lib/presentation-import/review.ts';
const image = { id: 'photo', kind: 'image', x: 100, y: 80, width: 400, height: 200, imageUrl: '/api/assets/photo', href: 'https://example.org' };
test('image resize preserves aspect ratio and rotated anchor', () => {
  const resized = transformElement(image, 100, 10, true, true);
  assert.equal(resized.width / resized.height, 2); assert.equal(resized.imageUrl, image.imageUrl); assert.equal(resized.href, image.href);
  const rotated = { ...image, rotation: 90 }, next = transformElement(rotated, -50, 100, true, true);
  const corner = e => ({ x: e.x + e.width / 2 + e.height / 2, y: e.y + e.height / 2 - e.width / 2 });
  assert.deepEqual(corner(next), corner(rotated)); assert.equal(next.width / next.height, 2);
  const tiny = transformElement(image, -10000, -10000, true, true); assert.ok(tiny.width >= 4 && tiny.height >= 4);
});
test('alignment and layer operations preserve content and locked objects', () => {
  assert.equal(alignElement(image, { width: 1200, height: 720 }, 'center').x, 400);
  const locked = { ...image, locked: true }; assert.deepEqual(transformElement(locked, 100, 0, false, false), locked);
  assert.deepEqual(alignElement(locked, { width: 1200, height: 720 }, 'left'), locked);
  const elements = [image, { ...image, id: 'other' }];
  assert.deepEqual(reorderElement(elements, 'photo', 'front').map(e => e.id), ['other', 'photo']);
  assert.deepEqual(elements.map(e => e.id), ['photo', 'other']);
});
test('deck recommendations reject nonexistent or duplicate slide references', () => {
  const report = { summary: 'Общая структура', recommendations: [{ text: 'Согласуйте заголовки', slides: [1, 2] }] };
  assert.deepEqual(parseDeckDirection(report, 2), report);
  for (const slides of [[0], [3], [1, 1], [1.5]]) assert.throws(() => parseDeckDirection({ ...report, recommendations: [{ text: 'Правка', slides }] }, 2));
});
test('review fingerprints invalidate changed content and theme, not a save timestamp', () => {
  const p = { themeId: 'base', accentColor: '#ffffff', updatedAt: 'before' }, s = { id: 'a', title: 'Текст', canvas: { elements: [image] } };
  assert.equal(slideFingerprint(p, s), slideFingerprint({ ...p, updatedAt: 'after' }, s));
  assert.notEqual(slideFingerprint(p, s), slideFingerprint(p, { ...s, title: 'Изменён' }));
  assert.notEqual(slideFingerprint(p, s), slideFingerprint({ ...p, accentColor: '#000000' }, s));
});
