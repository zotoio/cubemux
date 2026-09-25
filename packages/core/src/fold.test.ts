import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSession } from "./session.js";

describe("fold state persistence", () => {
  it("rotate updates yaw/pitch in state", () => {
    const dir = mkdtempSync(join(tmpdir(), "cubemux-fold-"));
    writeFileSync(
      join(dir, "cubemux.toml"),
      `[session]\nproject = "fold-test"\n`,
    );
    mkdirSync(join(dir, ".cubemux"), { recursive: true });
    writeFileSync(
      join(dir, ".cubemux", "state.json"),
      JSON.stringify({
        project: "fold-test",
        socketPath: "/tmp/x.sock",
        windowName: "grid",
        running: true,
        faces: [],
        folded: false,
        foldProgress: 0,
        rotation: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      }),
      { flag: "w" },
    );

    const session = createSession(dir);
    const result = session.rotate({ yaw: 45, pitch: -10 });
    expect(result.rotation.yaw).toBe(45);
    expect(result.rotation.pitch).toBe(-10);

    const status = session.status();
    expect(status.rotation.yaw).toBe(45);
    expect(status.rotation.pitch).toBe(-10);

    rmSync(dir, { recursive: true, force: true });
  });
});
