import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { Transport } from "@mcp-workbench/protocol-kernel";
import { type JsonRpcMessage, McpTransportError } from "@mcp-workbench/protocol-kernel";

export interface StdioTransportOptions {
  /** Command to run (e.g. "node", "python", "java") */
  command: string;
  /** Arguments to the command */
  args?: string[];
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Merge additional env vars with process.env (default: true) */
  inheritEnv?: boolean;
}

/**
 * Transport that communicates with an MCP server via stdin/stdout.
 * Spawns a child process and exchanges newline-delimited JSON-RPC messages.
 */
export class StdioTransport implements Transport {
  private process: ChildProcess | null = null;
  private messageHandler: ((msg: JsonRpcMessage) => void) | null = null;
  private closeHandler: (() => void) | null = null;
  private errorHandler: ((err: Error) => void) | null = null;

  constructor(private readonly opts: StdioTransportOptions) {}

  readonly onMessage = (handler: (msg: JsonRpcMessage) => void): void => {
    this.messageHandler = handler;
  };

  readonly onClose = (handler: () => void): void => {
    this.closeHandler = handler;
  };

  readonly onError = (handler: (err: Error) => void): void => {
    this.errorHandler = handler;
  };

  async connect(): Promise<void> {
    const env = this.opts.inheritEnv !== false
      ? { ...process.env, ...this.opts.env }
      : { ...this.opts.env };

    this.process = spawn(this.opts.command, this.opts.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      cwd: this.opts.cwd,
    });

    const rl = createInterface({ input: this.process.stdout! });

    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcMessage;
        this.messageHandler?.(msg);
      } catch {
        this.errorHandler?.(
          new McpTransportError(`Failed to parse JSON from server: ${trimmed}`),
        );
      }
    });

    this.process.stderr?.on("data", (chunk: Buffer) => {
      // stderr is diagnostic output from the server — surface as an error event
      // so the session engine can display it in the logs panel.
      this.errorHandler?.(
        new McpTransportError(`Server stderr: ${chunk.toString().trim()}`),
      );
    });

    this.process.on("exit", (code, signal) => {
      this.closeHandler?.();
      if (code !== 0 && code !== null) {
        this.errorHandler?.(
          new McpTransportError(`Server process exited with code ${code ?? signal}`),
        );
      }
    });

    this.process.on("error", (err) => {
      this.errorHandler?.(new McpTransportError("Child process error", err));
    });
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.process?.stdin) {
      throw new McpTransportError("Transport not connected. Call connect() first.");
    }
    const line = JSON.stringify(message) + "\n";
    await new Promise<void>((resolve, reject) => {
      this.process!.stdin!.write(line, (err) => {
        if (err) reject(new McpTransportError("Failed to write to stdin", err));
        else resolve();
      });
    });
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }

  /** The PID of the spawned server process, if connected */
  get pid(): number | undefined {
    return this.process?.pid;
  }
}
