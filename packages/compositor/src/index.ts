import {
  isViewerRunning,
  startCubeViewer,
  stopCubeViewer,
} from "./viewer.js";

/**
 * @cubemux/compositor — GPU cube viewer integration.
 *
 * The native wgpu/winit viewer lives in `packages/cube-viewer` (Rust).
 * Kitty graphics protocol support is planned; for now use the native
 * transparent window fallback on Linux desktops.
 */

export type CompositorMode = "grid" | "cube";

export interface CompositorRotation {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface CompositorState {
  mode: CompositorMode;
  folded: boolean;
  foldProgress: number;
  rotation: CompositorRotation;
}

export interface CompositorOptions {
  projectRoot: string;
  project: string;
}

export class Compositor {
  private state: CompositorState = {
    mode: "grid",
    folded: false,
    foldProgress: 0,
    rotation: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
  };

  constructor(private readonly options: CompositorOptions) {}

  getState(): CompositorState {
    return { ...this.state, rotation: { ...this.state.rotation } };
  }

  fold(): CompositorState {
    this.state.mode = "cube";
    this.state.folded = true;
    startCubeViewer(this.options.projectRoot, this.options.project);
    return this.getState();
  }

  unfold(): CompositorState {
    this.state.mode = "grid";
    this.state.folded = false;
    this.state.foldProgress = 0;
    stopCubeViewer(this.options.projectRoot, this.options.project);
    return this.getState();
  }

  rotate(input: {
    axis?: "x" | "y" | "z";
    degrees?: number;
    yaw?: number;
    pitch?: number;
  }): CompositorState {
    if (input.yaw !== undefined) {
      this.state.rotation.yaw = (this.state.rotation.yaw + input.yaw) % 360;
      this.state.rotation.y = this.state.rotation.yaw;
    }
    if (input.pitch !== undefined) {
      this.state.rotation.pitch = (this.state.rotation.pitch + input.pitch) % 360;
      this.state.rotation.x = this.state.rotation.pitch;
    }
    if (input.axis && input.degrees !== undefined) {
      this.state.rotation[input.axis] =
        (this.state.rotation[input.axis] + input.degrees) % 360;
      if (input.axis === "y") {
        this.state.rotation.yaw = this.state.rotation.y;
      }
      if (input.axis === "x") {
        this.state.rotation.pitch = this.state.rotation.x;
      }
    }
    return this.getState();
  }

  openViewer(): number {
    return startCubeViewer(this.options.projectRoot, this.options.project);
  }

  closeViewer(): void {
    stopCubeViewer(this.options.projectRoot, this.options.project);
  }

  viewerRunning(): boolean {
    return isViewerRunning(this.options.projectRoot, this.options.project);
  }
}

export function createCompositor(options: CompositorOptions): Compositor {
  return new Compositor(options);
}

export {
  cubeViewerBinary,
  isViewerRunning,
  startCubeViewer,
  stopCubeViewer,
  viewerPidFile,
} from "./viewer.js";

export {
  CUBE_FACE_MAPPING,
  describeFaceMapping,
  gridIndexToCubeFace,
  type CubeFaceId,
  type CubeFaceMapping,
} from "./face-mapping.js";
