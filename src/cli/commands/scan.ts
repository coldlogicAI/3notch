import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { scanForSecrets, type SecretFinding } from '../../core/secret-scan-service.js';
import { NotchException } from '../../types/errors.js';

export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('scan a file or stdin for sensitive patterns')
    .argument('[file-or-stdin]', 'file path or - for stdin', '-')
    .action(async (inputPath: string, _options: unknown, command: Command) => {
      const context = getCliContext(command);
      const input = await readScanInput(inputPath, context.cwd);
      const findings = scanForSecrets(input.content, undefined, { path: input.label });

      if (context.output.json) {
        printJson({ clean: findings.length === 0, findings });
      } else if (findings.length === 0) {
        printInfo('No sensitive patterns found.', context.output);
      } else {
        printInfo(`Sensitive pattern scan found ${findings.length} issue${findings.length === 1 ? '' : 's'}.`, context.output);
        for (const finding of findings) {
          printInfo(`- ${formatFinding(finding)}`, context.output);
        }
      }

      if (findings.length > 0) {
        process.exitCode = 1;
      }
    });
}

async function readScanInput(inputPath: string, cwd: string | undefined): Promise<{ content: string; label: string }> {
  if (inputPath === '-') {
    return {
      content: await readStdin(),
      label: 'stdin',
    };
  }

  const absolutePath = path.resolve(cwd ?? process.cwd(), inputPath);

  try {
    return {
      content: await readFile(absolutePath, 'utf8'),
      label: absolutePath,
    };
  } catch (error) {
    throw new NotchException({
      code: 'NOTCH_SCAN_INPUT_NOT_FOUND',
      message: error instanceof Error ? error.message : `Could not read ${inputPath}.`,
      path: absolutePath,
      recovery: 'Pass an existing text file path or - to read from stdin.',
      severity: 'error',
      exitCode: 2,
    });
  }
}

async function readStdin(): Promise<string> {
  let data = '';

  for await (const chunk of process.stdin) {
    data += String(chunk);
  }

  return data;
}

function formatFinding(finding: SecretFinding): string {
  const location = [
    finding.path,
    finding.line ? `line ${finding.line}` : undefined,
    finding.field,
  ].filter(Boolean).join(' ');
  const excerpt = finding.excerpt ? ` (${finding.excerpt})` : '';

  return `${finding.pattern}${location ? ` at ${location}` : ''}: ${finding.message}${excerpt}`;
}
