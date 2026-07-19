import os from 'node:os';
import path from 'node:path';

export type McpConfigClient = 'claude-code' | 'claude-desktop' | 'codex' | 'cursor' | 'chatgpt-desktop';

export type McpServerDefinition = {
  args: string[];
  command: string;
};

export function notchMcpServerDefinition(storePath: string, includePrivate = false): McpServerDefinition {
  return {
    command: 'notch',
    args: ['mcp', 'serve', '--store', storePath, ...(includePrivate ? ['--include-private'] : [])],
  };
}

export function mcpInstructions(
  client: string,
  storePath: string,
  projectRoot = process.cwd(),
  includePrivate = false,
): string {
  const server = notchMcpServerDefinition(storePath, includePrivate);
  const serverCommand = `notch mcp serve --store ${JSON.stringify(storePath)}${includePrivate ? ' --include-private' : ''}`;

  switch (client) {
    case 'claude-desktop':
      return `${clientHeading('Claude Desktop')}
Config file: ${claudeDesktopConfigPath()}

Server command:
${serverCommand}

Paste or verify this mcpServers entry:

${jsonSnippet(server)}

Private seed packets stay hidden unless you intentionally add --include-private to args.`;

    case 'claude-code':
      return `${clientHeading('Claude Code')}
Config file: ${path.join(projectRoot, '.mcp.json')}

Server command:
${serverCommand}

Paste or verify this project-local config:

${jsonSnippet(server)}

Delete .mcp.json to opt out for this project.`;

    case 'codex':
      return `${clientHeading('Codex')}
Config file: ${codexConfigPath()}

Server command:
${serverCommand}

Paste this TOML block:

[mcp_servers.3notch]
command = ${JSON.stringify(server.command)}
args = ${JSON.stringify(server.args)}

Private seed packets stay hidden unless you intentionally add --include-private to args.`;

    case 'cursor':
      return `${clientHeading('Cursor')}
Config file: ${path.join(projectRoot, '.cursor', 'mcp.json')}

Server command:
${serverCommand}

Paste or merge this JSON:

${jsonSnippet(server)}

Private seed packets stay hidden unless you intentionally add --include-private to args.`;

    case 'chatgpt-desktop':
      return `${clientHeading('ChatGPT Desktop')}
Config file: ${chatGptDesktopConfigPath()}

Server command:
${serverCommand}

Paste or merge this local MCP server definition:

${jsonSnippet(server)}

Private seed packets stay hidden unless you intentionally add --include-private to args.`;

    default:
      return `${clientHeading(client)}
Add 3Notch as a local MCP server with this command:

${serverCommand}

Private seed packets stay hidden unless you intentionally add --include-private.`;
  }
}

function clientHeading(label: string): string {
  return `${label} MCP setup`;
}

function jsonSnippet(server: McpServerDefinition): string {
  return JSON.stringify({ mcpServers: { '3notch': server } }, null, 2);
}

function claudeDesktopConfigPath(): string {
  const override = process.env.NOTCH_CLAUDE_DESKTOP_CONFIG_HOME;

  if (override) {
    return path.join(override, 'claude_desktop_config.json');
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  }

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? '%APPDATA%', 'Claude', 'claude_desktop_config.json');
  }

  return path.join(os.homedir(), '.config/Claude/claude_desktop_config.json');
}

function codexConfigPath(): string {
  if (process.platform === 'win32') {
    return path.join('%USERPROFILE%', '.codex', 'config.toml');
  }

  return '~/.codex/config.toml';
}

function chatGptDesktopConfigPath(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/ChatGPT/mcp_config.json');
  }

  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? '%APPDATA%', 'ChatGPT', 'mcp_config.json');
  }

  return path.join(os.homedir(), '.config/ChatGPT/mcp_config.json');
}
