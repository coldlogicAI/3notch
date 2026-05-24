import { parseMarkdownWithFrontmatter, hasMarkdownHeading } from './markdown-service.js';
import { schemaService, type SchemaName, type SchemaValidationResult } from './schema-service.js';
import type { NotchError } from '../types/errors.js';
import type { NotchBrief, NotchPacket, ProjectBrief, RecordType } from '../types/records.js';

export type ParsedRecord = {
  body: string;
  metadata: Record<string, unknown>;
  path?: string;
};

export type RecordParserResult<T extends ParsedRecord = ParsedRecord> =
  | { ok: true; record: T; warnings: NotchError[] }
  | { errors: NotchError[]; ok: false; warnings: NotchError[] };

const headingRequirements: Record<Exclude<RecordType, 'config'>, string[]> = {
  brief: [
    '## Goal For',
    '## Relevant Background',
    '## Prior Reasoning Summary',
    '## Design Basis',
    '## Relevant Files And Sources',
    '## Known Pitfalls',
    '## Recommended Next Steps',
  ],
  packet: ['## Summary', '## Recipient', '## Origin', '## Included Context', '## Source Links', '## Import Notes'],
  project_brief: [
    '## Current Focus',
    '## Active Constraints',
    '## Recent Activity',
    '## Open Threads',
    '## Warnings',
  ],
};

const schemaByRecordType: Record<Exclude<RecordType, 'config'>, SchemaName> = {
  brief: 'brief',
  packet: 'packet',
  project_brief: 'projectBrief',
};

export function parseRecordMarkdown(markdown: string, path?: string): RecordParserResult {
  const parsed = parseMarkdownWithFrontmatter(markdown, path);

  if (!parsed.ok) {
    return { errors: parsed.errors, ok: false, warnings: [] };
  }

  return {
    ok: true,
    record: {
      body: parsed.body,
      metadata: parsed.data,
      ...(path ? { path } : {}),
    },
    warnings: [],
  };
}

export function parseAndValidateRecord<T extends NotchBrief | NotchPacket | ProjectBrief>(
  markdown: string,
  path?: string,
): SchemaValidationResult<T> & { body?: string } {
  const parsed = parseRecordMarkdown(markdown, path);

  if (!parsed.ok) {
    return { errors: parsed.errors, ok: false, warnings: [] };
  }

  const recordType = parsed.record.metadata.recordType;

  if (!isMarkdownRecordType(recordType)) {
    return {
      errors: [
        {
          code: 'NOTCH_RECORD_INVALID',
          field: '/recordType',
          message: 'Record frontmatter must include a supported recordType.',
          ...(path ? { path } : {}),
          recovery: 'Set recordType to project_brief, brief, or packet.',
          severity: 'error',
          exitCode: 1,
        },
      ],
      ok: false,
      warnings: [],
    };
  }

  const requiredHeadings =
    recordType === 'packet' && parsed.record.metadata.purpose === 'seed'
      ? [
          ...headingRequirements.packet,
          '## User Preferences',
          '## Workflow Conventions',
          '## Lessons From Prior Work',
          '## What Not To Carry Forward',
        ]
      : headingRequirements[recordType];
  const headingErrors = validateRequiredHeadings(parsed.record.body, requiredHeadings, path);

  if (headingErrors.length > 0) {
    return { errors: headingErrors, ok: false, warnings: [] };
  }

  const validation = schemaService.validate<T>(schemaByRecordType[recordType], parsed.record.metadata, path);

  if (!validation.ok) {
    return validation;
  }

  return { body: parsed.record.body, data: validation.data, ok: true, warnings: validation.warnings };
}

function isMarkdownRecordType(value: unknown): value is Exclude<RecordType, 'config'> {
  return value === 'project_brief' || value === 'brief' || value === 'packet';
}

function validateRequiredHeadings(body: string, headings: string[], path?: string): NotchError[] {
  return headings
    .filter((heading) => {
      if (heading === '## Goal For') {
        return !body
          .split(/\r?\n/)
          .some((line) => line.trim().toLowerCase().startsWith('## goal for '));
      }

      return !hasMarkdownHeading(body, heading);
    })
    .map((heading) => ({
      code: 'NOTCH_RECORD_INVALID',
      field: 'body',
      message: `Record body is missing required heading: ${heading}`,
      ...(path ? { path } : {}),
      recovery: 'Add the required Markdown heading to the record body.',
      severity: 'error',
      exitCode: 1,
    }));
}
