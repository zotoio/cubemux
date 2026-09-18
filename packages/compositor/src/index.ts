/**
 * @cubemux/compositor — GPU cube compositor stub.
 *
 * MVP ships the session plane (tmux grid) only. This package documents the
 * face→cube mapping and exposes stub APIs for fold/unfold/rotate that the CLI
 * records in session state. A future implementation will use wgpu + Kitty
 * graphics or a native transparent window.
 */

export type CompositorMode = "grid" | "cube";

export interface CompositorState {
  mode: CompositorMode;
  rotation: { x: number; y: number; z: number };
}

export interface CompositorStub {
  readonly state: CompositorState;
  fold(): CompositorState;
  unfold(): CompositorState;
  rotate(axis: "x" | "y" | "z", degrees: number): CompositorState;
}

export function createCompositorStub(): CompositorStub {
  const state: CompositorState = {
    mode: "grid",
    rotation: { x: 0, y: 0, z: 0 },
  };

  return {
    state,
    fold() {
      state.mode = "cube";
      return { ...state };
    },
    unfold() {
      state.mode = "grid";
      return { ...state };
    },
    rotate(axis, degrees) {
      state.rotation[axis] = (state.rotation[axis] + degrees) % 360;
      return { ...state };
    },
  };
}

export {
  CUBE_FACE_MAPPING,
  describeFaceMapping,
  gridIndexToCubeFace,
  type CubeFaceId,
  type CubeFaceMapping,
} from "./face-mapping.js";
