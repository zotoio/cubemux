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

export function tmuxSocketPath(project: string): string {
  const runtimeDir = process.env.XDG_RUNTIME_DIR ?? join(homedir(), ".cache");
  return join(runtimeDir, "cubemux", `cubemux-${project}.sock`);
}

export function defaultConfigPath(projectRoot: string): string {
  return join(projectRoot, "cubemux.toml");
}
