import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("brief conference invitation uses three sales-focused sentences and is seeded", async () => {
  const [{ conferenceBriefTemplates }, templates, database] = await Promise.all([
    import("../data/conference-brief-template.ts"),
    readFile(new URL("../data/templates.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/database-init.ts", import.meta.url), "utf8"),
  ]);
  const [template] = conferenceBriefTemplates;
  assert.ok(template);
  assert.equal(template.id, "template-v14-conference-brief-invitation");
  assert.match(templates, /\.\.\.conferenceBriefTemplates/);
  assert.match(database, /email-template-library-v19-conference-brief-brand-pink-stats/);
  assert.match(database, /runtime-schema-v29-conference-brief-favorite/);

  const [logo, heroImage] = template.blocks;
  assert.equal(logo.type, "logo");
  assert.match(logo.href ?? "", /conference-series\/tech-pravo-logo-transparent-v2\.png$/);
  assert.equal(heroImage.type, "image");
  assert.match(heroImage.href ?? "", /conference-series\/conference-04-business-roi-hero-v2\.png$/);
  assert.equal(heroImage.borderRadius, 12);
  assert.equal(heroImage.paddingLeft, 20);
  assert.equal(heroImage.paddingRight, 20);

  const copy = template.blocks
    .filter((block) => block.type === "text")
    .map((block) => block.content)
    .join(" ");
  assert.match(`${template.previewText} ${copy}`, /30\+ спикеров/);
  assert.doesNotMatch(`${template.previewText} ${copy}`, /80\+ спикеров/);
  assert.equal(
    template.blocks.find((block) => block.type === "stats")?.borderColor,
    "#FF3B94",
  );
  const sentences = copy.match(/[^.!?]+[.!?]+/g) ?? [];
  assert.equal(sentences.length, 3);
  assert.equal(
    template.blocks.find((block) => block.type === "button")?.href,
    "https://tech-pravo.ru/conference",
  );
});
