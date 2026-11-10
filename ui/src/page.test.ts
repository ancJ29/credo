import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api';
import { refusal } from './page';

describe('a refusal on a page', () => {
  const props = () => ({
    api: {} as never,
    user: { name: 'x', root: false, permissions: {} },
    onSignedOut: vi.fn(),
    onForbidden: vi.fn(),
  });

  it('A 401 signs the person out and a 403 reads who they are again; any other failure is the page’s own', () => {
    const out = props();
    refusal(new ApiError(401), out);
    expect(out.onSignedOut).toHaveBeenCalledOnce();
    expect(out.onForbidden).not.toHaveBeenCalled();

    const forbidden = props();
    refusal(new ApiError(403), forbidden);
    expect(forbidden.onForbidden).toHaveBeenCalledOnce();
    expect(forbidden.onSignedOut).not.toHaveBeenCalled();

    const other = props();
    refusal(new ApiError(503), other);
    refusal(new TypeError('boom'), other);
    expect(other.onSignedOut).not.toHaveBeenCalled();
    expect(other.onForbidden).not.toHaveBeenCalled();
  });
});

describe('a refusal names its kind', () => {
  it('Returns signedOut on a 401, forbidden on a 403 and failed otherwise', () => {
    const page = { onSignedOut: vi.fn(), onForbidden: vi.fn() };
    expect(refusal(new ApiError(401), page)).toBe('signedOut');
    expect(refusal(new ApiError(403), page)).toBe('forbidden');
    expect(refusal(new ApiError(503), page)).toBe('failed');
    expect(refusal(new TypeError('boom'), page)).toBe('failed');
  });
});

describe('a refusal on a page with no 403 to answer', () => {
  it('A 403 is the page’s own failure there, and a 401 still signs out', () => {
    const onSignedOut = vi.fn();
    expect(() => refusal(new ApiError(403), { onSignedOut })).not.toThrow();
    expect(onSignedOut).not.toHaveBeenCalled();
    refusal(new ApiError(401), { onSignedOut });
    expect(onSignedOut).toHaveBeenCalledOnce();
  });
});
