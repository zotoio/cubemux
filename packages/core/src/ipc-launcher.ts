import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stateDir } from "./paths.js";

export function ipcDaemonPath(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return join(dirname(thisFile), "ipc-daemon.js");
}

export function ipcPidFile(projectRoot: string, project: string): string {
  return join(stateDir(projectRoot), `${project}.ipc.pid`);
}
