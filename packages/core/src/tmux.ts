import { execFileSync, spawnSync } from "node:child_process";

export interface TmuxOptions {
  socketPath: string;
}

function tmuxArgs(socketPath: string, args: string[]): string[] {
  return ["-S", socketPath, ...args];
}

export function tmuxExists(): boolean {
  const result = spawnSync("tmux", ["-V"], { encoding: "utf8" });
  return result.status === 0;
}

export function hasSession(socketPath: string): boolean {
  const result = spawnSync("tmux", tmuxArgs(socketPath, ["has-session"]), {
    encoding: "utf8",
  });
  return result.status === 0;
}

export function runTmux(
  socketPath: string,
  args: string[],
  options?: { check?: boolean },
): string {
  const check = options?.check ?? true;
  try {
    return execFileSync("tmux", tmuxArgs(socketPath, args), {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (!check) {
      return "";
    }
    const err = error as { stderr?: Buffer; message?: string };
    const detail = err.stderr?.toString().trim() ?? err.message ?? String(error);
    throw new Error(`tmux ${args.join(" ")} failed: ${detail}`);
  }
}

export function createGridSession(
  socketPath: string,
  sessionName: string,
  windowName: string,
): void {
  runTmux(socketPath, [
    "new-session",
    "-d",
    "-s",
    sessionName,
    "-n",
    windowName,
  ]);

  // Build 3 columns x 2 rows:
  // [0][1][2]
  // [3][4][5]
  runTmux(socketPath, ["split-window", "-h"]);
  runTmux(socketPath, ["select-pane", "-t", "1"]);
  runTmux(socketPath, ["split-window", "-h"]);

  for (const col of ["0", "1", "2"]) {
    runTmux(socketPath, ["select-pane", "-t", col]);
    runTmux(socketPath, ["split-window", "-v"]);
  }

  runTmux(socketPath, ["select-layout", "tiled"]);
  runTmux(socketPath, ["select-pane", "-t", "0"]);
}

export function listPaneIds(socketPath: string, windowName: string): string[] {
  const output = runTmux(socketPath, [
    "list-panes",
    "-t",
    windowName,
    "-F",
    "#{pane_index}:#{pane_id}",
  ]);

  const entries = output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [index, id] = line.split(":");
      return { index: Number(index), id };
    })
    .sort((a, b) => a.index - b.index);

  return entries.map((e) => e.id);
}

export function sendKeys(
  socketPath: string,
  paneTarget: string,
  text: string,
  enter = true,
): void {
  const args = ["send-keys", "-t", paneTarget, text];
  if (enter) {
    args.push("Enter");
  }
  runTmux(socketPath, args);
}

export function capturePane(socketPath: string, paneTarget: string): string {
  return runTmux(socketPath, ["capture-pane", "-t", paneTarget, "-p"]);
}

export function focusPane(socketPath: string, paneTarget: string): void {
  runTmux(socketPath, ["select-pane", "-t", paneTarget]);
}

export function killSession(socketPath: string): void {
  if (hasSession(socketPath)) {
    runTmux(socketPath, ["kill-session"], { check: false });
  }
}

export function attachSession(socketPath: string, sessionName: string): void {
  const result = spawnSync(
    "tmux",
    tmuxArgs(socketPath, ["attach-session", "-t", sessionName]),
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error("Failed to attach to cubemux tmux session");
  }
}
