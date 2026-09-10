/** Shared by generation and export so the chosen palette remains readable. */
export function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  if (!/^#[\da-f]{6}$/i.test(foreground) || !/^#[\da-f]{6}$/i.test(background)) return 1;
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function readableColor(preferred: string, background: string, minimum = 4.5) {
  if (contrastRatio(preferred, background) >= minimum) return preferred;
  return contrastRatio("#17191C", background) >= contrastRatio("#FFFFFF", background) ? "#17191C" : "#FFFFFF";
}

/** Conservative font fit estimate. Never changes or truncates the content. */
export function estimatedTextLines(text: string, width: number, fontSize: number) {
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    let used = 0;
    lines += 1;
    for (const word of paragraph.split(/\s+/)) {
      const wordWidth = [...word].reduce((sum, character) => sum + (/[ilI1.,:;'!|]/.test(character) ? 0.28 : /[MWЖШЩЮФ@]/.test(character) ? 0.86 : /[A-ZА-ЯЁ]/.test(character) ? 0.67 : 0.54) * fontSize, 0);
      if (used && used + fontSize * 0.28 + wordWidth > width) { lines++; used = 0; }
      if (wordWidth > width) { lines += Math.ceil(wordWidth / width) - 1; used = wordWidth % width; }
      else used += (used ? fontSize * 0.28 : 0) + wordWidth;
    }
  }
  return lines;
}
