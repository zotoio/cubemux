import { readFileSync, existsSync } from "node:fs";
import { parse } from "smol-toml";
import type { CubemuxConfig, FaceConfig, FaceType } from "./types.js";

const FACE_ROLES = ["Lead", "Impl A", "Impl B", "Review", "Test", "Ops"] as const;

export function isFaceType(value: unknown): value is FaceType {
  return value === "agent" || value === "shell";
}

export function defaultFaceType(index: number): FaceType {
  return index === 5 ? "shell" : "agent";
}

export function defaultFaces(): FaceConfig[] {
  return FACE_ROLES.map((name, index) => ({
    index,
    name,
    type: defaultFaceType(index),
    role: index === 5 ? "ops" : name.toLowerCase().replace(/\s+/g, "-"),
  }));
}

export function normalizeFaces(input: FaceConfig[] | undefined): FaceConfig[] {
  const defaults = defaultFaces();
  const byIndex = new Map<number, FaceConfig>();

  for (const face of defaults) {
    byIndex.set(face.index, { ...face });
  }

  for (const face of input ?? []) {
    if (face.index < 0 || face.index > 5) {
      throw new Error(`Face index must be 0-5, got ${face.index}`);
    }
    if (!isFaceType(face.type)) {
      throw new Error(
        `Face ${face.index} has invalid type "${String(face.type)}". Use "agent" or "shell".`,
      );
    }
    const base = byIndex.get(face.index)!;
    byIndex.set(face.index, {
      ...base,
      ...face,
      index: face.index,
      type: face.type,
    });
  }

  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

function parseRawConfig(raw: Record<string, unknown>): CubemuxConfig {
  const session = (raw.session ?? {}) as Record<string, unknown>;
  const project =
    typeof session.project === "string" && session.project.length > 0
      ? session.project
      : "default";

  const facesRaw = Array.isArray(raw.faces) ? raw.faces : [];
  const faces: FaceConfig[] = facesRaw.map((entry, i) => {
    const face = entry as Record<string, unknown>;
    const index =
      typeof face.index === "number" ? face.index : Number(face.index ?? i);
    const typeRaw = face.type;
    const type = isFaceType(typeRaw) ? typeRaw : defaultFaceType(index);
    const defaults = defaultFaces()[index] ?? {
      index,
      name: `Face ${index}`,
      type,
    };

    return {
      index,
      name: typeof face.name === "string" ? face.name : defaults.name,
      type,
      role: typeof face.role === "string" ? face.role : defaults.role,
      command: typeof face.command === "string" ? face.command : undefined,
      prompt: typeof face.prompt === "string" ? face.prompt : undefined,
    };
  });

  return {
    session: {
      project,
      socket: typeof session.socket === "string" ? session.socket : undefined,
      window: typeof session.window === "string" ? session.window : undefined,
    },
    faces: normalizeFaces(faces.length > 0 ? faces : undefined),
  };
}

export function loadConfig(configPath: string): CubemuxConfig {
  if (!existsSync(configPath)) {
    return {
      session: { project: "default" },
      faces: defaultFaces(),
    };
  }

  const text = readFileSync(configPath, "utf8");
  const raw = parse(text) as Record<string, unknown>;
  return parseRawConfig(raw);
}

export function configFromObject(raw: Record<string, unknown>): CubemuxConfig {
  return parseRawConfig(raw);
}
