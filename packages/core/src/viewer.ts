import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stateDir } from "./paths.js";

export function cubeViewerBinary(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "..", "cube-viewer", "target", "release", "cubemux-cube-viewer"),
    join(here, "..", "bin", "cubemux-cube-viewer"),
    join(process.cwd(), "packages", "cube-viewer", "target", "release", "cubemux-cube-viewer"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  throw new Error(
    "cubemux-cube-viewer binary not found. Run `pnpm build` to compile the Rust viewer.",
  );
}

export function viewerPidFile(projectRoot: string, project: string): string {
  return join(stateDir(projectRoot), `${project}.viewer.pid`);
}

export function isViewerRunning(projectRoot: string, project: string): boolean {
  const pidFile = viewerPidFile(projectRoot, project);
  if (!existsSync(pidFile)) {
    return false;
  }
  const raw = readFileSync(pidFile, "utf8").trim();
  const pid = Number(raw);
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function startCubeViewer(projectRoot: string, project: string): number {
  if (isViewerRunning(projectRoot, project)) {
    const pidFile = viewerPidFile(projectRoot, project);
    return Number(readFileSync(pidFile, "utf8").trim());
  }
  const binary = cubeViewerBinary();
  const pidFile = viewerPidFile(projectRoot, project);
  const child = spawn(binary, ["--cwd", projectRoot], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env },
  });
  child.unref();
  if (!child.pid) {
    throw new Error("Failed to start cubemux cube viewer");
  }
  writeFileSync(pidFile, String(child.pid));
  return child.pid;
}

export function stopCubeViewer(projectRoot: string, project: string): void {
  const pidFile = viewerPidFile(projectRoot, project);
  if (!existsSync(pidFile)) {
    return;
  }
  const raw = readFileSync(pidFile, "utf8").trim();
  const pid = Number(raw);
  if (pid > 0) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already stopped
    }
  }
  writeFileSync(pidFile, "");
}
