import fs from "node:fs";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { augmentHostCliPath, resolveHostCliBinary } from "../workflow/core/host-cli-path.ts";

export function parseFactoryOutput(raw: string): Record<string, any> {
  // CLI JSON-lines envelopes and the API log header are transport details, not deliverables.
  const chunks: string[] = [raw];
  for (const line of raw.split("\n")) {
    try {
      const item = JSON.parse(line);
      if (typeof item.result === "string") chunks.push(item.result);
      if (typeof item.text === "string") chunks.push(item.text);
      if (typeof item.item?.text === "string") chunks.push(item.item.text);
      if (Array.isArray(item.message?.content))
        for (const part of item.message.content) if (typeof part.text === "string") chunks.push(part.text);
    } catch {
      /* Plain text lines are parsed below. */
    }
  }
  for (const candidate of chunks.reverse()) {
    const fenced = [...candidate.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((item) => item[1]);
    const values = [...fenced.reverse(), candidate];
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) values.push(candidate.slice(first, last + 1));
    for (const text of values) {
      try {
        const obj = JSON.parse(text);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj;
      } catch {
        /* Try next candidate. */
      }
    }
  }
  throw new Error("Geçerli JSON çıktı bulunamadı; çıktı şemasını uygulayıp adımı yeniden çalıştırın.");
}

const populated = (value: unknown) =>
  typeof value === "string"
    ? value.trim().length > 0
    : Array.isArray(value)
      ? value.length > 0
      : value !== null && typeof value === "object" && Object.keys(value).length > 0;

const PLACEHOLDER = /^(?:belirtilmedi|belirtilmemiş|todo|tbd|n\/a|lorem ipsum|\.{2,}|…+)$/i;

function rejectPlaceholders(value: unknown): void {
  if (typeof value === "string" && PLACEHOLDER.test(value.trim()))
    throw new Error("Yer tutucu değer kabul edilmez; her alanı gerçek içerikle doldurun.");
  if (Array.isArray(value)) {
    for (const item of value) rejectPlaceholders(item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) rejectPlaceholders(item);
  }
}

export function validateFactoryOutput(type: string, output: Record<string, any>): void {
  const fields: Record<string, string[]> = {
    analysis: ["summary", "scope", "risks", "acceptance_criteria"],
    product: [
      "prd",
      "mvp",
      "features",
      "backlog",
      "technical_tasks",
      "user_flows",
      "data_model",
      "risks",
      "acceptance_criteria",
    ],
    social: ["strategy", "calendar", "content", "visual_briefs", "kpis", "review_notes"],
    review: ["verdict", "evidence"],
  };
  if (!fields[type]) throw new Error(`Desteklenmeyen çıktı türü: ${type}`);
  const missing = fields[type].filter((field) => !populated(output[field]));
  if (missing.length) throw new Error(`Çıktı eksik veya boş: ${missing.join(", ")}`);
  if (type === "analysis" && !Array.isArray(output.acceptance_criteria))
    throw new Error("Kabul kriterleri bir liste olmalıdır.");
  if (type === "product" && (!Array.isArray(output.backlog) || !Array.isArray(output.acceptance_criteria)))
    throw new Error("Backlog ve kabul kriterleri liste olmalıdır.");
  if (
    type === "product" &&
    (!Array.isArray(output.features) ||
      !Array.isArray(output.technical_tasks) ||
      [...output.features, ...output.technical_tasks].some((item: unknown) => !populated(item)))
  )
    throw new Error("Özellikler ve teknik görevler dolu birer liste olmalıdır.");
  if (type === "product") {
    if (
      !populated(output.prd?.problem) ||
      !Array.isArray(output.prd?.users) ||
      !output.prd.users.length ||
      !Array.isArray(output.prd?.requirements) ||
      !output.prd.requirements.length
    )
      throw new Error("PRD problem, hedef kullanıcı ve gereksinimleri içermelidir.");
    if (
      output.backlog.some(
        (item: any) =>
          !populated(item?.title) ||
          !populated(item?.priority) ||
          !Array.isArray(item?.acceptance_criteria) ||
          !item.acceptance_criteria.length,
      )
    )
      throw new Error("Her backlog kaydı başlık, öncelik ve kabul kriterleri içermelidir.");
  }
  if (type === "social" && !["calendar", "content", "visual_briefs"].every((field) => Array.isArray(output[field])))
    throw new Error("Takvim, içerik ve görsel brief listeleri gereklidir.");
  if (type === "social") rejectPlaceholders(output);
  if (type === "social") {
    const ids = new Set(output.content.map((item: any) => item?.id));
    if (
      ids.size !== output.content.length ||
      output.content.some(
        (item: any) =>
          !populated(item?.id) || !populated(item?.headline) || !populated(item?.caption) || !populated(item?.cta),
      )
    )
      throw new Error("Her içerik benzersiz id, başlık, metin ve CTA içermelidir.");
    if (
      output.calendar.some(
        (item: any) =>
          !/^\d{4}-\d{2}-\d{2}$/.test(item?.date || "") ||
          !Number.isFinite(Date.parse(item.date)) ||
          new Date(item.date).toISOString().slice(0, 10) !== item.date ||
          !populated(item?.platform) ||
          !ids.has(item?.content_id),
      )
    )
      throw new Error("Takvim geçerli tarih, platform ve var olan içerik referansı içermelidir.");
    if (output.visual_briefs.some((item: any) => !ids.has(item?.content_id) || !populated(item?.brief)))
      throw new Error("Görsel brief var olan içerik referansı ve açıklama içermelidir.");
    if (
      output.content.some(
        (item: any) =>
          !output.calendar.some((entry: any) => entry.content_id === item.id) ||
          !output.visual_briefs.some((entry: any) => entry.content_id === item.id),
      )
    )
      throw new Error("Her içerik takvime ve görsel brief'e bağlanmalıdır.");
  }
  if (type === "review") {
    if (
      !["pass", "changes_requested"].includes(output.verdict) ||
      !Array.isArray(output.findings) ||
      !Array.isArray(output.evidence)
    )
      throw new Error("Review kararı, findings ve evidence şeması geçersiz.");
    if (output.verdict !== "pass" || output.findings.length > 0)
      throw new Error("Bağımsız inceleme değişiklik istiyor; bulguları giderip tekrar çalıştırın.");
  }
}

export const FACTORY_OUTPUT_SCHEMAS: Record<string, string> = {
  analysis: '{"summary":"...","scope":["..."],"risks":["..."],"acceptance_criteria":["..."]}',
  product:
    '{"prd":{"problem":"...","users":["..."],"requirements":["..."]},"mvp":["..."],"features":["..."],"backlog":[{"title":"...","priority":"...","acceptance_criteria":["..."]}],"technical_tasks":["..."],"user_flows":["..."],"data_model":["..."],"risks":["..."],"acceptance_criteria":["..."]}',
  social:
    '{"strategy":{"audience":"...","goal":"..."},"calendar":[{"date":"YYYY-MM-DD","platform":"...","content_id":"..."}],"content":[{"id":"...","headline":"...","caption":"...","cta":"..."}],"visual_briefs":[{"content_id":"...","brief":"..."}],"kpis":["..."],"review_notes":["..."]}',
  review: '{"verdict":"pass|changes_requested","findings":[],"evidence":["Kontrol edilen somut bulgu..."]}',
};

export type VerificationEvidence = { command: string; exit_code: number; duration_ms: number; output: string };

export function extractFactoryUsage(raw: string): {
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
} {
  let input: number | null = null;
  let output: number | null = null;
  let cost: number | null = null;
  for (const line of raw.split("\n")) {
    try {
      const item = JSON.parse(line);
      const usage = item.usage;
      if (!usage || !["turn.completed", "result"].includes(item.type)) continue;
      const valid = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
      if (valid(usage.input_tokens))
        input = item.type === "turn.completed" ? (input || 0) + usage.input_tokens : usage.input_tokens;
      if (valid(usage.output_tokens))
        output = item.type === "turn.completed" ? (output || 0) + usage.output_tokens : usage.output_tokens;
      if (valid(item.total_cost_usd)) cost = item.total_cost_usd;
    } catch {
      /* Non-usage log lines do not imply zero cost. */
    }
  }
  return { input_tokens: input, output_tokens: output, cost_usd: cost };
}

function executeCheck(command: string, args: string[], cwd: string): Promise<VerificationEvidence> {
  const started = Date.now();
  const env: NodeJS.ProcessEnv = { ...process.env, CI: "1", PATH: augmentHostCliPath(process.env.PATH) };
  const executable = resolveHostCliBinary(command, { pathValue: env.PATH }) ?? command;
  return new Promise((resolve) => {
    execFile(executable, args, { cwd, timeout: 180_000, maxBuffer: 2 * 1024 * 1024, env }, (error, stdout, stderr) => {
      resolve({
        command: [command, ...args].join(" "),
        exit_code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        duration_ms: Date.now() - started,
        output: `${stdout}\n${stderr}`.slice(-30_000),
      });
    });
  });
}

/** Runs real repository scripts in the isolated worktree; agent prose never passes this gate. */
export async function verifyFactorySoftware(
  worktreePath: string,
  baseBranch: string,
): Promise<{ evidence: VerificationEvidence[]; diff: string; head: string; digest: string }> {
  const git = (args: string[]) =>
    execFileSync("git", args, { cwd: worktreePath, encoding: "utf8", timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
  const base = git(["rev-parse", baseBranch]).trim();
  const committed = git(["diff", "--binary", `${base}...HEAD`]);
  const uncommitted = git(["diff", "--binary", "HEAD"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .map((file) => {
      const absolute = path.join(worktreePath, file);
      if (fs.lstatSync(absolute).isSymbolicLink())
        throw new Error(`İzlenmeyen sembolik bağlantı kabul edilmedi: ${file}`);
      return `${file}: ${createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")}`;
    })
    .join("\n");
  const diff = `${committed}${uncommitted}${untracked}`;
  if (!diff.trim()) throw new Error("Yazılım değişikliği bulunamadı; izole branch üzerinde gerçek değişiklik gerekir.");
  const packagePath = path.join(worktreePath, "package.json");
  if (!fs.existsSync(packagePath))
    throw new Error(
      "Otomatik doğrulama şu an package.json test/build betikleri gerektirir; proje doğrulama komutlarını yapılandırın.",
    );
  const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const scripts = pkg.scripts || {};
  if (!scripts.build || (!scripts.test && !scripts["test:ci"]))
    throw new Error("Build ve test betikleri gerekli; package.json içinde yapılandırıp yeniden deneyin.");
  const manager =
    (typeof pkg.packageManager === "string" && pkg.packageManager.startsWith("pnpm@")) ||
    fs.existsSync(path.join(worktreePath, "pnpm-lock.yaml"))
      ? "pnpm"
      : fs.existsSync(path.join(worktreePath, "yarn.lock"))
        ? "yarn"
        : "npm";
  if (!resolveHostCliBinary(manager, { pathValue: augmentHostCliPath(process.env.PATH) }))
    throw new Error(`${manager} bu bilgisayarda bulunamadı; doğrulama için ${manager} kurulmalıdır.`);
  const evidence: VerificationEvidence[] = [];
  const scriptNames = [
    scripts["test:ci"] ? "test:ci" : "test",
    scripts.typecheck ? "typecheck" : scripts["type-check"] ? "type-check" : null,
    scripts.lint ? "lint" : null,
    "build",
  ].filter((script): script is string => script !== null);
  for (const script of scriptNames) {
    const check = await executeCheck(manager, ["run", script], worktreePath);
    evidence.push(check);
    if (check.exit_code !== 0)
      throw Object.assign(new Error(`Gerçek doğrulama başarısız: ${check.command} (exit ${check.exit_code})`), {
        evidence,
      });
  }
  const head = git(["rev-parse", "HEAD"]).trim();
  const finalTracked = git(["diff", "--binary", `${base}...HEAD`]) + git(["diff", "--binary", "HEAD"]);
  if (finalTracked !== committed + uncommitted)
    throw new Error("Doğrulama komutları izlenen kodu değiştirdi; değişiklikleri inceleyip yeniden doğrulayın.");
  const finalUntracked = git(["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .map((file) => {
      const absolute = path.join(worktreePath, file);
      if (fs.lstatSync(absolute).isSymbolicLink()) throw new Error(`Sembolik bağlantı kabul edilmedi: ${file}`);
      return `${file}: ${createHash("sha256").update(fs.readFileSync(absolute)).digest("hex")}`;
    })
    .join("\n");
  const finalDiff = finalTracked + finalUntracked;
  return { evidence, diff: finalDiff, head, digest: createHash("sha256").update(finalDiff).digest("hex") };
}
