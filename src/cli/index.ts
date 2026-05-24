import { createProgram } from './program.js';
import { handleCliError } from './errors.js';

export async function run(argv: string[] = process.argv): Promise<void> {
  try {
    await createProgram().parseAsync(argv);
  } catch (error) {
    handleCliError(error, { json: argv.includes('--json') });
  }
}

await run();
