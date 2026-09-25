/**
 * Grid face index → cube face mapping.
 *
 * Grid layout (tmux session plane):
 * ```
 *   [0 Lead]  [1 Impl A] [2 Impl B]
 *   [3 Review][4 Test]   [5 Ops/shell]
 * ```
 *
 * Cube mapping (product spec):
 *   Front=0 Lead, Right=1, Back=2, Left=3, Top=4, Bottom=5
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
  /** Normal vector on the unit cube (for wgpu camera math). */
  normal: [number, number, number];
}

export const CUBE_FACE_MAPPING: readonly CubeFaceMapping[] = [
  {
    gridIndex: 0,
    gridLabel: "Lead",
    cubeFace: "front",
    normal: [0, 0, 1],
  },
  {
    gridIndex: 1,
    gridLabel: "Impl A",
    cubeFace: "right",
    normal: [1, 0, 0],
  },
  {
    gridIndex: 2,
    gridLabel: "Impl B",
    cubeFace: "back",
    normal: [0, 0, -1],
  },
  {
    gridIndex: 3,
    gridLabel: "Review",
    cubeFace: "left",
    normal: [-1, 0, 0],
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
    cubeFace: "bottom",
    normal: [0, -1, 0],
  },
] as const;

export function gridIndexToCubeFace(index: number): CubeFaceMapping | undefined {
  return CUBE_FACE_MAPPING.find((m) => m.gridIndex === index);
}

export function describeFaceMapping(): string {
  const lines = [
    "cubemux grid → cube face mapping",
    "",
    "Grid (tmux 3×2):",
    "  [0 Lead]  [1 Impl A] [2 Impl B]",
    "  [3 Review][4 Test]   [5 Ops]",
    "",
    "Cube faces:",
    "  Front=0, Right=1, Back=2, Left=3, Top=4, Bottom=5",
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
