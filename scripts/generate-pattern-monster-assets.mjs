import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import sharp from "sharp";

const source =
  "https://raw.githubusercontent.com/catchspider2002/svelte-svg-patterns/master/src/routes/_index.js";
const slugs = [
  "waves-1", "waves-4", "japanese-pattern-5", "chevron-2",
  "herringbone-1", "herringbone-3", "flower-1", "flower-3",
  "flower-5", "leaves-2", "leaves-5", "circles-1", "circles-4",
  "circles-7", "concentric-circles-2", "checkerboard", "greek-key",
  "cubes-1", "stained-glass", "tiles-1", "batik-2", "batik-4",
  "stripes-1", "squares-1", "interlocked-hexagons-1", "lanterns-1",
  "lines-4", "scales-2", "memphis-1", "memphis-3", "stars-1",
  "stars-4", "plaid-pattern-1", "diamonds-2", "hexagon-2", "triangles-1",
  "waves-2", "waves-6", "herringbone-4", "flower-2", "flower-7",
  "plus-3", "circles-3", "diamonds-1", "hexagon-4",
  "squares-and-circles-2", "stars-and-lines-1", "triangles-4",
  "japanese-pattern-2", "jigsaw", "octagons-1", "railroad", "leaves-3",
  "pipes", "memphis-5", "geometric-2", "squiggle-1", "moroccan-1",
  "interlocked-hexagons-2", "scales-5",
];
const palettes = [
  ["#FBF7F0", "#A64545", "#D8A68C", "#253146", "#E9DCC9"],
  ["#F5F8FF", "#3157D5", "#88A5EF", "#172033", "#DCE6FF"],
  ["#12110F", "#C6A15B", "#665535", "#F8F2E7", "#2A251C"],
  ["#F4FBF8", "#25735D", "#75A995", "#173129", "#DDEEE7"],
  ["#FFF7FB", "#D64F87", "#6A8AD8", "#2C1822", "#F3D8E6"],
  ["#101525", "#8B5CF6", "#24C8B8", "#F5F3FF", "#27304A"],
  ["#FFF9F1", "#D86342", "#F1B65A", "#2D1D18", "#F7E0D3"],
  ["#F8F6F1", "#2D3341", "#A23D2B", "#171A21", "#DED9CE"],
];

const raw = await (await fetch(source)).text();
const match = raw.match(/^const index = (\[[\s\S]*\]); export default index;\s*$/);
if (!match) throw new Error("Pattern Monster index format changed");
const patterns = JSON.parse(match[1]);
const output = path.join(process.cwd(), "public", "email-patterns");
await mkdir(output, { recursive: true });

for (const [index, slug] of slugs.entries()) {
  const pattern = patterns.find((item) => item.slug === slug);
  if (!pattern) throw new Error(`Missing Pattern Monster pattern: ${slug}`);
  const [background, ...colors] = palettes[index % palettes.length];
  const paths = pattern.path.split("~");
  const tileScale = pattern.width > 100 || pattern.height > 100 ? 1.25 : 2.1;
  const tileWidth = Math.max(20, Number(pattern.width) * tileScale);
  const tileHeight = Math.max(20, Number(pattern.height) * tileScale);
  const artwork = paths
    .map((item, pathIndex) => {
      const color = colors[pathIndex % colors.length];
      if (pattern.mode.startsWith("stroke")) {
        return item.replace(
          /<path /g,
          `<path fill="none" stroke="${color}" stroke-width="${pattern.mode === "stroke-join" ? 1.6 : 1.25}" stroke-linecap="round" stroke-linejoin="round" `,
        );
      }
      return item.replace(/<path /g, `<path fill="${color}" `);
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360"><defs><pattern id="p" width="${tileWidth}" height="${tileHeight}" patternUnits="userSpaceOnUse" viewBox="0 0 ${pattern.width} ${pattern.height}">${artwork}</pattern><linearGradient id="fade" x1="0" x2="1"><stop stop-color="${background}" stop-opacity=".08"/><stop offset=".52" stop-color="${background}" stop-opacity="0"/><stop offset="1" stop-color="${background}" stop-opacity=".28"/></linearGradient></defs><rect width="1200" height="360" fill="${background}"/><rect width="1200" height="360" fill="url(#p)" opacity=".82"/><rect width="1200" height="360" fill="url(#fade)"/></svg>`;
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 88, chromaSubsampling: "4:4:4" })
    .toFile(path.join(output, `pattern-monster-${slug}.jpg`));
}

await writeFile(
  path.join(output, "PATTERN-MONSTER-LICENSE.txt"),
  "Pattern artwork is derived from Pattern Monster (https://pattern.monster/).\nMIT License. Copyright (c) 2020-2023 pattern.monster.\nSee https://github.com/catchspider2002/svelte-svg-patterns/blob/master/LICENSE.md\n",
);

console.log(`Generated ${slugs.length} Pattern Monster email assets.`);
