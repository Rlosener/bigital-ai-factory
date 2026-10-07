import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyResolvedCliCommand, defaultHostCliDirs, resolveHostCliBinary } from "./host-cli-path.ts";

function writeExecutable(directory: string, name: string): string {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(filePath, 0o755);
  return filePath;
}

describe("resolveHostCliBinary", () => {
  it("uses the system PATH before bundled install locations", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "host-cli-"));
    const preferredDir = path.join(root, "path");
    const bundledDir = path.join(root, "bundled");
    fs.mkdirSync(preferredDir);
    fs.mkdirSync(bundledDir);
    const preferred = writeExecutable(preferredDir, "codex");
    writeExecutable(bundledDir, "codex");

    expect(resolveHostCliBinary("codex", { pathValue: preferredDir, extraDirs: [bundledDir] })).toBe(preferred);
  });

  it("finds a CLI that exists only in a system install directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "host-cli-"));
    const bundledDir = path.join(root, "ChatGPT.app", "Contents", "Resources", "codex-cli", "bin");
    fs.mkdirSync(bundledDir, { recursive: true });
    const bundled = writeExecutable(bundledDir, "codex");

    expect(resolveHostCliBinary("codex", { pathValue: "", extraDirs: [bundledDir] })).toBe(bundled);
  });

  it("skips a same-named file that cannot be executed", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "host-cli-"));
    const blockedDir = path.join(root, "blocked");
    const usableDir = path.join(root, "usable");
    fs.mkdirSync(blockedDir);
    fs.mkdirSync(usableDir);
    fs.writeFileSync(path.join(blockedDir, "codex"), "not executable");
    fs.chmodSync(path.join(blockedDir, "codex"), 0o644);
    const usable = writeExecutable(usableDir, "codex");

    expect(resolveHostCliBinary("codex", { pathValue: blockedDir, extraDirs: [usableDir] })).toBe(usable);
  });

  it("points Codex lookups at the ChatGPT app bundle on macOS", () => {
    const bundled = defaultHostCliDirs().some((dir) => dir.endsWith(`${path.sep}codex-cli${path.sep}bin`));
    expect(bundled).toBe(process.platform === "darwin");
  });

  it("runs the resolved system binary and keeps its directory available to child processes", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "host-cli-"));
    const bundledDir = path.join(root, "bin");
    fs.mkdirSync(bundledDir);
    const bundled = writeExecutable(bundledDir, "codex");
    const env: { PATH?: string } = { PATH: "/usr/bin" };

    expect(applyResolvedCliCommand(["codex", "exec"], env, { extraDirs: [bundledDir] })).toEqual([bundled, "exec"]);
    expect(env.PATH?.split(path.delimiter)[0]).toBe(bundledDir);
  });
});
