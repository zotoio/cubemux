import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CubemuxConfig,
  CubemuxStatus,
  FaceConfig,
  FaceRuntimeState,
  FaceType,
  SessionState,
} from "./types.js";
import { loadConfig } from "./config.js";
import {
  defaultConfigPath,
  ipcSocketPath,
  resolveProjectRoot,
  tmuxSocketPath,
} from "./paths.js";
import { ensureStateDir, readState, writeState } from "./state.js";
import { ipcDaemonPath, ipcPidFile } from "./ipc-launcher.js";
import {
  attachSession,
  capturePane,
  createGridSession,
  focusPane,
  hasSession,
  killSession,
  listPaneIds,
  runTmux,
  sendKeys,
  tmuxExists,
} from "./tmux.js";

const SESSION_NAME = "cubemux";
const DEFAULT_WINDOW = "grid";

export class CubemuxSession {
  constructor(
    private readonly projectRoot: string,
    private readonly configPath: string,
  ) {}

  get config(): CubemuxConfig {
    return loadConfig(this.configPath);
  }

  get socketPath(): string {
    const cfg = this.config;
    return cfg.session.socket ?? tmuxSocketPath(cfg.session.project);
  }

  get windowName(): string {
    return this.config.session.window ?? DEFAULT_WINDOW;
  }

  get ipcPath(): string {
    return ipcSocketPath(this.projectRoot, this.config.session.project);
  }

  isRunning(): boolean {
    return hasSession(this.socketPath);
  }

  status(): CubemuxStatus {
    const cfg = this.config;
    const state = readState(this.projectRoot);
    const running = this.isRunning();

    const faces: FaceRuntimeState[] = state?.faces
      ? state.faces
      : cfg.faces.map((face) => ({
          index: face.index,
          name: face.name,
          type: face.type,
          role: face.role,
        }));

    return {
      running,
      project: cfg.session.project,
      socket: this.socketPath,
      window: this.windowName,
      faces,
      folded: state?.folded ?? false,
      rotation: state?.rotation ?? { x: 0, y: 0, z: 0 },
      ipcSocket: state?.ipcSocket ?? this.ipcPath,
    };
  }

  async start(): Promise<SessionState> {
    if (!tmuxExists()) {
      throw new Error("tmux is not installed or not on PATH");
    }

    if (this.isRunning()) {
      throw new Error(
        `cubemux session already running on socket ${this.socketPath}`,
      );
    }

    const cfg = this.config;
    ensureStateDir(this.projectRoot);
    mkdirSync(dirname(this.socketPath), { recursive: true });

    createGridSession(this.socketPath, SESSION_NAME, this.windowName);
    const paneIds = listPaneIds(this.socketPath, this.windowName);

    if (paneIds.length !== 6) {
      killSession(this.socketPath);
      throw new Error(
        `Expected 6 tmux panes, got ${paneIds.length}. Grid layout failed.`,
      );
    }

    const faces: FaceRuntimeState[] = cfg.faces.map((face, i) => ({
      index: face.index,
      name: face.name,
      type: face.type,
      role: face.role,
      tmuxPaneId: paneIds[i],
    }));

    for (const face of cfg.faces) {
      await this.spawnFace(face, paneIds[face.index]);
    }

    const state: SessionState = {
      project: cfg.session.project,
      socketPath: this.socketPath,
      windowName: this.windowName,
      running: true,
      faces,
      ipcSocket: this.ipcPath,
      folded: false,
      rotation: { x: 0, y: 0, z: 0 },
      startedAt: new Date().toISOString(),
    };

    writeState(this.projectRoot, state);
    this.startIpcDaemon();
    return state;
  }

  async stop(): Promise<void> {
    this.stopIpcDaemon();
    killSession(this.socketPath);
    const state = readState(this.projectRoot);
    if (state) {
      writeState(this.projectRoot, { ...state, running: false });
    }
  }

  attach(): void {
    if (!this.isRunning()) {
      throw new Error("cubemux session is not running. Run `cubemux start` first.");
    }
    attachSession(this.socketPath, SESSION_NAME);
  }

  focus(index: number): void {
    const pane = this.resolvePane(index);
    focusPane(this.socketPath, pane);
  }

  send(index: number, text: string, enter = true): void {
    const pane = this.resolvePane(index);
    sendKeys(this.socketPath, pane, text, enter);
  }

  capture(index: number): string {
    const pane = this.resolvePane(index);
    return capturePane(this.socketPath, pane);
  }

  getFace(index: number): FaceRuntimeState {
    const state = this.requireState();
    const face = state.faces.find((f) => f.index === index);
    if (!face) {
      throw new Error(`Face index ${index} not found`);
    }
    return face;
  }

  async setFaceType(index: number, type: FaceType): Promise<FaceRuntimeState> {
    const state = this.requireState();
    const cfg = this.config;
    const faceCfg = cfg.faces.find((f) => f.index === index);
    if (!faceCfg) {
      throw new Error(`Face index ${index} not found in config`);
    }

    const updatedCfg: FaceConfig = { ...faceCfg, type };
    const current = state.faces.find((f) => f.index === index);
    const paneId = current?.tmuxPaneId;
    if (!paneId) {
      throw new Error(`No tmux pane mapped for face ${index}`);
    }

    // Clear pane and respawn with new face type
    runTmux(this.socketPath, ["send-keys", "-t", paneId, "C-c"]);
    runTmux(this.socketPath, ["send-keys", "-t", paneId, "clear", "Enter"]);
    await this.spawnFace(updatedCfg, paneId);

    const faces = state.faces.map((f) =>
      f.index === index ? { ...f, type } : f,
    );
    writeState(this.projectRoot, { ...state, faces });
    const updated = faces.find((f) => f.index === index);
    if (!updated) {
      throw new Error(`Face index ${index} not found after update`);
    }
    return updated;
  }

  fold(): { folded: boolean; message: string } {
    const state = this.requireState();
    writeState(this.projectRoot, { ...state, folded: true });
    return {
      folded: true,
      message:
        "Fold stub: compositor cube fold not implemented. Grid session unchanged.",
    };
  }

  unfold(): { folded: boolean; message: string } {
    const state = this.requireState();
    writeState(this.projectRoot, { ...state, folded: false });
    return {
      folded: false,
      message:
        "Unfold stub: compositor cube unfold not implemented. Grid session unchanged.",
    };
  }

  rotate(axis: "x" | "y" | "z", degrees: number): {
    rotation: { x: number; y: number; z: number };
    message: string;
  } {
    const state = this.requireState();
    const rotation = { ...state.rotation };
    rotation[axis] = (rotation[axis] + degrees) % 360;
    writeState(this.projectRoot, { ...state, rotation });
    return {
      rotation,
      message:
        "Rotate stub: GPU compositor rotation not implemented. Rotation stored for future compositor.",
    };
  }

  private requireState(): SessionState {
    const state = readState(this.projectRoot);
    if (!state) {
      throw new Error("No cubemux state found. Run `cubemux start` first.");
    }
    return state;
  }

  private resolvePane(index: number): string {
    if (!this.isRunning()) {
      throw new Error("cubemux session is not running");
    }
    const state = this.requireState();
    const face = state.faces.find((f) => f.index === index);
    if (!face?.tmuxPaneId) {
      throw new Error(`Face ${index} has no tmux pane`);
    }
    return face.tmuxPaneId;
  }

  private agentFaceRunnerPath(): string {
    const thisFile = fileURLToPath(import.meta.url);
    const distDir = dirname(thisFile);
    return join(distDir, "agent-face.js");
  }

  private async spawnFace(face: FaceConfig, paneId: string): Promise<void> {
    const title = `cubemux:${face.index}:${face.name}`;
    runTmux(this.socketPath, [
      "select-pane",
      "-t",
      paneId,
      "-T",
      title,
    ]);

    if (face.type === "shell") {
      const shell = face.command ?? process.env.SHELL ?? "/bin/bash";
      const cmd = `export PS1='[face ${face.index}] \\w $ '; exec ${shell}`;
      sendKeys(this.socketPath, paneId, cmd);
      return;
    }

    const runner = this.agentFaceRunnerPath();
    const promptArg = face.prompt ? ` --prompt ${JSON.stringify(face.prompt)}` : "";
    const cmd = `node ${JSON.stringify(runner)} --face ${face.index} --name ${JSON.stringify(face.name)}${promptArg}`;
    sendKeys(this.socketPath, paneId, cmd);
  }

  private startIpcDaemon(): void {
    this.stopIpcDaemon();
    const daemon = ipcDaemonPath();
    const pidFile = ipcPidFile(this.projectRoot, this.config.session.project);
    const child = spawn(
      process.execPath,
      [
        daemon,
        "--cwd",
        this.projectRoot,
        "--config",
        this.configPath,
        "--pidfile",
        pidFile,
      ],
      { detached: true, stdio: "ignore" },
    );
    child.unref();
  }

  private stopIpcDaemon(): void {
    const pidFile = ipcPidFile(this.projectRoot, this.config.session.project);
    if (!existsSync(pidFile)) {
      return;
    }
    const raw = readFileSync(pidFile, "utf8").trim();
    const pid = Number(raw);
    if (pid > 0) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // daemon may already be gone
      }
    }
    writeFileSync(pidFile, "");
  }
}

export function createSession(
  cwd?: string,
  configPath?: string,
): CubemuxSession {
  const projectRoot = resolveProjectRoot(cwd);
  const path = configPath ?? defaultConfigPath(projectRoot);
  return new CubemuxSession(projectRoot, path);
}
