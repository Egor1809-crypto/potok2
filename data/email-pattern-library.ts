export type EmailPatternLibraryCategory =
  | "romantic"
  | "botanical"
  | "editorial"
  | "geometry"
  | "technology"
  | "celebration"
  | "premium"
  | "texture";

export type EmailPatternLibraryItem = {
  id: string;
  name: string;
  category: EmailPatternLibraryCategory;
  imageUrl: string;
  keywords: string[];
  styles: Array<"minimal" | "editorial" | "bold" | "premium">;
  source: "potok" | "pattern-monster";
};

const SITE_ORIGIN = "https://mailflow-outreach.isakovegor820.chatgpt.site";

const nativePatterns: EmailPatternLibraryItem[] = [
  { id: "romantic-ribbon", name: "Романтическая лента", category: "romantic", keywords: ["свидан", "роман", "любов", "свадьб", "ужин", "ресторан"], styles: ["minimal", "editorial", "premium"], source: "potok", imageUrl: "" },
  { id: "gallery-orbit", name: "Галерейная орбита", category: "geometry", keywords: ["галере", "искусств", "выстав", "культур"], styles: ["minimal", "editorial"], source: "potok", imageUrl: "" },
  { id: "water-ripples", name: "Водная рябь", category: "texture", keywords: ["вода", "море", "океан", "спа", "здоров", "спокой", "медитац"], styles: ["minimal", "premium"], source: "potok", imageUrl: "" },
  { id: "botanical-herbarium", name: "Ботанический гербарий", category: "botanical", keywords: ["чай", "кофе", "ботан", "растен", "природ", "эко", "сад", "лес", "трав", "органик"], styles: ["minimal", "editorial", "premium"], source: "potok", imageUrl: "" },
  { id: "topographic-lines", name: "Топографические линии", category: "editorial", keywords: ["путеш", "маршрут", "отел", "тур", "географ", "экспедиц", "город"], styles: ["minimal", "editorial"], source: "potok", imageUrl: "" },
  { id: "terrazzo-studio", name: "Студийное терраццо", category: "celebration", keywords: ["фестив", "ярк", "молод", "вечерин", "запуск"], styles: ["bold"], source: "potok", imageUrl: "" },
  { id: "paper-grain", name: "Бумажная фактура", category: "texture", keywords: ["редакц", "письмо", "истори", "книга", "издан"], styles: ["minimal", "editorial"], source: "potok", imageUrl: "" },
  { id: "editorial-rules", name: "Редакционные линейки", category: "editorial", keywords: ["делов", "отч[её]т", "исслед", "аналит", "стратег", "консалт"], styles: ["editorial", "minimal"], source: "potok", imageUrl: "" },
  { id: "moroccan-arches", name: "Марокканские арки", category: "premium", keywords: ["архитект", "отел", "дизайн", "интерьер", "путеш"], styles: ["editorial", "premium"], source: "potok", imageUrl: "" },
  { id: "signal-grid", name: "Сигнальная сетка", category: "technology", keywords: ["технолог", "данн", "цифр", "разработ", "сервис", "saas", "продукт", "ии", "ai"], styles: ["minimal", "bold"], source: "potok", imageUrl: "" },
  { id: "quiet-luxury", name: "Тихая роскошь", category: "premium", keywords: ["преми", "luxur", "дорог", "элит", "ювелир", "мод"], styles: ["premium"], source: "potok", imageUrl: "" },
  { id: "celebration-spark", name: "Праздничное сияние", category: "celebration", keywords: ["празд", "поздрав", "день рожд", "юбиле", "вечерин"], styles: ["bold", "premium"], source: "potok", imageUrl: "" },
].map((pattern) => ({
  ...pattern,
  imageUrl: `${SITE_ORIGIN}/email-patterns/${pattern.id}.jpg`,
}));

const monsterSpecs: Array<
  Omit<EmailPatternLibraryItem, "imageUrl" | "source">
> = [
  { id: "waves-1", name: "Линейные волны", category: "editorial", keywords: ["вода", "движен", "поток", "музык", "ритм"], styles: ["minimal", "editorial"] },
  { id: "waves-4", name: "Тонкая синусоида", category: "editorial", keywords: ["связ", "сигнал", "аудио", "данн"], styles: ["minimal", "editorial"] },
  { id: "japanese-pattern-5", name: "Сейгайха", category: "premium", keywords: ["япон", "ази", "море", "ритуал", "чай"], styles: ["editorial", "premium"] },
  { id: "chevron-2", name: "Мягкий шеврон", category: "geometry", keywords: ["рост", "движен", "этап", "направлен"], styles: ["minimal", "bold"] },
  { id: "herringbone-1", name: "Архитектурная ёлочка", category: "geometry", keywords: ["архитект", "строител", "интерьер", "систем"], styles: ["minimal", "editorial"] },
  { id: "herringbone-3", name: "Тканая ёлочка", category: "premium", keywords: ["мод", "ткан", "ателье", "преми"], styles: ["editorial", "premium"] },
  { id: "flower-1", name: "Четыре лепестка", category: "romantic", keywords: ["свадьб", "роман", "цвет", "красот"], styles: ["minimal", "premium"] },
  { id: "flower-3", name: "Цветочная печать", category: "botanical", keywords: ["цвет", "ботан", "сад", "космет"], styles: ["editorial", "premium"] },
  { id: "flower-5", name: "Современная флористика", category: "botanical", keywords: ["флорист", "весн", "букет", "растен"], styles: ["bold", "editorial"] },
  { id: "leaves-2", name: "Малые листья", category: "botanical", keywords: ["эко", "лист", "природ", "органик"], styles: ["minimal", "editorial"] },
  { id: "leaves-5", name: "Листовой ритм", category: "botanical", keywords: ["здоров", "спа", "трава", "сад"], styles: ["premium", "editorial"] },
  { id: "circles-1", name: "Круговой модуль", category: "geometry", keywords: ["сообществ", "связ", "цикл", "систем"], styles: ["minimal", "bold"] },
  { id: "circles-4", name: "Оптические круги", category: "geometry", keywords: ["оптик", "фокус", "вниман", "креатив"], styles: ["bold", "editorial"] },
  { id: "circles-7", name: "Пересечение орбит", category: "technology", keywords: ["наук", "космос", "связ", "сеть"], styles: ["minimal", "bold"] },
  { id: "concentric-circles-2", name: "Концентрический сигнал", category: "technology", keywords: ["радар", "сигнал", "данн", "аналит"], styles: ["minimal", "bold"] },
  { id: "checkerboard", name: "Редакционная шахматка", category: "geometry", keywords: ["сравнен", "выбор", "игр", "шахмат"], styles: ["bold", "editorial"] },
  { id: "greek-key", name: "Греческий меандр", category: "premium", keywords: ["антич", "грец", "истори", "архитект"], styles: ["editorial", "premium"] },
  { id: "cubes-1", name: "Изометрические кубы", category: "technology", keywords: ["продукт", "модул", "платформ", "инфраструкт"], styles: ["minimal", "bold"] },
  { id: "stained-glass", name: "Витражная сетка", category: "geometry", keywords: ["искусств", "архитект", "культур", "дизайн"], styles: ["bold", "editorial"] },
  { id: "tiles-1", name: "Круглая плитка", category: "premium", keywords: ["интерьер", "дом", "отел", "рестор"], styles: ["editorial", "premium"] },
  { id: "batik-2", name: "Батик с цветами", category: "botanical", keywords: ["ткан", "мод", "ручн", "ремесл"], styles: ["editorial", "premium"] },
  { id: "batik-4", name: "Геометрический батик", category: "premium", keywords: ["коллекц", "ателье", "культур", "этно"], styles: ["bold", "premium"] },
  { id: "stripes-1", name: "Цветные полосы", category: "celebration", keywords: ["фестив", "событ", "запуск", "ярк"], styles: ["bold"] },
  { id: "squares-1", name: "Модульные квадраты", category: "technology", keywords: ["продукт", "команд", "процесс", "систем"], styles: ["minimal", "bold"] },
  { id: "interlocked-hexagons-1", name: "Связанные соты", category: "technology", keywords: ["сеть", "безопас", "инфраструкт", "платформ"], styles: ["minimal", "bold"] },
  { id: "lanterns-1", name: "Фонарный ритм", category: "romantic", keywords: ["вечер", "ужин", "празд", "событ"], styles: ["editorial", "premium"] },
  { id: "lines-4", name: "Кинетические линии", category: "editorial", keywords: ["скорост", "рост", "маршрут", "движен"], styles: ["minimal", "bold"] },
  { id: "scales-2", name: "Мягкая чешуя", category: "botanical", keywords: ["море", "рыб", "вода", "органик"], styles: ["minimal", "premium"] },
  { id: "memphis-1", name: "Мемфис-контур", category: "celebration", keywords: ["молод", "креатив", "игр", "фестив"], styles: ["bold"] },
  { id: "memphis-3", name: "Мемфис-студия", category: "celebration", keywords: ["вечерин", "ярк", "запуск", "развлеч"], styles: ["bold"] },
  { id: "stars-1", name: "Контурные звёзды", category: "celebration", keywords: ["празд", "поздрав", "награ", "успех"], styles: ["minimal", "premium"] },
  { id: "stars-4", name: "Звёздная мозаика", category: "celebration", keywords: ["юбиле", "вечерин", "фестив", "празд"], styles: ["bold", "premium"] },
  { id: "plaid-pattern-1", name: "Спокойная клетка", category: "editorial", keywords: ["делов", "отч[её]т", "исслед", "образован"], styles: ["minimal", "editorial"] },
  { id: "diamonds-2", name: "Тонкие ромбы", category: "premium", keywords: ["ювелир", "преми", "мод", "коллекц"], styles: ["minimal", "premium"] },
  { id: "hexagon-2", name: "Инженерные соты", category: "technology", keywords: ["инженер", "наук", "технолог", "безопас"], styles: ["minimal", "bold"] },
  { id: "triangles-1", name: "Треугольный ритм", category: "geometry", keywords: ["рост", "стратег", "структур", "динамик"], styles: ["minimal", "bold"] },
];

const monsterPatterns: EmailPatternLibraryItem[] = monsterSpecs.map(
  (pattern) => ({
    ...pattern,
    source: "pattern-monster",
    imageUrl: `${SITE_ORIGIN}/email-patterns/pattern-monster-${pattern.id}.jpg`,
  }),
);

export const emailPatternLibrary = [...nativePatterns, ...monsterPatterns];

