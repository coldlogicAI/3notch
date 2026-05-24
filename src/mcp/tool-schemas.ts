import mcpToolsSchema from '../schemas/mcp-tools.schema.json' with { type: 'json' };

type JsonSchema = {
  [key: string]: unknown;
  type?: string;
};

export const mcpToolInputSchemas = mcpToolsSchema.$defs as Record<string, JsonSchema>;

export function getMcpToolInputSchema(toolName: string): JsonSchema {
  const schema = mcpToolInputSchemas[toolName];

  if (!schema) {
    throw new Error(`Unknown MCP tool input schema: ${toolName}`);
  }

  return schema;
}
