import { augmentHostCliPath } from "./host-cli-path.ts";

export type CliOutputStream = "stdout" | "stderr";

type CreateCliToolsDeps = {
  nowMs: () => number;
  cliOutputDedupWindowMs: number;
};

export function createCliTools(deps: CreateCliToolsDeps) {
  const { nowMs, cliOutputDedupWindowMs } = deps;

  const ANSI_ESCAPE_REGEX = /\u001b(?:\[[0-?]*[ -/]*[@-~]|][^\u0007]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;
  const CLI_SPINNER_LINE_REGEX = /^[\s.·•◦○●◌◍◐◓◑◒◉◎|/\\\-⠁-⣿]+$/u;
  const cliOutputDedupCache = new Map<string, { normalized: string; ts: number }>();

  function withCliPathFallback(pathValue: string | undefined): string {
    return augmentHostCliPath(pathValue);
  }

  function buildAgentArgs(
    provider: string,
    model?: string,
    reasoningLevel?: string,
    opts: { noTools?: boolean; disableMultiAgent?: boolean } = {},
  ): string[] {
    const { noTools = false } = opts;
    switch (provider) {
      case "codex": {
        const args = ["codex"];
        if (!noTools && !opts.disableMultiAgent) args.push("--enable", "multi_agent");
        if (model) args.push("-m", model);
        if (reasoningLevel) args.push("-c", `model_reasoning_effort="${reasoningLevel}"`);
        if (!noTools) args.push("--yolo");
        args.push("exec", "--json");
        if (noTools) args.push("--sandbox", "read-only", "--skip-git-repo-check");
        return args;
      }
      case "claude": {
        const args = [
          "claude",
          "--dangerously-skip-permissions",
          "--print",
          "--verbose",
          "--output-format=stream-json",
          "--include-partial-messages",
          "--max-turns",
          "200",
        ];
        if (model) args.push("--model", model);
        // Keep no-tools as a single argv token so empty value is preserved across shells.
        if (noTools) args.push("--tools=");
        return args;
      }
      case "gemini": {
        const args = ["gemini"];
        if (model) args.push("-m", model);
        if (noTools) {
          args.push("--approval-mode", "plan", "--output-format=stream-json");
        } else {
          args.push("--yolo", "--output-format=stream-json");
        }
        return args;
      }
      case "kimi": {
        const args = ["kimi", "--print", "--output-format=stream-json"];
        if (model) args.push("-m", model);
        return args;
      }
      case "opencode": {
        const args = ["opencode", "run"];
        if (model) args.push("-m", model);
        args.push("--format", "json");
        return args;
      }
      case "copilot":
      case "antigravity":
        throw new Error(`${provider} uses HTTP agent (not CLI spawn)`);
      default:
        throw new Error(`unsupported CLI provider: ${provider}`);
    }
  }

  function shouldSkipDuplicateCliOutput(taskId: string, stream: CliOutputStream, text: string): boolean {
    if (cliOutputDedupWindowMs <= 0) return false;
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return false;
    const key = `${taskId}:${stream}`;
    const now = nowMs();
    const prev = cliOutputDedupCache.get(key);
    if (prev && prev.normalized === normalized && now - prev.ts <= cliOutputDedupWindowMs) {
      cliOutputDedupCache.set(key, { normalized, ts: now });
      return true;
    }
    cliOutputDedupCache.set(key, { normalized, ts: now });
    return false;
  }

  function clearCliOutputDedup(taskId: string): void {
    const prefix = `${taskId}:`;
    for (const key of cliOutputDedupCache.keys()) {
      if (key.startsWith(prefix)) cliOutputDedupCache.delete(key);
    }
  }

  function normalizeStreamChunk(raw: Buffer | string, opts: { dropCliNoise?: boolean } = {}): string {
    const { dropCliNoise = false } = opts;
    const input = typeof raw === "string" ? raw : raw.toString("utf8");
    const normalized = input.replace(ANSI_ESCAPE_REGEX, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    if (!dropCliNoise) return normalized;

    return normalized
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        if (/^reading prompt from stdin\.{0,3}$/i.test(trimmed)) return false;
        if (CLI_SPINNER_LINE_REGEX.test(trimmed)) return false;
        return true;
      })
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  function hasStructuredJsonLines(raw: string): boolean {
    return raw.split(/\r?\n/).some((line) => line.trim().startsWith("{"));
  }

  return {
    ANSI_ESCAPE_REGEX,
    CLI_SPINNER_LINE_REGEX,
    cliOutputDedupCache,
    withCliPathFallback,
    buildAgentArgs,
    shouldSkipDuplicateCliOutput,
    clearCliOutputDedup,
    normalizeStreamChunk,
    hasStructuredJsonLines,
  };
}
