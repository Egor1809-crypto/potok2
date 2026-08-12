export type EmailPatternPreset = {
  id: string;
  name: string;
  content: string;
  fontSize: number;
  letterSpacing: number;
};

export const emailPatternPresets: EmailPatternPreset[] = [
  { id: "sparkles", name: "Искры", content: "✦  ·  ✧  ·  ✦  ·  ✧  ·  ✦\n·  ✧  ·  ✦  ·  ✧  ·  ✦  ·", fontSize: 18, letterSpacing: 3 },
  { id: "dots", name: "Точки", content: "•  ·  •  ·  •  ·  •  ·  •\n·  •  ·  •  ·  •  ·  •  ·", fontSize: 18, letterSpacing: 4 },
  { id: "grid", name: "Сетка", content: "＋  ·  ＋  ·  ＋  ·  ＋\n·  ＋  ·  ＋  ·  ＋  ·", fontSize: 18, letterSpacing: 3 },
  { id: "diamonds", name: "Ромбы", content: "◆  ◇  ◆  ◇  ◆  ◇  ◆\n◇  ◆  ◇  ◆  ◇  ◆  ◇", fontSize: 16, letterSpacing: 3 },
  { id: "waves", name: "Волны", content: "∿  ∿  ∿  ∿  ∿  ∿  ∿\n  ∿  ∿  ∿  ∿  ∿  ∿", fontSize: 20, letterSpacing: 5 },
  { id: "diagonal", name: "Диагонали", content: "╱  ╱  ╱  ╱  ╱  ╱  ╱\n  ╱  ╱  ╱  ╱  ╱  ╱", fontSize: 20, letterSpacing: 6 },
  { id: "checker", name: "Шахматы", content: "■  □  ■  □  ■  □  ■\n□  ■  □  ■  □  ■  □", fontSize: 14, letterSpacing: 3 },
  { id: "rings", name: "Кольца", content: "○  ◌  ○  ◌  ○  ◌  ○\n◌  ○  ◌  ○  ◌  ○  ◌", fontSize: 18, letterSpacing: 4 },
  { id: "dashes", name: "Штрихи", content: "—  ·  —  ·  —  ·  —\n·  —  ·  —  ·  —  ·", fontSize: 16, letterSpacing: 4 },
  { id: "petals", name: "Лепестки", content: "✣  ✤  ✣  ✤  ✣  ✤  ✣\n✤  ✣  ✤  ✣  ✤  ✣  ✤", fontSize: 17, letterSpacing: 3 },
  { id: "zigzag", name: "Зигзаг", content: "⌁  ⌁  ⌁  ⌁  ⌁  ⌁  ⌁\n  ⌁  ⌁  ⌁  ⌁  ⌁  ⌁", fontSize: 21, letterSpacing: 5 },
  { id: "confetti", name: "Конфетти", content: "•  ✦  ╱  ◆  ·  ✧  ╲  •\n◆  ·  ╲  ✦  •  ╱  ✧  ·", fontSize: 16, letterSpacing: 3 },
];
