#!/usr/bin/env node
/**
 * Agent face runner — executed inside a tmux pane for `type: agent` faces.
 * Uses @cursor/sdk@1.0.26 when CURSOR_API_KEY is set; otherwise idles with a clear message.
 */

import { createInterface } from "node:readline";
import { parseArgs } from "node:util";

interface AgentFaceOptions {
  face: number;
  name: string;
  prompt?: string;
}

function parseOptions(): AgentFaceOptions {
  const { values } = parseArgs({
    options: {
      face: { type: "string", short: "f" },
      name: { type: "string", short: "n" },
      prompt: { type: "string", short: "p" },
    },
  });

  const face = Number(values.face ?? "0");
  const name = values.name ?? `Face ${face}`;
  const prompt = values.prompt;

  return { face, name, prompt };
}

function banner(face: number, name: string): void {
  console.log("");
  console.log(`╔══════════════════════════════════════════════════╗`);
  console.log(`║  cubemux agent face ${face} — ${name.padEnd(22)}║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log("");
}

async function runWithSdk(options: AgentFaceOptions): Promise<void> {
  const { Agent } = await import("@cursor/sdk");

  console.log("Cursor agent ready. Type a message and press Enter.");
  console.log("Commands: /exit to leave, /status for agent info");
  console.log("");

  const agent = await Agent.create({
    name: options.name,
    local: {
      cwd: process.cwd(),
    },
  });

  if (options.prompt) {
    console.log(`System prompt: ${options.prompt}`);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const promptUser = (): void => {
    rl.question(`[face ${options.face}]> `, async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        promptUser();
        return;
      }
      if (trimmed === "/exit") {
        rl.close();
        await agent.close();
        process.exit(0);
      }
      if (trimmed === "/status") {
        console.log(`agentId: ${agent.agentId}`);
        promptUser();
        return;
      }

      try {
        const run = await agent.send(trimmed);
        for await (const message of run.stream()) {
          if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "text") {
                process.stdout.write(block.text);
              }
            }
            process.stdout.write("\n");
          }
        }
      } catch (error) {
        console.error(
          `Agent error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      promptUser();
    });
  };

  promptUser();
}

async function runIdle(options: AgentFaceOptions): Promise<void> {
  banner(options.face, options.name);
  console.log("⚠️  CURSOR_API_KEY is not set.");
  console.log("");
  console.log("This face is configured as type: agent but cannot start the");
  console.log("Cursor SDK without an API key.");
  console.log("");
  console.log("To enable:");
  console.log("  export CURSOR_API_KEY=your_key_here");
  console.log("  # then restart cubemux or run: cubemux face set --index", options.face, "--type agent");
  console.log("");
  console.log("Alternatively, switch to a shell face:");
  console.log(`  cubemux face set --index ${options.face} --type shell`);
  console.log("");
  console.log("Face idle. Press Ctrl+C to exit.");

  await new Promise<void>(() => {
    process.stdin.resume();
  });
}

async function main(): Promise<void> {
  const options = parseOptions();
  banner(options.face, options.name);

  if (!process.env.CURSOR_API_KEY) {
    await runIdle(options);
    return;
  }

  try {
    await runWithSdk(options);
  } catch (error) {
    console.error(
      `Failed to start Cursor agent: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error("");
    console.error(
      "The face will remain open. Check CURSOR_API_KEY and network connectivity.",
    );
    await new Promise(() => {
      process.stdin.resume();
    });
  }
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("agent-face.js");

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
