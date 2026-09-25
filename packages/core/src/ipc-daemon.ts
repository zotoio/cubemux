#!/usr/bin/env node
/**
 * Detached IPC daemon for cubemux — keeps Unix socket alive while CLI exits.
 */

import { parseArgs } from "node:util";
import { existsSync, writeFileSync } from "node:fs";
import { createSession } from "./session.js";
import { defaultConfigPath, resolveProjectRoot } from "./paths.js";
import { IpcServer } from "./ipc.js";
import type { IpcRequest } from "./types.js";
import { readState } from "./state.js";

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      cwd: { type: "string" },
      config: { type: "string" },
      pidfile: { type: "string" },
    },
  });

  const projectRoot = resolveProjectRoot(values.cwd);
  const configPath = values.config ?? defaultConfigPath(projectRoot);

  const handler = (request: IpcRequest): unknown => {
    const session = createSession(projectRoot, configPath);
    switch (request.method) {
      case "status":
        return session.status();
      case "focus":
        session.focus(request.index);
        return { focused: request.index };
      case "send":
        session.send(request.index, request.text);
        return { sent: true };
      case "capture":
        return { output: session.capture(request.index) };
      case "face.get":
        return session.getFace(request.index);
      case "face.set":
        return session.setFaceType(request.index, request.type);
      case "fold":
        return session.fold();
      case "unfold":
        return session.unfold();
      case "rotate":
        return session.rotate({
          axis: request.axis,
          degrees: request.degrees,
          yaw: request.yaw,
          pitch: request.pitch,
        });
      default:
        throw new Error("Unknown IPC method");
    }
  };

  const bootstrap = createSession(projectRoot, configPath);
  const server = new IpcServer(bootstrap.ipcPath, handler);
  await server.start();

  if (values.pidfile) {
    writeFileSync(values.pidfile, String(process.pid));
  }

  const shutdown = async () => {
    await server.stop();
    if (values.pidfile && existsSync(values.pidfile)) {
      writeFileSync(values.pidfile, "");
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    shutdown().catch(() => process.exit(1));
  });
  process.on("SIGINT", () => {
    shutdown().catch(() => process.exit(1));
  });

  setInterval(() => {
    const session = createSession(projectRoot, configPath);
    const state = readState(projectRoot);
    if (!state?.running || !session.isRunning()) {
      shutdown().catch(() => process.exit(1));
    }
  }, 2000).unref();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
