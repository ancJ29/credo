import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { goBuildEnv } from './build';

describe('the environment c-storage is built in', () => {
  it('sets a build cache under the temp folder when none is set, and keeps one that is', () => {
    expect(goBuildEnv({}).GOCACHE).toBe(join(tmpdir(), 'credo-go-cache'));
    expect(goBuildEnv({ GOCACHE: '/elsewhere' }).GOCACHE).toBe('/elsewhere');
  });

  it('builds without cgo, and keeps the rest of the caller’s settings', () => {
    expect(goBuildEnv({ GOFLAGS: '-mod=mod', CGO_ENABLED: '1' })).toMatchObject({
      GOFLAGS: '-mod=mod',
      CGO_ENABLED: '0',
    });
  });
});
