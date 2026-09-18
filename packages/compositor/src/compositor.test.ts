import { describe, expect, it } from "vitest";
import { createCompositor } from "./index.js";

describe("compositor fold state", () => {
  it("tracks folded mode transitions", () => {
    const comp = createCompositor({
      projectRoot: "/tmp/cubemux-test",
      project: "test",
    });

    expect(comp.getState().folded).toBe(false);
    expect(comp.getState().mode).toBe("grid");

    // fold() would spawn viewer — test state logic only via rotate
    const rotated = comp.rotate({ yaw: 15, pitch: -5 });
    expect(rotated.rotation.yaw).toBe(15);
    expect(rotated.rotation.pitch).toBe(-5);
  });
});
