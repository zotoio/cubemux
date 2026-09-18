#!/usr/bin/env node
import { Command, type Command as CommandType } from "commander";
import {
  createSession,
  defaultConfigPath,
  isFaceType,
  resolveProjectRoot,
} from "@cubemux/core";
import { CUBE_FACE_MAPPING, describeFaceMapping } from "@cubemux/compositor";

const program = new Command();

program
  .name("cubemux")
  .description(
    "tmux-style multi-agent cockpit — 3×2 grid of agent or shell faces",
  )
  .option("-C, --config <path>", "path to cubemux.toml")
  .option("--cwd <path>", "project root", process.cwd());

function rootOpts(cmd: CommandType): { config?: string; cwd?: string } {
  let node: CommandType | null = cmd;
  while (node?.parent) {
    node = node.parent;
  }
  return (node ?? cmd).opts() as { config?: string; cwd?: string };
}

function session(opts: { config?: string; cwd?: string }) {
  const root = resolveProjectRoot(opts.cwd);
  const configPath = opts.config ?? defaultConfigPath(root);
  return createSession(root, configPath);
}

program
  .command("start")
  .description("Start the cubemux tmux session (3×2 grid)")
  .action(async (_args, cmd) => {
    const s = session(rootOpts(cmd));
    const state = await s.start();
    console.log(`cubemux started: project=${state.project}`);
    console.log(`  tmux socket: ${state.socketPath}`);
    console.log(`  IPC socket:  ${state.ipcSocket}`);
    console.log(`  attach:      cubemux attach`);
    for (const face of state.faces) {
      console.log(
        `  face ${face.index} [${face.type}] ${face.name} → ${face.tmuxPaneId}`,
      );
    }
  });

program
  .command("stop")
  .description("Stop the cubemux tmux session")
  .action(async (_args, cmd) => {
    const s = session(rootOpts(cmd));
    await s.stop();
    console.log("cubemux stopped");
  });

program
  .command("status")
  .description("Show session status")
  .option("--json", "emit JSON for Grok Bot / orchestrators")
  .action((_args, cmd) => {
    const statusOpts = cmd.opts() as { json?: boolean };
    const s = session(rootOpts(cmd));
    const status = s.status();
    if (statusOpts.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(`running: ${status.running}`);
      console.log(`project: ${status.project}`);
      console.log(`socket:  ${status.socket}`);
      console.log(`window:  ${status.window}`);
      console.log(`folded:  ${status.folded}`);
      console.log(`rotation: x=${status.rotation.x} y=${status.rotation.y} z=${status.rotation.z}`);
      if (status.ipcSocket) {
        console.log(`ipc:     ${status.ipcSocket}`);
      }
      for (const face of status.faces) {
        console.log(
          `  [${face.index}] ${face.name} (${face.type}) pane=${face.tmuxPaneId ?? "-"}`,
        );
      }
    }
  });

program
  .command("attach")
  .description("Attach to the flat 3×2 tmux grid")
  .action((_args, cmd) => {
    session(rootOpts(cmd)).attach();
  });

program
  .command("focus")
  .description("Focus a face pane by index (0-5)")
  .requiredOption("--index <n>", "face index", (v) => Number(v))
  .action((opts, cmd) => {
    session(rootOpts(cmd)).focus(opts.index);
    console.log(`focused face ${opts.index}`);
  });

program
  .command("send")
  .description("Send keys/text to a face pane")
  .requiredOption("--index <n>", "face index", (v) => Number(v))
  .requiredOption("--text <text>", "text to send")
  .option("--no-enter", "do not press Enter after text")
  .action((opts, cmd) => {
    session(rootOpts(cmd)).send(opts.index, opts.text, opts.enter !== false);
    console.log(`sent to face ${opts.index}`);
  });

program
  .command("capture")
  .description("Capture pane output from a face")
  .requiredOption("--index <n>", "face index", (v) => Number(v))
  .action((opts, cmd) => {
    const output = session(rootOpts(cmd)).capture(opts.index);
    process.stdout.write(output);
    if (!output.endsWith("\n")) {
      process.stdout.write("\n");
    }
  });

const faceCmd = program
  .command("face")
  .description("Inspect or change face configuration");

faceCmd
  .command("get")
  .description("Get face metadata")
  .requiredOption("--index <n>", "face index", (v) => Number(v))
  .action((opts, cmd) => {
    const face = session(rootOpts(cmd)).getFace(opts.index);
    console.log(JSON.stringify(face, null, 2));
  });

faceCmd
  .command("set")
  .description("Set face type at runtime (agent | shell)")
  .requiredOption("--index <n>", "face index", (v) => Number(v))
  .requiredOption("--type <type>", "face type: agent or shell")
  .action(async (opts, cmd) => {
    if (!isFaceType(opts.type)) {
      console.error(`Invalid face type: ${opts.type}. Use agent or shell.`);
      process.exit(1);
    }
    const face = await session(rootOpts(cmd)).setFaceType(opts.index, opts.type);
    console.log(`face ${opts.index} set to ${face.type}`);
  });

program
  .command("cube")
  .description("Open the transparent wgpu cube viewer (without toggling fold state)")
  .action((_args, cmd) => {
    const result = session(rootOpts(cmd)).cube();
    console.log(result.message);
  });

program
  .command("fold")
  .description("Fold grid into animated cube view (starts wgpu viewer)")
  .action((_args, cmd) => {
    const result = session(rootOpts(cmd)).fold();
    console.log(result.message);
    if (result.viewerPid) {
      console.log(`viewer pid: ${result.viewerPid}`);
    }
  });

program
  .command("unfold")
  .description("Unfold cube back to grid-centric mode")
  .action((_args, cmd) => {
    const result = session(rootOpts(cmd)).unfold();
    console.log(result.message);
  });

program
  .command("rotate")
  .description("Rotate cube orientation (yaw/pitch or legacy axis)")
  .option("--axis <axis>", "rotation axis: x (pitch), y (yaw), or z")
  .option("--degrees <n>", "degrees to rotate when using --axis", "90")
  .option("--yaw <n>", "yaw degrees (horizontal)")
  .option("--pitch <n>", "pitch degrees (vertical)")
  .action((opts, cmd) => {
    const hasAxis = opts.axis !== undefined;
    const hasYawPitch = opts.yaw !== undefined || opts.pitch !== undefined;
    if (!hasAxis && !hasYawPitch) {
      console.error("Provide --yaw/--pitch or --axis with --degrees");
      process.exit(1);
    }
    if (hasAxis && !["x", "y", "z"].includes(opts.axis)) {
      console.error("axis must be x, y, or z");
      process.exit(1);
    }
    const result = session(rootOpts(cmd)).rotate({
      axis: opts.axis as "x" | "y" | "z" | undefined,
      degrees: opts.degrees !== undefined ? Number(opts.degrees) : undefined,
      yaw: opts.yaw !== undefined ? Number(opts.yaw) : undefined,
      pitch: opts.pitch !== undefined ? Number(opts.pitch) : undefined,
    });
    console.log(result.message);
    console.log(
      `rotation: yaw=${result.rotation.yaw} pitch=${result.rotation.pitch} roll(z)=${result.rotation.z}`,
    );
  });

program
  .command("mapping")
  .description("Show grid face → cube face mapping")
  .action(() => {
    console.log(describeFaceMapping());
    console.log("");
    console.log(JSON.stringify(CUBE_FACE_MAPPING, null, 2));
  });

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
