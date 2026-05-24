import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

type ConnectableMcpServer = {
  close?: () => Promise<void>;
  connect: (transport: Transport) => Promise<void>;
};

export type McpHarness = {
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  client: Client;
  close: () => Promise<void>;
  listTools: () => Promise<string[]>;
};

export async function createMcpHarness(server: ConnectableMcpServer): Promise<McpHarness> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: '3notch-test-client', version: '1.0.0' });

  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  return {
    callTool: async (name, args = {}) => {
      return await client.callTool({ name, arguments: args });
    },
    client,
    close: async () => {
      await client.close();
      await server.close?.();
    },
    listTools: async () => {
      const response = await client.listTools();
      return response.tools.map((tool) => tool.name);
    },
  };
}
