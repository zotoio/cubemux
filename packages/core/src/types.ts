export type FaceType = "agent" | "shell";

export interface FaceConfig {
  index: number;
  name: string;
  type: FaceType;
  role?: string;
  /** Shell faces: command to run (defaults to $SHELL). */
  command?: string;
  /** Agent faces: optional initial system prompt / role hint. */
  prompt?: string;
}

export interface SessionConfig {
  project: string;
  socket?: string;
  window?: string;
}

export interface CubemuxConfig {
  session: SessionConfig;
  faces: FaceConfig[];
}

export interface FaceRuntimeState {
  index: number;
  name: string;
  type: FaceType;
  role?: string;
  tmuxPaneId?: string;
  agentId?: string;
}

export interface RotationState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface SessionState {
  project: string;
  socketPath: string;
  windowName: string;
  running: boolean;
  pid?: number;
  faces: FaceRuntimeState[];
  ipcSocket?: string;
  folded: boolean;
  foldProgress: number;
  rotation: RotationState;
  viewerPid?: number;
  startedAt?: string;
}

export interface CubemuxStatus {
  running: boolean;
  project: string;
  socket: string;
  window: string;
  faces: FaceRuntimeState[];
  folded: boolean;
  foldProgress: number;
  rotation: RotationState;
  viewerRunning: boolean;
  viewerLog?: string;
  ipcSocket?: string;
}

export type IpcRequest =
  | { method: "status" }
  | { method: "focus"; index: number }
  | { method: "send"; index: number; text: string }
  | { method: "capture"; index: number }
  | { method: "face.get"; index: number }
  | { method: "face.set"; index: number; type: FaceType }
  | { method: "fold" }
  | { method: "unfold" }
  | {
      method: "rotate";
      axis?: "x" | "y" | "z";
      degrees?: number;
      yaw?: number;
      pitch?: number;
    };

export type IpcResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string };
