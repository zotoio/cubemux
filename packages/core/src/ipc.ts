import { createServer, type Server, Socket } from "node:net";
import { unlinkSync, existsSync } from "node:fs";
import type { IpcRequest, IpcResponse } from "./types.js";

export type IpcHandler = (request: IpcRequest) => Promise<unknown> | unknown;

export class IpcServer {
  private server: Server | null = null;

  constructor(
    private readonly socketPath: string,
    private readonly handler: IpcHandler,
  ) {}

  async start(): Promise<void> {
    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }

    this.server = createServer((socket) => {
      this.handleConnection(socket).catch(() => {
        socket.destroy();
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(this.socketPath, () => resolve());
      this.server!.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.server!.close(() => resolve());
    });
    this.server = null;
    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }
  }

  private async handleConnection(socket: Socket): Promise<void> {
    let buffer = "";

    const onData = async (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) {
          continue;
        }
        const response = await this.dispatch(line);
        socket.write(`${JSON.stringify(response)}\n`);
      }
    };

    socket.on("data", (chunk) => {
      onData(chunk).catch((error) => {
        const response: IpcResponse = {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        };
        socket.write(`${JSON.stringify(response)}\n`);
      });
    });
  }

  private async dispatch(line: string): Promise<IpcResponse> {
    try {
      const request = JSON.parse(line) as IpcRequest;
      const data = await this.handler(request);
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export async function ipcRequest(
  socketPath: string,
  request: IpcRequest,
  timeoutMs = 5000,
): Promise<IpcResponse> {
  const { connect } = await import("node:net");

  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let buffer = "";
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("IPC request timed out"));
    }, timeoutMs);

    socket.on("connect", () => {
      socket.write(`${JSON.stringify(request)}\n`);
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newlineIndex = buffer.indexOf("\n");
      if (newlineIndex >= 0) {
        clearTimeout(timer);
        const line = buffer.slice(0, newlineIndex);
        socket.end();
        try {
          resolve(JSON.parse(line) as IpcResponse);
        } catch (error) {
          reject(error);
        }
      }
    });

    socket.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
