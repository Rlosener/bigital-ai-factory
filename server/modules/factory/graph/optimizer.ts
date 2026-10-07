export type GraphConfidence = "NEW" | "OBSERVED" | "VERIFIED" | "REPEATED" | "PROVEN";

export interface RankedGraphItem {
  id: string;
  kind: string;
  label: string;
  body: string;
  confidence: GraphConfidence;
  technology: string;
  scope: "project" | "business" | "global";
  success: number;
  updatedAt: number;
  score: number;
}

const CONFIDENCE_WEIGHT: Record<GraphConfidence, number> = {
  NEW: 0.15,
  OBSERVED: 0.35,
  VERIFIED: 0.7,
  REPEATED: 0.85,
  PROVEN: 1,
};

const SCOPE_WEIGHT = { project: 1, business: 0.65, global: 0.4 } as const;

function terms(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase("tr-TR")
      .split(/[^a-z0-9ğüşöçı]+/i)
      .filter((term) => term.length > 2),
  );
}

function overlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const term of left) if (right.has(term)) shared += 1;
  return shared / Math.sqrt(left.size * right.size);
}

export function rankGraphItems(
  items: Omit<RankedGraphItem, "score">[],
  input: { task: string; technologies?: string[]; now?: number },
): RankedGraphItem[] {
  const taskTerms = terms(input.task);
  const technologies = new Set((input.technologies ?? []).map((item) => item.toLocaleLowerCase("en-US")));
  const now = input.now ?? Date.now();
  return items
    .map((item) => {
      const itemTerms = terms(`${item.label} ${item.body} ${item.technology}`);
      const relevance = overlap(taskTerms, itemTerms);
      const technologyMatch =
        !technologies.size || !item.technology
          ? 0.5
          : item.technology
                .split(",")
                .some((name) => technologies.has(name.trim().toLocaleLowerCase("en-US")))
            ? 1
            : 0;
      const ageDays = Math.max(0, (now - item.updatedAt) / 86_400_000);
      const recency = Math.exp(-ageDays / 30);
      const score =
        relevance * 0.45 +
        item.success * 0.2 +
        CONFIDENCE_WEIGHT[item.confidence] * 0.15 +
        technologyMatch * 0.1 +
        SCOPE_WEIGHT[item.scope] * 0.05 +
        recency * 0.05;
      return { ...item, score };
    })
    .filter((item) => item.score >= 0.22)
    .sort((left, right) => right.score - left.score || right.updatedAt - left.updatedAt || left.id.localeCompare(right.id));
}

export function renderGraphBrief(items: RankedGraphItem[], budget = 1800): string {
  const sections: Array<[string, string[]]> = [
    ["İlgili kod", []],
    ["Doğrulanmış çözüm", []],
    ["Benzer olay", []],
    ["Playbook", []],
    ["Başarısız deneme", []],
  ];
  const bucket = (kind: string) => {
    if (kind === "solution" || kind === "verification") return 1;
    if (kind === "incident" || kind === "root_cause") return 2;
    if (kind === "playbook" || kind === "prevention") return 3;
    if (kind === "attempt") return 4;
    return 0;
  };
  for (const item of items) {
    const index = bucket(item.kind);
    const lines = sections[index][1];
    if (lines.length >= 2) continue;
    const caution = item.kind === "attempt" ? "Yeniden deneme. " : "";
    lines.push(`${caution}${item.label}: ${item.body} [${item.confidence}]`);
  }
  const body = sections
    .filter(([, lines]) => lines.length)
    .map(([title, lines]) => `${title}: ${lines.join(" | ")}`)
    .join("\n");
  if (!body) return "";
  const brief = `Grafik bağlamı (yalnızca bu görevle ilgili):\n${body}`;
  return brief.length <= budget ? brief : `${brief.slice(0, budget - 1)}…`;
}
