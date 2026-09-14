import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePresentationCanvas } from '../lib/presentation-import/model.ts';
import { applySlideDirection } from '../lib/presentation-import/direction.ts';
const canvas = { width: 960, height: 540, source: 'pptx', elements: [{ id: 'a', kind: 'text', text: '42 участника', x: 40, y: 60, width: 300, height: 60, fontSize: 24 }, { id: 'b', kind: 'image', imageUrl: '/api/assets/asset-test', x: 400, y: 60, width: 400, height: 300, fit: 'contain', href: 'https://example.org/ticket' }] };
const slide = { id: 'slide-1', title: 'Обзор', layout: 'statement', body: '', eyebrow: '', bullets: [], speakerNotes: '', canvas };
test('imported canvas round trip preserves text, geometry, images and links', () => {
  assert.deepEqual(parsePresentationCanvas(JSON.parse(JSON.stringify(canvas))), canvas);
});
test('canvas rejects transient/external URLs, invalid geometry and duplicate IDs', () => {
  for (const change of [{ imageUrl: 'blob:temp' }, { imageUrl: 'https://example.org/spy.png' }, { x: Infinity }, { width: -1 }, { href: 'javascript:alert(1)' }, { id: 'a' }, { crop: { left: .6, right: .5, top: 0, bottom: 0 } }]) {
    assert.throws(() => parsePresentationCanvas({ ...canvas, elements: [canvas.elements[0], { ...canvas.elements[1], ...change }] }));
  }
});
test('director only changes named fields and never mutates original', () => {
  const next = applySlideDirection(slide, { summary: '', findings: [], patches: [{ target: 'a', field: 'fontSize', value: '30' }, { target: 'b', field: 'y', value: '80' }] });
  assert.equal(next.canvas.elements[0].fontSize, 30); assert.equal(slide.canvas.elements[0].fontSize, 24);
  assert.equal(next.canvas.elements[1].href, canvas.elements[1].href);
  assert.equal(next.canvas.elements[1].imageUrl, canvas.elements[1].imageUrl);
  assert.deepEqual(next.canvas.elements.map(e => e.id), ['a','b']);
});
test('director rejects unknown IDs, image replacement and changes to hidden PDF text', () => {
  for (const patch of [{ target: 'missing', field: 'text', value: 'x' }, { target: 'b', field: 'imageUrl', value: '/api/assets/other' }, { target: 'slide', field: 'body', value: 'Rebuilt' }, { target: 'a', field: 'width', value: '-10' }]) assert.throws(() => applySlideDirection(slide, { summary: '', findings: [], patches: [patch] }));
});
