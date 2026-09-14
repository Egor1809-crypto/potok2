import type { PresentationCanvas, PresentationElement } from "@/types/api";

export type Alignment =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";
export function alignElement(
  e: PresentationElement,
  c: PresentationCanvas,
  alignment: Alignment,
): PresentationElement {
  if (e.locked) return e;
  const offsets = {
    left: { x: 0 },
    center: { x: (c.width - e.width) / 2 },
    right: { x: c.width - e.width },
    top: { y: 0 },
    middle: { y: (c.height - e.height) / 2 },
    bottom: { y: c.height - e.height },
  };
  return { ...e, ...offsets[alignment] };
}
export function transformElement(
  e: PresentationElement,
  dx: number,
  dy: number,
  resize: boolean,
  keepRatio: boolean,
): PresentationElement {
  if (e.locked) return e;
  if (!resize)
    return {
      ...e,
      x: Math.max(-10000, Math.min(10000, e.x + dx)),
      y: Math.max(-10000, Math.min(10000, e.y + dy)),
    };
  const angle = ((e.rotation || 0) * Math.PI) / 180;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle),
    localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  let width = Math.max(4, Math.min(10000, e.width + localX)),
    height = Math.max(4, Math.min(10000, e.height + localY));
  if (keepRatio) {
    const scale = Math.max(
      4 / e.width,
      4 / e.height,
      Math.min(
        10000 / e.width,
        10000 / e.height,
        Math.abs(localX / e.width) >= Math.abs(localY / e.height)
          ? width / e.width
          : height / e.height,
      ),
    );
    width = e.width * scale;
    height = e.height * scale;
  }
  // Keep the rotated top-left corner fixed while resizing around CSS's center origin.
  const dw = width - e.width,
    dh = height - e.height;
  return {
    ...e,
    width,
    height,
    x: e.x + (dw * Math.cos(angle) - dh * Math.sin(angle) - dw) / 2,
    y: e.y + (dw * Math.sin(angle) + dh * Math.cos(angle) - dh) / 2,
  };
}
export function reorderElement(
  elements: PresentationElement[],
  id: string,
  move: "front" | "back" | "forward" | "backward",
) {
  const from = elements.findIndex((e) => e.id === id);
  if (from < 0 || elements[from].locked) return elements;
  const to =
    move === "front"
      ? elements.length - 1
      : move === "back"
        ? 0
        : Math.max(
            0,
            Math.min(elements.length - 1, from + (move === "forward" ? 1 : -1)),
          );
  const copy = [...elements],
    [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
