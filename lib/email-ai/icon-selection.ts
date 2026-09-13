import { colorEmailIcons, emailIcons } from "../email-icons";
import { runeEmailIcons } from "../runeicons";

/** Keep the brief readable to the model instead of sending the entire asset catalog. */
export function selectEmailIcons(text: string, retainedIds: string[] = []) {
  const normalize = (value: string) => value.toLocaleLowerCase("ru").replaceAll("ё", "е");
  const words = [...new Set(normalize(text).match(/[\p{L}\d]+/gu) ?? [])].filter(word => word.length >= 3 && !["для", "письмо", "письма", "значки", "значков", "runeicons", "pixel", "пиксельные"].includes(word));
  // Interleave collections so a generic brief still offers both visual styles.
  const ordered = runeEmailIcons.flatMap((icon, index) => colorEmailIcons[index] ? [icon, colorEmailIcons[index]] : [icon]);
  const score = (icon: typeof emailIcons[number]) => {
    const name = normalize(icon.name), keywords = normalize(icon.keywords);
    return words.reduce((total, word) => {
      const stem = word.length > 5 ? word.slice(0, -2) : word;
      return total + (name.includes(stem) ? 6 : keywords.includes(stem) ? 1 : 0);
    }, 0);
  };
  const retained = new Set(retainedIds);
  const selected = ordered.sort((a, b) => score(b) - score(a)).slice(0, 32);
  return [...emailIcons.filter(icon => retained.has(icon.id)), ...selected.filter(icon => !retained.has(icon.id))];
}
