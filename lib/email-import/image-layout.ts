import { clearLetterImageClipping, editLetterAttribute, editLetterStyle, letterElements } from "./visual-editor";

/** Preserve the image's natural aspect ratio when its source or crop changes. */
export function fitLetterImage(html: string, index: number) {
  let next = clearLetterImageClipping(html, index);
  next = editLetterAttribute(next, index, "height", null);
  return editLetterStyle(next, index, {
    height: "auto !important", "min-height": "0 !important", "max-height": "none !important", "max-width": "100%",
    "object-fit": "contain", "object-position": "center", "aspect-ratio": "auto",
    position: "static", transform: "none", "clip-path": "none",
  });
}
export function replaceLetterImage(html: string, index: number, url: string, name?: string) {
  let next = editLetterAttribute(html, index, "src", url);
  for (const attr of ["srcset", "data-potok-original-src", "data-potok-crop"] as const) next = editLetterAttribute(next, index, attr, null);
  if (name !== undefined) next = editLetterAttribute(next, index, "alt", name);
  return fitLetterImage(next, index);
}
export function cropLetterImage(html: string, index: number, url: string, crop: string) {
  const item = letterElements(html)[index];
  if (!item || item.kind !== "image") throw new Error("Выберите изображение.");
  let next = editLetterAttribute(html, index, "src", url);
  next = editLetterAttribute(next, index, "srcset", null);
  next = editLetterAttribute(next, index, "data-potok-original-src", item.attributes["data-potok-original-src"] || item.attributes.src);
  next = editLetterAttribute(next, index, "data-potok-crop", crop);
  return fitLetterImage(next, index);
}
export function restoreLetterImage(html: string, index: number) {
  const item = letterElements(html)[index];
  return item?.attributes["data-potok-original-src"] ? replaceLetterImage(html, index, item.attributes["data-potok-original-src"]) : fitLetterImage(html, index);
}
export function sizeLetterImage(html: string, index: number, width: number | null) {
  let next = editLetterAttribute(html, index, "width", width ? String(Math.round(width)) : null);
  next = fitLetterImage(next, index);
  return editLetterStyle(next, index, { width: width ? `${Math.round(width)}px` : "auto" });
}
export function alignLetterImage(html: string, index: number, alignment: string) {
  if (!["left", "center", "right"].includes(alignment)) throw new Error("Выберите выравнивание.");
  const next = editLetterAttribute(clearLetterImageClipping(html, index, true), index, "align", alignment);
  return editLetterStyle(next, index, { display: "block", "margin-left": alignment === "left" ? "0" : "auto", "margin-right": alignment === "right" ? "0" : "auto", float: "none", position: "static", transform: "none" });
}
