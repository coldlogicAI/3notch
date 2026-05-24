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
});
