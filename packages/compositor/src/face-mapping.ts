/**
 * Grid face index → cube face mapping for the future GPU compositor.
 *
 * Grid layout (tmux session plane):
 * ```
 *   [0 Lead]  [1 Impl A] [2 Impl B]
 *   [3 Review][4 Test]   [5 Ops/shell]
 * ```
 *
 * Cube layout (unfolded net — top face is +Y):
 * ```
 *         [4 Test]
 * [0 Lead][1 Impl A][2 Impl B][5 Ops]
 *         [3 Review]
 * ```
 *
 * Each grid slot maps to a cube face by index. The compositor will sample
 * tmux pane textures (or Kitty graphics buffers) onto these faces when fold
 * is implemented with wgpu.
 */

export type CubeFaceId =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom";

export interface CubeFaceMapping {
  gridIndex: number;
  gridLabel: string;
  cubeFace: CubeFaceId;
  /** Normal vector on the unit cube (for future wgpu camera math). */
  normal: [number, number, number];
}

export const CUBE_FACE_MAPPING: readonly CubeFaceMapping[] = [
  {
    gridIndex: 0,
    gridLabel: "Lead",
    cubeFace: "left",
    normal: [-1, 0, 0],
  },
  {
    gridIndex: 1,
    gridLabel: "Impl A",
    cubeFace: "front",
    normal: [0, 0, 1],
  },
  {
    gridIndex: 2,
    gridLabel: "Impl B",
    cubeFace: "right",
    normal: [1, 0, 0],
  },
  {
    gridIndex: 3,
    gridLabel: "Review",
    cubeFace: "bottom",
    normal: [0, -1, 0],
  },
  {
    gridIndex: 4,
    gridLabel: "Test",
    cubeFace: "top",
    normal: [0, 1, 0],
  },
  {
    gridIndex: 5,
    gridLabel: "Ops",
    cubeFace: "back",
    normal: [0, 0, -1],
  },
] as const;

export function gridIndexToCubeFace(index: number): CubeFaceMapping | undefined {
  return CUBE_FACE_MAPPING.find((m) => m.gridIndex === index);
}

export function describeFaceMapping(): string {
  const lines = [
    "cubemux grid → cube face mapping (compositor stub)",
    "",
    "Grid (tmux 3×2):",
    "  [0 Lead]  [1 Impl A] [2 Impl B]",
    "  [3 Review][4 Test]   [5 Ops]",
    "",
    "Cube net:",
    "        [4 top/Test]",
    "  [0 left][1 front][2 right][5 back]",
    "        [3 bottom/Review]",
    "",
    "Mappings:",
  ];

  for (const m of CUBE_FACE_MAPPING) {
    lines.push(
      `  grid ${m.gridIndex} (${m.gridLabel}) → cube ${m.cubeFace} normal=[${m.normal.join(", ")}]`,
    );
  }

  return lines.join("\n");
}
