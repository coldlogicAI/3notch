export function mcpInstructions(storePath: string): string {
  return `Add 3Notch as a local MCP server with this command:

notch mcp serve --store ${JSON.stringify(storePath)}

Private seed packets stay hidden unless you intentionally add --include-private.`;
}
