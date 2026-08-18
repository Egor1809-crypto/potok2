import assert from "node:assert/strict";
import test from "node:test";

import { extractInlineEmailImages } from "../lib/server/inline-email-images.ts";

const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("inline data images become UniSender attachment filenames", () => {
  const source = `<img src="data:image/png;base64,${onePixelPng}" alt="Картинка">`;
  const prepared = extractInlineEmailImages(source, "filename");
  assert.equal(prepared.images.length, 1);
  assert.equal(prepared.images[0].filename, "mailflow-image-1.png");
  assert.ok(prepared.images[0].bytes.byteLength > 0);
  assert.match(prepared.html, /src="mailflow-image-1\.png"/);
  assert.doesNotMatch(prepared.html, /data:image/);
});

test("inline data images become CID references for SMTP", () => {
  const source = `<img src='data:image/png;base64,${onePixelPng}'>`;
  const prepared = extractInlineEmailImages(source, "cid");
  assert.equal(prepared.images.length, 1);
  assert.match(prepared.html, /src='cid:mailflow-image-1\.png@potok\.email'/);
  assert.equal(prepared.images[0].contentId, "mailflow-image-1.png@potok.email");
});
