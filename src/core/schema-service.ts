import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';

import auditSchema from '../schemas/audit.schema.json' with { type: 'json' };
import briefSchema from '../schemas/brief.schema.json' with { type: 'json' };
import configSchema from '../schemas/config.schema.json' with { type: 'json' };
import mcpToolsSchema from '../schemas/mcp-tools.schema.json' with { type: 'json' };
import packetSchema from '../schemas/packet.schema.json' with { type: 'json' };
import projectBriefSchema from '../schemas/project-brief.schema.json' with { type: 'json' };
import sharedSchema from '../schemas/shared.schema.json' with { type: 'json' };
import statusSchema from '../schemas/status.schema.json' with { type: 'json' };
import type { NotchError } from '../types/errors.js';

export const SCHEMA_IDS = {
  audit: 'https://3notch.dev/schemas/audit.schema.json',
  brief: 'https://3notch.dev/schemas/brief.schema.json',
  config: 'https://3notch.dev/schemas/config.schema.json',
  mcpTools: 'https://3notch.dev/schemas/mcp-tools.schema.json',
  packet: 'https://3notch.dev/schemas/packet.schema.json',
  projectBrief: 'https://3notch.dev/schemas/project-brief.schema.json',
  shared: 'https://3notch.dev/schemas/shared.schema.json',
  status: 'https://3notch.dev/schemas/status.schema.json',
} as const;

export type SchemaName = keyof typeof SCHEMA_IDS;

export type SchemaValidationResult<T = unknown> =
  | { ok: true; data: T; warnings: NotchError[] }
  | { errors: NotchError[]; ok: false; warnings: NotchError[] };

const schemas = {
  audit: auditSchema,
  brief: briefSchema,
  config: configSchema,
  mcpTools: mcpToolsSchema,
  packet: packetSchema,
  projectBrief: projectBriefSchema,
  shared: sharedSchema,
  status: statusSchema,
};

export class SchemaService {
  private readonly ajv: Ajv2020;
  private readonly validators = new Map<SchemaName, ValidateFunction>();

  constructor() {
    this.ajv = new Ajv2020({
      allErrors: true,
      allowUnionTypes: false,
      strict: true,
      validateSchema: true,
    });

    this.ajv.addSchema(sharedSchema);

    for (const [name, schema] of Object.entries(schemas) as Array<[SchemaName, object]>) {
      if (name !== 'shared') {
        this.ajv.addSchema(schema);
      }
    }
  }

  validate<T = unknown>(schemaName: SchemaName, data: unknown, path?: string): SchemaValidationResult<T> {
    const validator = this.validatorFor(schemaName);
    const ok = validator(data);

    if (ok) {
      return { ok: true, data: data as T, warnings: [] };
    }

    return {
      errors: this.formatAjvErrors(validator.errors ?? [], path),
      ok: false,
      warnings: [],
    };
  }

  private validatorFor(schemaName: SchemaName): ValidateFunction {
    const cached = this.validators.get(schemaName);

    if (cached) {
      return cached;
    }

    const schemaId = SCHEMA_IDS[schemaName];
    const validator = this.ajv.getSchema(schemaId);

    if (!validator) {
      throw new Error(`Schema not registered: ${schemaId}`);
    }

    this.validators.set(schemaName, validator);
    return validator;
  }

  private formatAjvErrors(errors: ErrorObject[], path?: string): NotchError[] {
    return errors.map((error) => ({
      code: 'NOTCH_RECORD_INVALID',
      field: error.instancePath || error.schemaPath,
      message: `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`.trim(),
      ...(path ? { path } : {}),
      recovery: 'Edit the record so it matches the 3Notch V1 schema.',
      severity: 'error',
      details: {
        keyword: error.keyword,
        params: error.params,
      },
      exitCode: 1,
    }));
  }
}

export const schemaService = new SchemaService();
