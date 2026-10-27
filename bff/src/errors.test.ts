import { CStorageError } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { HttpError, replyFor } from './errors';

describe('what a failure answers', () => {
  it('answers the status a route chose, with its body', () => {
    expect(replyFor(new HttpError(409, 'Conflict', { current: null }))).toEqual({
      status: 409,
      body: { error: 'Conflict', current: null },
    });
  });

  it('answers 503 for a c-storage that did not answer or refused, never 401', () => {
    for (const status of [null, 401, 403, 412, 500, 503]) {
      const { status: answered, body } = replyFor(new CStorageError(status, 'x'));
      expect(answered, String(status)).toBe(503);
      expect(body).toEqual({ error: 'Service unavailable' });
    }
  });

  it('answers 500, the BFF’s own bug, when c-storage refuses a request as malformed', () => {
    expect(replyFor(new CStorageError(400, 'x'))).toEqual({
      status: 500,
      body: { error: 'Internal error' },
    });
  });

  it('answers a client error the framework raised as 400 without its cause, and the rest 500', () => {
    expect(replyFor({ statusCode: 415 })).toEqual({ status: 415, body: { error: 'Bad request' } });
    expect(replyFor({ statusCode: 502 }).status).toBe(500);
    expect(replyFor(new Error('boom'))).toEqual({
      status: 500,
      body: { error: 'Internal error' },
    });
  });
});
