export type PromptClientId = 'claude-code' | 'claude-desktop' | 'codex' | 'cursor';

export type PromptClient = {
  id: PromptClientId;
  label: string;
  destination: string;
  setupHint: string;
};

export const v1McpToolNames = [
  'get_brief',
  'create_brief',
  'list_briefs',
  'get_targeted_brief',
  'create_packet',
  'import_packet',
  'list_packets',
  'get_packet',
  'create_seed_packet',
  'import_seed_packet',
  'get_status',
  'run_doctor',
] as const;

export function renderAgentPrompt(client: PromptClient): string {
  return `3Notch Agent Instructions - ${client.label}

Place this in: ${client.destination}

${client.setupHint}

When the user asks to package, transfer, or hand off project context, use the local 3Notch MCP server. Work from explicit user-provided context, selected files, source links, and summaries. Do not claim access to hidden chat history or private files the user did not provide.

Use packets for cross-tool or cross-repo handoff:
- Call create_packet when the user wants context prepared for another agent, repo, or person.
- Include a concise summary, recipient metadata, sourceLinks, exclusions, and next steps.
- Call list_packets and get_packet when the user asks to inspect available packets.
- Call import_packet only for a packet path the user explicitly selected.

Use briefs for scoped work:
- Call get_brief before broad project work.
- Call create_brief for a targeted task brief.
- Call list_briefs and get_targeted_brief to find existing briefs.

Use private seed packets only for reviewed user preferences and workflow conventions:
- Call create_seed_packet only with explicit private context supplied by the user.
- Call import_seed_packet only for a user-selected private seed packet path.

Use status checks when helpful:
- Call get_status for a store summary.
- Call run_doctor for diagnostics.

Available 3Notch MCP tools:
${v1McpToolNames.map((tool) => `- ${tool}`).join('\n')}`;
}
