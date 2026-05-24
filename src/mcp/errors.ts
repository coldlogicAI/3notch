import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { errorToNotchError, NotchException, type NotchError } from '../types/errors.js';

export function mcpErrorResult(error: unknown): CallToolResult {
  const notchError = errorToNotchError(error);

  return {
    content: [{ type: 'text', text: `${notchError.code}: ${notchError.message}` }],
    isError: true,
    structuredContent: { error: notchError as Record<string, unknown> },
  };
}

export function assertMcpWritable(toolName: string, readOnly: boolean, allowedTools: string[]): void {
  if (readOnly || allowedTools.length === 0 || !allowedTools.includes(toolName)) {
    throw new NotchException({
      code: 'NOTCH_MCP_READ_ONLY',
      message: `MCP tool is read-only or not allowed: ${toolName}`,
      recovery: 'Start without --read-only and allow the write tool in .notch/config.json.',
      severity: 'error',
      exitCode: 4,
    });
  }
}

export function notchMcpError(input: NotchError): NotchException {
  return new NotchException(input);
}
