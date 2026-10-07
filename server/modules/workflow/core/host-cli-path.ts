import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WINDOWS_BIN_SUFFIXES = [".cmd", ".exe", ".bat", ""];

export function defaultHostCliDirs(): string[] {
  const home = os.homedir();
  if (process.platform === "win32") {
    return [
      path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs"),
      path.join(process.env.LOCALAPPDATA || "", "Programs", "nodejs"),
      path.join(process.env.APPDATA || "", "npm"),
    ].filter(Boolean);
  }

  const dirs = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    path.join(home, ".local", "bin"),
    path.join(home, "bin"),
    path.join(home, ".npm-global", "bin"),
    path.join(home, ".volta", "bin"),
    path.join(home, ".claude", "local"),
  ];

  if (process.platform === "darwin") {
    dirs.push(
      "/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin",
      path.join(home, "Applications", "ChatGPT.app", "Contents", "Resources", "codex-cli", "bin"),
    );
  }

  return dirs;
}

function isExecutableFile(filePath: string): boolean {
  try {
    if (!fs.statSync(filePath).isFile()) return false;
    if (process.platform === "win32") return true;
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function candidateNames(name: string): string[] {
  if (process.platform !== "win32") return [name];
  if (path.extname(name)) return [name];
  return WINDOWS_BIN_SUFFIXES.map((suffix) => `${name}${suffix}`);
}

export function resolveHostCliBinary(
  name: string,
  options: { pathValue?: string; extraDirs?: string[] } = {},
): string | null {
  if (!name || path.isAbsolute(name)) return isExecutableFile(name) ? name : null;

  const pathValue = options.pathValue ?? process.env.PATH ?? "";
  const dirs = [...pathValue.split(path.delimiter), ...(options.extraDirs ?? defaultHostCliDirs())];
  const seen = new Set<string>();

  for (const dir of dirs) {
    const trimmed = dir.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    for (const candidateName of candidateNames(name)) {
      const candidate = path.join(trimmed, candidateName);
      if (isExecutableFile(candidate)) return candidate;
    }
  }

  return null;
}

export function augmentHostCliPath(pathValue: string | undefined, extraDirs: string[] = defaultHostCliDirs()): string {
  const parts = (pathValue ?? "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  const seen = new Set(parts);
  for (const dir of extraDirs) {
    if (!dir || seen.has(dir)) continue;
    parts.push(dir);
    seen.add(dir);
  }
  return parts.join(path.delimiter);
}

export function applyResolvedCliCommand(
  args: string[],
  env: Record<string, string | undefined>,
  options: { extraDirs?: string[] } = {},
): string[] {
  if (args.length === 0) return args;
  const resolved = resolveHostCliBinary(args[0], { pathValue: env.PATH, extraDirs: options.extraDirs });
  if (!resolved) return args;
  const binDir = path.dirname(resolved);
  const parts = (env.PATH ?? "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter((item) => item && item !== binDir);
  for (const dir of options.extraDirs ?? []) {
    if (dir && dir !== binDir && !parts.includes(dir)) parts.push(dir);
  }
  env.PATH = [binDir, ...parts].join(path.delimiter);
  return resolved === args[0] ? args : [resolved, ...args.slice(1)];
}
