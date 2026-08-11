import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("expanded starter library contains varied production templates", async () => {
  const source = await readFile(new URL("../data/templates.ts", import.meta.url), "utf8");
  assert.ok((source.match(/\bid:\s*"template-/g) ?? []).length >= 16);
  for (const type of ["hero", "quote", "checklist", "stats", "product", "signature"]) assert.match(source, new RegExp(`type: "${type}"`));
});

test("new editor blocks have server-side email compilation", async () => {
  const source = await readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8");
  for (const type of ["hero", "quote", "checklist", "stats", "product"]) assert.match(source, new RegExp(`block\\.type === "${type}"`));
  assert.match(source, /<table role="presentation"/);
  assert.match(source, /escapeHtml\(block\.href/);
});

test("uploaded logos are compiled as real images", async () => {
  const source = await readFile(new URL("../lib/server/email-document.ts", import.meta.url), "utf8");
  assert.match(source, /block\.type === "logo" && block\.href/);
  assert.match(source, /max-width:220px/);
});
