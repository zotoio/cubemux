import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { viewerEnv } from "./viewer.js";

describe("viewerEnv", () => {
  it("sets software GL defaults when /dev/dri is absent", () => {
    const env = viewerEnv({ DISPLAY: ":1" });
    if (!existsSync("/dev/dri")) {
      expect(env.WGPU_BACKEND).toBe("gl");
      expect(env.LIBGL_ALWAYS_SOFTWARE).toBe("1");
    }
  });

  it("does not override explicit WGPU_BACKEND", () => {
    const env = viewerEnv({ WGPU_BACKEND: "vulkan" });
    expect(env.WGPU_BACKEND).toBe("vulkan");
  });
});
