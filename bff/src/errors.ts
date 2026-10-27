import { CStorageError } from '@credo/shared';

/** An answer the route chose, with the body a caller reads. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Only a 401 signs the UI out, so an outage must never read as one: any c-storage failure is
 * 503 and what no route expected is 500 with nothing of its cause. A c-storage 400 is the BFF's
 * own bug (a request it should have refused or formed better), so it is a 500 and logged. */
export function replyFor(error: unknown) {
  if (error instanceof HttpError) {
    return { status: error.status, body: { error: error.message, ...error.extra } };
  }
  if (error instanceof CStorageError && error.status !== 400) {
    return { status: 503, body: { error: 'Service unavailable' } };
  }
  const status =
    typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : null;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return { status, body: { error: 'Bad request' } };
  }
  return { status: 500, body: { error: 'Internal error' } };
}
