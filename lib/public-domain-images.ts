export type PublicDomainImageCandidate = {
  url: string;
  attribution: string;
  license: "cc0" | "pdm";
  width: number;
  height: number;
};

const topicQueries: Array<{ pattern: RegExp; query: string }> = [
  {
    pattern: /свидан|романтик|любов|ужин|ресторан|dinner|romantic|restaurant/i,
    query: "romantic restaurant",
  },
  {
    pattern: /конференц|вебинар|форум|сцен|аудитор|conference|event|stage/i,
    query: "conference audience",
  },
  {
    pattern: /технолог|искусствен.*интеллект|\bии\b|данн|софт|digital|technology|software|data|network|cyber/i,
    query: "technology network",
  },
  {
    pattern: /прав|юрист|суд|закон|legal|law|justice|court/i,
    query: "law justice",
  },
  {
    pattern: /финанс|банк|инвест|эконом|finance|bank|investment|economy/i,
    query: "business finance",
  },
  {
    pattern: /медицин|здоров|врач|клиник|health|medical|doctor|clinic/i,
    query: "medical healthcare",
  },
  {
    pattern: /образован|обучен|школ|университет|education|learning|school|university/i,
    query: "education learning",
  },
  {
    pattern: /эколог|устойчив|природ|растен|ботан|nature|sustainab|ecology|botanical/i,
    query: "nature botanical",
  },
  {
    pattern: /недвиж|архитект|интерьер|строител|real estate|architecture|interior|construction/i,
    query: "architecture interior",
  },
  {
    pattern: /путеш|туризм|отел|маршрут|travel|tourism|hotel|destination/i,
    query: "travel landscape",
  },
  {
    pattern: /еда|напит|кофе|чай|кухн|food|coffee|tea|cuisine/i,
    query: "gourmet food",
  },
  {
    pattern: /спорт|фитнес|атлет|трениров|sport|fitness|athlete|training/i,
    query: "athlete training movement",
  },
  {
    pattern: /мод|космет|красот|fashion|beauty|cosmetic/i,
    query: "fashion editorial",
  },
  {
    pattern: /искусств|музе|галере|культур|art|museum|gallery|culture/i,
    query: "art gallery",
  },
  {
    pattern: /завод|производ|промышлен|factory|manufactur|industrial/i,
    query: "industrial factory",
  },
  {
    pattern: /команд|бизнес|стратег|управлен|business|strategy|team|management/i,
    query: "business team",
  },
];

export function publicDomainImageQuery(prompt: string) {
  const topic = topicQueries.find((candidate) => candidate.pattern.test(prompt));
  if (topic) return topic.query;
  const englishTerms = prompt
    .replace(/#[\da-f]{6}/gi, " ")
    .match(/[a-z][a-z-]{2,}/gi)
    ?.slice(0, 8)
    .join(" ");
  return englishTerms
    ? `editorial ${englishTerms.split(/\s+/).slice(0, 2).join(" ")}`
    : "editorial concept";
}

export async function findPublicDomainImageCandidates(
  prompt: string,
  used = new Set<string>(),
  fetcher: typeof fetch = fetch,
): Promise<PublicDomainImageCandidate[]> {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.search = new URLSearchParams({
    q: publicDomainImageQuery(prompt),
    license: "cc0,pdm",
    aspect_ratio: "wide",
    mature: "false",
    page_size: "20",
  }).toString();
  const response = await fetcher(url, {
    headers: { "User-Agent": "Potok/1.0 (info@tech-pravo.ru)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { results?: unknown };
  if (!Array.isArray(body.results)) return [];
  return body.results
    .flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const row = value as Record<string, unknown>;
      const imageUrl = typeof row.url === "string" ? row.url : "";
      const license = row.license === "cc0" || row.license === "pdm" ? row.license : null;
      const width = typeof row.width === "number" ? row.width : 0;
      const height = typeof row.height === "number" ? row.height : 0;
      const ratio = width / Math.max(height, 1);
      if (
        !license ||
        !imageUrl.startsWith("https://") ||
        used.has(imageUrl) ||
        width < 900 ||
        height < 450 ||
        ratio < 1.25 ||
        ratio > 2.6 ||
        row.watermarked === true
      )
        return [];
      return [
        {
          url: imageUrl,
          attribution:
            typeof row.attribution === "string" ? row.attribution : "",
          license,
          width,
          height,
        } satisfies PublicDomainImageCandidate,
      ];
    })
    .sort((left, right) => {
      const leftRatioDistance = Math.abs(left.width / left.height - 1.5);
      const rightRatioDistance = Math.abs(right.width / right.height - 1.5);
      return leftRatioDistance - rightRatioDistance || right.width - left.width;
    });
}
