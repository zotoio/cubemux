import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function resolveProjectRoot(cwd = process.cwd()): string {
  return resolve(cwd);
}

export function stateDir(projectRoot: string): string {
  return join(projectRoot, ".cubemux");
}

export function stateFile(projectRoot: string): string {
  return join(stateDir(projectRoot), "state.json");
}

export function ipcSocketPath(projectRoot: string, project: string): string {
  return join(stateDir(projectRoot), `${project}.ipc.sock`);
}

export function tmuxSocketPath(projectRoot: string, project: string): string {
  const runtimeDir = process.env.XDG_RUNTIME_DIR ?? join(homedir(), ".cache");
  const rootKey = createHash("sha256")
    .update(resolve(projectRoot))
    .digest("hex")
    .slice(0, 12);
  return join(runtimeDir, "cubemux", `cubemux-${project}-${rootKey}.sock`);
}

export function defaultConfigPath(projectRoot: string): string {
  return join(projectRoot, "cubemux.toml");
}
