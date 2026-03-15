import { JSON_RPC_ERROR_CODES } from "./types.js";

export class McpError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "McpError";
  }
}

export class McpProtocolError extends McpError {
  constructor(message: string, data?: unknown) {
    super(JSON_RPC_ERROR_CODES.INTERNAL_ERROR, message, data);
    this.name = "McpProtocolError";
  }
}

export class McpVersionError extends McpProtocolError {
  constructor(
    public readonly requested: string,
    public readonly negotiated: string,
  ) {
    super(
      `Protocol version mismatch: requested ${requested}, server negotiated ${negotiated}`,
    );
    this.name = "McpVersionError";
  }
}

export class McpCapabilityError extends McpError {
  constructor(public readonly capability: string) {
    super(
      JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND,
      `Server does not support capability: ${capability}`,
    );
    this.name = "McpCapabilityError";
  }
}

export class McpTimeoutError extends McpError {
  constructor(
    public readonly requestId: string | number,
    public readonly method: string,
    timeoutMs: number,
  ) {
    super(-32001, `Request ${requestId} (${method}) timed out after ${timeoutMs}ms`);
    this.name = "McpTimeoutError";
  }
}

export class McpTransportError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "McpTransportError";
  }
}

export class McpToolExecutionError extends Error {
  constructor(
    public readonly toolName: string,
    public override readonly cause: unknown,
  ) {
    super(
      `Tool "${toolName}" returned an error result`,
    );
    this.name = "McpToolExecutionError";
  }
}
