import { describe, expect, it } from "vitest";
import {
  CUBE_FACE_MAPPING,
  gridIndexToCubeFace,
} from "./face-mapping.js";

describe("cube face mapping", () => {
  it("maps all six grid indices", () => {
    expect(CUBE_FACE_MAPPING).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(gridIndexToCubeFace(i)).toBeDefined();
    }
  });

  it("maps ops/shell slot to back face", () => {
    expect(gridIndexToCubeFace(5)?.cubeFace).toBe("back");
    expect(gridIndexToCubeFace(5)?.gridLabel).toBe("Ops");
  });
});
