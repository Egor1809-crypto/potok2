import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhotoDirection } from '../lib/photo-direction.ts';

test('photo review accepts a clean image without inventing issues', () => {
  const report = { summary: 'Композиция читается.', findings: [], recommendations: ['Оставить свободное поле для заголовка.'] };
  assert.deepEqual(parsePhotoDirection(report), report);
});
test('photo review rejects malformed, blank and oversized provider output', () => {
  const report = { summary: 'Разбор.', findings: [], recommendations: [] };
  for (const value of [null, {}, { ...report, summary: ' ' }, { ...report, findings: [''] }, { ...report, findings: [42] }, { ...report, recommendations: Array(9).fill('Совет') }, { ...report, recommendations: ['a'.repeat(2001)] }]) assert.throws(() => parsePhotoDirection(value));
});
