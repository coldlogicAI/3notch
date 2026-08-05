import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

import sharedSchema from '../../src/schemas/shared.schema.json' with { type: 'json' };
import { getMcpToolInputSchema, mcpToolInputSchemas } from '../../src/mcp/tool-schemas.js';

const expectedTools = [
  'get_brief',
  'create_brief',
  'list_briefs',
  'get_targeted_brief',
  'check_store',
  'create_mark',
  'create_packet',
  'create_reply',
  'import_packet',
  'list_packets',
  'get_packet',
  'create_seed_packet',
  'import_seed_packet',
  'inbox_init',
  'send_packet',
  'list_inbox',
  'pull_inbox_packet',
  'ack_inbox_delivery',
  'get_status',
  'run_doctor',
];

describe('MCP tool input schemas', () => {
  it('exports only the shipped MCP tools', () => {
    expect(Object.keys(mcpToolInputSchemas).sort()).toEqual([...expectedTools].sort());
    expect(Object.keys(mcpToolInputSchemas)).not.toContain('create_pass');
    expect(Object.keys(mcpToolInputSchemas)).not.toContain('record_decision');
  });

  it('enforces list_packets limit bounds', () => {
    const ajv = new Ajv2020({ strict: true });
    ajv.addSchema(sharedSchema);
    const validate = ajv.compile(getMcpToolInputSchema('list_packets'));

    expect(validate({ limit: 50 })).toBe(true);
    expect(validate({ limit: 51 })).toBe(false);
    expect(validate({ limit: 0 })).toBe(false);
  });

  it('accepts packet tags and supersedes fields', () => {
    const ajv = new Ajv2020({ strict: true });
    ajv.addSchema(sharedSchema);
    const validateCreate = ajv.compile(getMcpToolInputSchema('create_packet'));
    const validateList = ajv.compile(getMcpToolInputSchema('list_packets'));

    expect(validateCreate({
      summary: 'Continuation state.',
      supersedes: 'packet_previous_checkpoint',
      tags: ['continuation', 'stream-feature-a'],
      title: 'Continuation checkpoint',
    })).toBe(true);
    expect(validateList({ tags: ['continuation', 'stream-feature-a'] })).toBe(true);
  });

  it('fails closed on unsafe durable inbox addresses and delivery IDs', () => {
    const ajv = new Ajv2020({ strict: true });
    ajv.addSchema(sharedSchema);
    const validateSend = ajv.compile(getMcpToolInputSchema('send_packet'));
    const validatePull = ajv.compile(getMcpToolInputSchema('pull_inbox_packet'));

    expect(validateSend({ packetPath: '/tmp/packet.notchpkt', to: 'local:review-agent' })).toBe(true);
    expect(validateSend({ packetPath: '/tmp/packet.notchpkt', to: 'local:../review-agent' })).toBe(false);
    expect(validatePull({ deliveryId: 'delivery_aaaaaaaaaaaaaaaaaaaaaaaa', import: true })).toBe(true);
    expect(validatePull({ deliveryId: '../../delivery', import: true })).toBe(false);
  });
});
