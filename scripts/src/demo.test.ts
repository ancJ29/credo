import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runDemo } from './cli';
import { staffAsOf } from './demo/staff';
import { type Artifacts, buildArtifacts } from './stack';

let dir: string;
let artifacts: Artifacts;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'credo-demo-test-'));
  artifacts = await buildArtifacts(dir);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const build = () => Promise.resolve(artifacts);
const NOW = () => Date.parse('2026-10-29T03:00:00Z');

describe('pnpm demo', () => {
  it('row 22: a command reads each copy’s staff count through the API, and it is the count the generator says', async () => {
    const file = join(dir, 'counts.json');
    const script = `
      const env = process.env;
      const call = async (path, code, auth, body) => {
        const response = await fetch(env.CREDO_URL + path, {
          method: body ? 'POST' : 'GET',
          body: body && JSON.stringify(body),
          headers: {
            'content-type': 'application/json',
            'x-device-id': 'device-aaaa-0001',
            'x-client-code': code,
            ...(auth ? { 'x-auth-id': auth } : {}),
          },
        });
        return response.json();
      };
      (async () => {
        const counts = {};
        for (const copy of JSON.parse(env.CREDO_COPIES)) {
          const session = await call('/api/auth/sign-in', copy.code, null, { name: copy.rootName, password: copy.rootPassword });
          const staff = await call('/api/employees', copy.code, session.authId);
          const config = await call('/api/config', copy.code);
          counts[copy.code] = { scenario: copy.scenario, name: config.config.name, people: staff.employees.length, left: staff.employees.filter((p) => p.archived).length };
        }
        require('fs').writeFileSync(${JSON.stringify(file)}, JSON.stringify(counts));
      })();`;
    const printed: string[] = [];

    const status = await runDemo(
      ['--', process.execPath, '-e', script],
      build,
      (line) => void printed.push(line),
      {
        partner: 'p3',
        now: NOW,
      },
    );

    expect(status).toBe(0);
    const counts = JSON.parse(await readFile(file, 'utf8')) as Record<
      string,
      { scenario: 'S1' | 'S2'; name: string; people: number; left: number }
    >;
    expect(Object.keys(counts).sort()).toEqual([
      'phan-phoi-loc-vuong-hai-3',
      'vat-lieu-quang-tin-dat-3',
    ]);
    expect(counts['vat-lieu-quang-tin-dat-3']).toMatchObject({
      scenario: 'S1',
      name: 'Vật liệu Quảng Tín Đạt',
    });
    for (const [code, { scenario, people, left }] of Object.entries(counts)) {
      const client = scenario === 'S1' ? 'A' : 'B';
      const expected = staffAsOf(client, scenario, '2026-10-29');
      expect(people, code).toBe(expected.length);
      expect(left, code).toBe(expected.filter((p) => p.archived).length);
    }
    expect(printed).toContain('making the demo copies');
    expect(printed.join('\n')).not.toContain('password');
  });

  it('with no command prints each copy’s link and root password once and waits for Ctrl-C', async () => {
    const printed: string[] = [];
    const running = runDemo([], build, (line) => void printed.push(line), {
      partner: 'p3',
      now: NOW,
    });
    while (!printed.some((line) => line.includes('Ctrl-C'))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    process.emit('SIGINT');

    expect(await running).toBe(0);
    expect(printed.filter((line) => /\/login\?client-code=[a-z0-9-]+-3$/.test(line))).toHaveLength(
      2,
    );
    expect(printed.filter((line) => line.includes('with the password'))).toHaveLength(2);
    expect(printed.filter((line) => /\/operator$/.test(line))).toHaveLength(1);
  });

  it('stops, with the stack taken down, when no copy is in the mapping for the partner', async () => {
    await expect(
      runDemo([], build, () => undefined, { partner: 'nobody', now: NOW }),
    ).rejects.toThrow('no copy in the mapping');
  });

  it('takes the clock from the machine when none is given', async () => {
    const script = `process.exit(0)`;
    expect(
      await runDemo(['--', process.execPath, '-e', script], build, () => undefined, {
        partner: 'p3',
      }),
    ).toBe(0);
  });
});
