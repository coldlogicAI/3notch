export type NotchErrorSeverity = 'info' | 'warn' | 'error';

export type NotchError = {
  code: string;
  message: string;
  severity: NotchErrorSeverity;
  path?: string;
  field?: string;
  details?: unknown;
  recovery?: string;
  exitCode?: number;
};

export class NotchException extends Error {
  readonly notchError: NotchError;

  constructor(notchError: NotchError) {
    super(notchError.message);
    this.name = 'NotchException';
    this.notchError = notchError;
  }
}

export function notchError(input: NotchError): NotchError {
  return input;
}

export function isNotchException(error: unknown): error is NotchException {
  return error instanceof NotchException;
}

export function errorToNotchError(error: unknown): NotchError {
  if (isNotchException(error)) {
    return error.notchError;
  }

  if (error instanceof Error) {
    return {
      code: 'NOTCH_INTERNAL_ERROR',
      message: error.message,
      severity: 'error',
      exitCode: 10,
    };
  }

  return {
    code: 'NOTCH_INTERNAL_ERROR',
    message: String(error),
    severity: 'error',
    exitCode: 10,
  };
}
