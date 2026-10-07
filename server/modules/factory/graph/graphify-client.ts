import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface GraphifyCommand {
  command: string;
  args: string[];
  cwd: string;
}

export type GraphifyRunner = (command: GraphifyCommand) => string;

const DEFAULT_ROOT_CANDIDATES = [
  process.env.GRAPHIFY_ROOT,
  path.resolve(process.cwd(), "../graphify-8/graphify-8"),
  path.resolve(process.cwd(), "../../graphify-8/graphify-8"),
].filter((item): item is string => Boolean(item));

export function graphifyRoot(): string | null {
  return DEFAULT_ROOT_CANDIDATES.find((dir) => fs.existsSync(path.join(dir, "graphify", "__main__.py"))) ?? null;
}

export function projectGraphPath(projectPath: string): string {
  return path.join(projectPath, "graphify-out", "graph.json");
}

function pythonCommand(root: string | null = graphifyRoot()): string {
  if (process.env.GRAPHIFY_PYTHON) return process.env.GRAPHIFY_PYTHON;
  const venv = root
    ? path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python")
    : null;
  return venv && fs.existsSync(venv) ? venv : "python3";
}

function graphifyEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PYTHONPATH: [root, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
    PYTHONDONTWRITEBYTECODE: "1",
  };
}

export function runGraphifyCommand(command: GraphifyCommand): string {
  const root = graphifyRoot();
  if (!root) throw new Error("graphify_unavailable");
  return execFileSync(pythonCommand(root), ["-m", "graphify", ...command.args], {
    cwd: command.cwd,
    encoding: "utf8",
    timeout: 12_000,
    maxBuffer: 2_000_000,
    env: graphifyEnv(root),
  });
}

export interface CodeGraphCommunity {
  id: string;
  name: string;
  size: number;
}

export interface CodeGraphSummary {
  installed: boolean;
  ready: boolean;
  location: string;
  building: boolean;
  last_error: string | null;
  built_at: number | null;
  built_at_commit: string | null;
  node_count: number;
  edge_count: number;
  community_count: number;
  communities: CodeGraphCommunity[];
  links: Array<{ source: string; target: string; weight: number }>;
  hubs: Array<{ label: string; source_file: string; degree: number; community: string }>;
}

const summaries = new Map<string, { mtime: number; summary: Omit<CodeGraphSummary, "building" | "last_error"> }>();
const builds = new Map<string, Promise<void>>();
const buildErrors = new Map<string, string>();

function readSummary(projectPath: string): Omit<CodeGraphSummary, "building" | "last_error"> {
  const base = {
    installed: Boolean(graphifyRoot()),
    ready: false,
    location: "graphify-out/graph.json",
    built_at: null,
    built_at_commit: null,
    node_count: 0,
    edge_count: 0,
    community_count: 0,
    communities: [],
    links: [],
    hubs: [],
  };
  const file = projectGraphPath(projectPath);
  let mtime = 0;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {
    return base;
  }
  const cached = summaries.get(file);
  if (cached?.mtime === mtime) return { ...cached.summary, installed: base.installed };
  const graph = JSON.parse(fs.readFileSync(file, "utf8")) as {
    nodes?: Array<Record<string, unknown>>;
    links?: Array<Record<string, unknown>>;
    built_at_commit?: string;
  };
  const nodes = graph.nodes ?? [];
  const links = graph.links ?? [];
  const communityOf = new Map<string, string>();
  const sizes = new Map<string, CodeGraphCommunity>();
  const degree = new Map<string, number>();
  for (const node of nodes) {
    const id = String(node.id);
    const community = String(node.community ?? "0");
    communityOf.set(id, community);
    const entry = sizes.get(community) ?? {
      id: community,
      name: String(node.community_name || `Topluluk ${community}`),
      size: 0,
    };
    entry.size += 1;
    sizes.set(community, entry);
  }
  const between = new Map<string, number>();
  for (const link of links) {
    const source = String(link.source);
    const target = String(link.target);
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
    const from = communityOf.get(source);
    const to = communityOf.get(target);
    if (!from || !to || from === to) continue;
    const key = from < to ? `${from}|${to}` : `${to}|${from}`;
    between.set(key, (between.get(key) ?? 0) + 1);
  }
  const communities = [...sizes.values()].sort((a, b) => b.size - a.size);
  const top = new Set(communities.slice(0, 18).map((item) => item.id));
  const byId = new Map(nodes.map((node) => [String(node.id), node]));
  const summary = {
    ...base,
    ready: true,
    built_at: Math.round(mtime),
    built_at_commit: graph.built_at_commit ?? null,
    node_count: nodes.length,
    edge_count: links.length,
    community_count: communities.length,
    communities: communities.slice(0, 18),
    links: [...between.entries()]
      .map(([key, weight]) => {
        const [source, target] = key.split("|");
        return { source, target, weight };
      })
      .filter((link) => top.has(link.source) && top.has(link.target))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 40),
    hubs: [...degree.entries()]
      .map(([id, value]) => ({ node: byId.get(id), value }))
      .filter((item) => item.node && item.node.source_file && !String(item.node.id).startsWith("ref_"))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map(({ node, value }) => ({
        label: String(node!.label),
        source_file: String(node!.source_file),
        degree: value,
        community: String(node!.community_name || node!.community || ""),
      })),
  };
  summaries.set(file, { mtime, summary });
  return summary;
}

export function codeGraphStatus(projectPath: string | null): CodeGraphSummary {
  const key = projectPath ? path.resolve(projectPath) : "";
  const summary = projectPath
    ? readSummary(projectPath)
    : {
        installed: Boolean(graphifyRoot()),
        ready: false,
        location: "graphify-out/graph.json",
        built_at: null,
        built_at_commit: null,
        node_count: 0,
        edge_count: 0,
        community_count: 0,
        communities: [],
        links: [],
        hubs: [],
      };
  return { ...summary, building: builds.has(key), last_error: buildErrors.get(key) ?? null };
}

/** Builds or incrementally refreshes graphify-out/graph.json without blocking the event loop. */
export function buildProjectCodeGraph(projectPath: string): Promise<void> {
  const key = path.resolve(projectPath);
  const running = builds.get(key);
  if (running) return running;
  const root = graphifyRoot();
  if (!root || process.env.VITEST) return Promise.resolve();
  const job = new Promise<void>((resolve) => {
    execFile(
      pythonCommand(root),
      ["-m", "graphify", "update", key],
      { cwd: key, timeout: 300_000, maxBuffer: 4_000_000, env: graphifyEnv(root) },
      (error, stdout, stderr) => {
        if (error || /Rebuild failed/i.test(`${stdout}\n${stderr}`)) {
          const detail = `${stderr || stdout || error?.message || ""}`.trim().split("\n").slice(-2).join(" ");
          buildErrors.set(key, detail.slice(0, 300) || "Bigital kod ağı oluşturulamadı.");
        } else buildErrors.delete(key);
        resolve();
      },
    );
  }).finally(() => builds.delete(key));
  builds.set(key, job);
  return job;
}

export interface CodeGraphHit {
  label: string;
  source_file: string;
  location: string;
  community: string;
}

export function parseGraphifyNodes(output: string): CodeGraphHit[] {
  const hits: CodeGraphHit[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^NODE (.+?) \[src=(.*?) loc=(.*?) community=(.*?)\]/);
    if (!match || !match[2]) continue;
    hits.push({ label: match[1], source_file: match[2], location: match[3], community: match[4] });
  }
  return hits;
}

export function queryCodeGraphHits(
  projectPath: string,
  question: string,
  runner: GraphifyRunner = runGraphifyCommand,
): CodeGraphHit[] {
  if (!projectPath || !fs.existsSync(projectGraphPath(projectPath)) || process.env.VITEST) return [];
  try {
    return parseGraphifyNodes(
      runner({ command: "query", args: ["query", question.slice(0, 300), "--budget", "900"], cwd: projectPath }),
    ).slice(0, 12);
  } catch {
    return [];
  }
}

export function queryCodeGraph(
  projectPath: string,
  question: string,
  budget = 700,
  runner: GraphifyRunner = runGraphifyCommand,
  enabled?: boolean,
): string {
  if (enabled !== true && (!projectPath || !fs.existsSync(projectGraphPath(projectPath)) || process.env.VITEST))
    return "";
  try {
    const output = runner({
      command: "query",
      args: ["query", question.slice(0, 300), "--budget", String(budget)],
      cwd: projectPath,
    });
    const hits = parseGraphifyNodes(output);
    const text = hits.length
      ? hits
          .slice(0, 10)
          .map((hit) => `${hit.label} (${hit.source_file}${hit.location ? `:${hit.location}` : ""})`)
          .join("; ")
      : output.replace(/\s+/g, " ").trim();
    return text.slice(0, budget);
  } catch {
    return "";
  }
}

export function explainChangeImpact(
  projectPath: string,
  target: string,
  runner: GraphifyRunner = runGraphifyCommand,
): string {
  if (!projectPath || !target || !fs.existsSync(projectGraphPath(projectPath)) || process.env.VITEST) return "";
  try {
    return runner({
      command: "affected",
      args: ["affected", target.slice(0, 180), "--depth", "2"],
      cwd: projectPath,
    })
      .trim()
      .slice(0, 700);
  } catch {
    return "";
  }
}

export function updateProjectCodeGraph(projectPath: string, runner?: GraphifyRunner): void {
  if (!projectPath || process.env.VITEST || !graphifyRoot()) return;
  if (runner) {
    try {
      runner({ command: "update", args: ["update", projectPath], cwd: projectPath });
    } catch {
      // A missing or stale code graph must not block the commit or pull request.
    }
    return;
  }
  void buildProjectCodeGraph(projectPath);
}

export type GraphifyFeedbackOutcome = "useful" | "dead_end" | "corrected";

/**
 * Sends the final human outcome to the project-local graph work memory.
 * This never publishes to the global experience graph and never blocks an
 * approval response when the optional graph engine is unavailable.
 */
export function recordProjectGraphFeedback(
  projectPath: string,
  input: {
    question: string;
    answer: string;
    outcome: GraphifyFeedbackOutcome;
    correction?: string | null;
  },
): void {
  const root = graphifyRoot();
  if (!root || !projectPath || !fs.existsSync(projectGraphPath(projectPath)) || process.env.VITEST) return;
  const question = input.question.replace(/\s+/g, " ").trim().slice(0, 500);
  const answer = input.answer.replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!question || !answer) return;

  execFile(
    pythonCommand(root),
    ["-m", "graphify", "query", question, "--budget", "500"],
    { cwd: projectPath, timeout: 15_000, maxBuffer: 2_000_000, env: graphifyEnv(root) },
    (_queryError, stdout) => {
      const nodes = parseGraphifyNodes(stdout || "")
        .map((item) => item.label)
        .filter((label, index, values) => label && values.indexOf(label) === index)
        .slice(0, 10);
      const args = [
        "-m",
        "graphify",
        "save-result",
        "--question",
        question,
        "--answer",
        answer,
        "--outcome",
        input.outcome,
      ];
      if (nodes.length) args.push("--nodes", ...nodes);
      if (input.outcome === "corrected" && input.correction)
        args.push("--correction", input.correction.replace(/\s+/g, " ").trim().slice(0, 1000));
      execFile(
        pythonCommand(root),
        args,
        { cwd: projectPath, timeout: 15_000, maxBuffer: 2_000_000, env: graphifyEnv(root) },
        (saveError) => {
          if (saveError) return;
          execFile(
            pythonCommand(root),
            ["-m", "graphify", "reflect", "--if-stale"],
            { cwd: projectPath, timeout: 30_000, maxBuffer: 2_000_000, env: graphifyEnv(root) },
            () => undefined,
          );
        },
      );
    },
  );
}
