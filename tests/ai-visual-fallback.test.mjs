import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  findPublicDomainImageCandidates,
  publicDomainImageQuery,
} from "../lib/public-domain-images.ts";

test("public-domain visual fallback converts common briefs into useful image searches", () => {
  assert.equal(
    publicDomainImageQuery("Приглашение на романтический ужин в ресторане"),
    "romantic restaurant",
  );
  assert.equal(
    publicDomainImageQuery("Презентация про ИИ и защиту данных"),
    "technology network",
  );
  assert.equal(
    publicDomainImageQuery("Новый проект устойчивой архитектуры"),
    "nature botanical",
  );
});

test("Openverse fallback accepts only wide CC0 or public-domain images", async () => {
  let requestedUrl = "";
  const candidates = await findPublicDomainImageCandidates(
    "Юридическая конференция",
    new Set(["https://images.example/used.jpg"]),
    async (input) => {
      requestedUrl = String(input);
      return Response.json({
        results: [
          {
            url: "https://images.example/by.jpg",
            license: "by",
            width: 1600,
            height: 1000,
          },
          {
            url: "https://images.example/used.jpg",
            license: "cc0",
            width: 1600,
            height: 1000,
          },
          {
            url: "https://images.example/small.jpg",
            license: "pdm",
            width: 640,
            height: 420,
          },
          {
            url: "https://images.example/public-domain.jpg",
            license: "pdm",
            width: 1800,
            height: 1200,
            attribution: "Public domain",
          },
        ],
      });
    },
  );
  assert.match(requestedUrl, /license=cc0%2Cpdm/);
  assert.match(requestedUrl, /aspect_ratio=wide/);
  assert.deepEqual(candidates, [
    {
      url: "https://images.example/public-domain.jpg",
      attribution: "Public domain",
      license: "pdm",
      width: 1800,
      height: 1200,
    },
  ]);
});

test("both AI constructors persist a thematic fallback when image generation fails", async () => {
  const [presentation, email, store] = await Promise.all([
    readFile(
      new URL("../lib/server/presentation-ai.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../lib/server/email-ai.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../lib/server/public-domain-image-store.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(presentation, /storePublicDomainFallbackImage/);
  assert.match(presentation, /slide\.imageUrl = fallback\.url/);
  assert.match(email, /storePublicDomainFallbackImage/);
  assert.match(email, /block\.href = fallback\.url/);
  assert.match(store, /candidates\.slice\(0, 6\)/);
  assert.match(store, /storeGeneratedEmailAsset/);
});
