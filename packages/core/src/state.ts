import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { SessionState } from "./types.js";
import { stateFile, stateDir } from "./paths.js";

export function readState(projectRoot: string): SessionState | null {
  const path = stateFile(projectRoot);
  if (!existsSync(path)) {
    return null;
  }
  return JSON.parse(readFileSync(path, "utf8")) as SessionState;
}

export function writeState(projectRoot: string, state: SessionState): void {
  const path = stateFile(projectRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

export function clearState(projectRoot: string): void {
  const path = stateFile(projectRoot);
  if (existsSync(path)) {
    writeFileSync(path, "");
  }
}

export function ensureStateDir(projectRoot: string): string {
  const dir = stateDir(projectRoot);
  mkdirSync(dir, { recursive: true });
  return dir;
}
