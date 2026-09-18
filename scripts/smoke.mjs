#!/usr/bin/env node
/**
 * Smoke test: config parsing, face types, tmux grid lifecycle.
 * Does not require CURSOR_API_KEY.
 */

import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const cli = join(root, "packages/cli/dist/index.js");

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...(opts.env ?? {}) },
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function tmuxPath() {
  return execFileSync("which", ["tmux"], { encoding: "utf8" }).trim();
}

async function main() {
  console.log("smoke: unit tests");
  run("pnpm", ["test"], { cwd: root });

  const tmp = mkdtempSync(join(tmpdir(), "cubemux-smoke-"));
  const configPath = join(tmp, "cubemux.toml");
  writeFileSync(
    configPath,
    `
[session]
project = "smoke-test"

[[faces]]
index = 0
name = "Lead"
type = "agent"

[[faces]]
index = 5
name = "Ops"
type = "shell"
`,
  );

  console.log("smoke: ensure clean state");
  try {
    run("node", [cli, "-C", configPath, "--cwd", tmp, "stop"], { cwd: root });
  } catch {
    // no session yet
  }

  console.log("smoke: start session");
  const startOut = run("node", [cli, "-C", configPath, "--cwd", tmp, "start"], {
    cwd: root,
    env: { PATH: `${process.env.PATH}:${tmpdir()}` },
  });
  if (!startOut.includes("cubemux started")) {
    throw new Error("start did not report success");
  }

  console.log("smoke: status --json");
  const statusJson = run(
    "node",
    [cli, "-C", configPath, "--cwd", tmp, "status", "--json"],
    { cwd: root },
  );
  const status = JSON.parse(statusJson);
  if (!status.running) throw new Error("status.running should be true");
  if (status.faces[0]?.type !== "agent") throw new Error("face 0 should be agent");
  if (status.faces[5]?.type !== "shell") throw new Error("face 5 should be shell");

  // Allow shell/agent panes to initialize
  execFileSync("sleep", ["1"]);

  console.log("smoke: capture shell face");
  const capture = run(
    "node",
    [cli, "-C", configPath, "--cwd", tmp, "capture", "--index", "5"],
    { cwd: root },
  );
  if (!capture.includes("[face 5]")) {
    console.warn("warn: shell prompt marker not yet visible in capture (may be timing)");
  }

  console.log("smoke: face set agent → shell on face 1");
  run("node", [
    cli,
    "-C",
    configPath,
    "--cwd",
    tmp,
    "face",
    "set",
    "--index",
    "1",
    "--type",
    "shell",
  ]);

  const faceGet = run("node", [
    cli,
    "-C",
    configPath,
    "--cwd",
    tmp,
    "face",
    "get",
    "--index",
    "1",
  ]);
  const face = JSON.parse(faceGet);
  if (face.type !== "shell") throw new Error("face 1 should be shell after set");

  console.log("smoke: mapping command");
  run("node", [cli, "mapping"], { cwd: root });

  console.log("smoke: fold + rotate + unfold");
  run("node", [cli, "-C", configPath, "--cwd", tmp, "fold"], { cwd: root });
  const folded = JSON.parse(
    run("node", [cli, "-C", configPath, "--cwd", tmp, "status", "--json"], {
      cwd: root,
    }),
  );
  if (!folded.folded) throw new Error("status.folded should be true after fold");

  run("node", [
    cli,
    "-C",
    configPath,
    "--cwd",
    tmp,
    "rotate",
    "--yaw",
    "30",
    "--pitch",
    "10",
  ]);
  const rotated = JSON.parse(
    run("node", [cli, "-C", configPath, "--cwd", tmp, "status", "--json"], {
      cwd: root,
    }),
  );
  if (rotated.rotation.yaw !== 30) throw new Error("rotation.yaw should be 30");
  if (rotated.rotation.pitch !== 10) throw new Error("rotation.pitch should be 10");

  run("node", [cli, "-C", configPath, "--cwd", tmp, "unfold"], { cwd: root });
  const unfolded = JSON.parse(
    run("node", [cli, "-C", configPath, "--cwd", tmp, "status", "--json"], {
      cwd: root,
    }),
  );
  if (unfolded.folded) throw new Error("status.folded should be false after unfold");

  console.log("smoke: stop session");
  run("node", [cli, "-C", configPath, "--cwd", tmp, "stop"], { cwd: root });

  const stopped = JSON.parse(
    run("node", [cli, "-C", configPath, "--cwd", tmp, "status", "--json"], {
      cwd: root,
    }),
  );
  if (stopped.running) throw new Error("session should be stopped");

  rmSync(tmp, { recursive: true, force: true });
  console.log("smoke: all checks passed");
  console.log(`tmux: ${tmuxPath()}`);
}

main().catch((error) => {
  console.error("smoke failed:", error.message);
  process.exit(1);
});
