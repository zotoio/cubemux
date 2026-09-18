import { describe, expect, it } from "vitest";
import {
  configFromObject,
  defaultFaceType,
  defaultFaces,
  isFaceType,
  normalizeFaces,
} from "./config.js";

describe("face type discrimination", () => {
  it("recognizes agent and shell", () => {
    expect(isFaceType("agent")).toBe(true);
    expect(isFaceType("shell")).toBe(true);
    expect(isFaceType("docker")).toBe(false);
    expect(isFaceType(undefined)).toBe(false);
  });

  it("defaults face 5 to shell and others to agent", () => {
    expect(defaultFaceType(0)).toBe("agent");
    expect(defaultFaceType(4)).toBe("agent");
    expect(defaultFaceType(5)).toBe("shell");
  });

  it("provides six default faces with mixed types", () => {
    const faces = defaultFaces();
    expect(faces).toHaveLength(6);
    expect(faces.filter((f) => f.type === "agent")).toHaveLength(5);
    expect(faces.filter((f) => f.type === "shell")).toHaveLength(1);
    expect(faces[5]?.type).toBe("shell");
    expect(faces[5]?.name).toBe("Ops");
  });
});

describe("config parsing", () => {
  it("parses mixed face types from object", () => {
    const cfg = configFromObject({
      session: { project: "demo" },
      faces: [
        { index: 0, name: "Lead", type: "agent" },
        { index: 2, name: "Shell slot", type: "shell", command: "/bin/zsh" },
        { index: 5, name: "Ops", type: "shell" },
      ],
    });

    expect(cfg.session.project).toBe("demo");
    expect(cfg.faces[0]?.type).toBe("agent");
    expect(cfg.faces[2]?.type).toBe("shell");
    expect(cfg.faces[2]?.command).toBe("/bin/zsh");
    expect(cfg.faces[5]?.type).toBe("shell");
    // Unspecified faces keep defaults
    expect(cfg.faces[1]?.type).toBe("agent");
    expect(cfg.faces[4]?.type).toBe("agent");
  });

  it("rejects invalid face types during normalization", () => {
    expect(() =>
      normalizeFaces([
        { index: 0, name: "Bad", type: "docker" as "agent", role: "x" },
      ]),
    ).toThrow(/invalid type/i);
  });

  it("rejects invalid face types in config files", () => {
    expect(() =>
      configFromObject({
        faces: [{ index: 0, name: "Bad", type: "docker" }],
      }),
    ).toThrow(/invalid type/i);
  });

  it("rejects out-of-range face indices", () => {
    expect(() =>
      normalizeFaces([
        { index: 9, name: "Out", type: "shell", role: "x" },
      ]),
    ).toThrow(/0-5/);
  });
});
