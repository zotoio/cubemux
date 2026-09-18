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

  it("uses product mapping Front=0 Right=1 Back=2 Left=3 Top=4 Bottom=5", () => {
    expect(gridIndexToCubeFace(0)?.cubeFace).toBe("front");
    expect(gridIndexToCubeFace(1)?.cubeFace).toBe("right");
    expect(gridIndexToCubeFace(2)?.cubeFace).toBe("back");
    expect(gridIndexToCubeFace(3)?.cubeFace).toBe("left");
    expect(gridIndexToCubeFace(4)?.cubeFace).toBe("top");
    expect(gridIndexToCubeFace(5)?.cubeFace).toBe("bottom");
  });
});
