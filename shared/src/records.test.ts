import { describe, expect, it } from 'vitest';
import {
  clientCodeSchema,
  deviceIdSchema,
  normaliseClientCode,
  normaliseSignInName,
  recordKeys,
  storedClientSchema,
  storedOperatorSchema,
} from './records';

describe('the record keys', () => {
  it('Every tenant key is built from the minted id, and a code reaches its id through one index record', () => {
    const id = '3f2a91bc-0000-4000-8000-000000000001';
    const tenant = recordKeys.tenant(id);
    expect(tenant.config).toBe(`tenant.${id}.config`);
    expect(tenant.user('root')).toBe(`tenant.${id}.user.root`);
    expect(tenant.session('device-0001')).toBe(`tenant.${id}.session.device-0001`);
    expect(tenant.employee('p1')).toBe(`tenant.${id}.employee.p1`);
    expect(tenant.employee('p1').startsWith(tenant.employeePrefix)).toBe(true);
    expect(tenant.staffSetup).toBe(`tenant.${id}.staff-setup`);
    expect(recordKeys.client('acme')).toBe('client.acme');
    const other = recordKeys.tenant('3f2a91bc-0000-4000-8000-000000000002');
    expect(other.config).not.toBe(tenant.config);
  });

  it('keep the operator’s records apart from every tenant’s', () => {
    expect(recordKeys.operatorUser('operator')).toBe('operator.user.operator');
    expect(recordKeys.operatorSession('device-0001')).toBe('operator.session.device-0001');
  });
});

describe('a client code', () => {
  it('is 3 to 32 lowercase letters, digits and hyphens, a letter first and a letter or digit last', () => {
    for (const good of ['abc', 'a-1', 'acme-vn', `a${'b'.repeat(30)}c`, 'ab9']) {
      expect(clientCodeSchema.safeParse(good).success, good).toBe(true);
    }
    const bad = ['ab', 'Acme', '1abc', '-abc', 'abc-', 'a_bc', 'a bc', `a${'b'.repeat(31)}c`, ''];
    for (const code of bad) expect(clientCodeSchema.safeParse(code).success, code).toBe(false);
  });

  it('typed or linked in capitals, is lowered and trimmed, and nothing else is changed', () => {
    expect(normaliseClientCode('  ACME-Vn ')).toBe('acme-vn');
    expect(clientCodeSchema.safeParse(normaliseClientCode(' Acme '))).toMatchObject({
      success: true,
    });
  });
});

describe('the index prefix', () => {
  it('Only index records sit under `client.`: no other key the layout builds starts with it', () => {
    const tenant = recordKeys.tenant('3f2a91bc-0000-4000-8000-000000000001');
    const others = [
      recordKeys.operatorUser('operator'),
      recordKeys.operatorSession('device-0001'),
      tenant.config,
      tenant.user('root'),
      tenant.session('device-0001'),
      tenant.employee('p1'),
      tenant.employeePrefix,
      tenant.staffSetup,
    ];
    for (const key of others) expect(key.startsWith('client.'), key).toBe(false);
    expect(recordKeys.client('acme').startsWith(recordKeys.clientPrefix)).toBe(true);
    expect(recordKeys.clientPrefix).toBe('client.');
  });
});

describe('the index and the operator’s account', () => {
  it('An index made before the time was kept reads as none, and one with the time keeps it', () => {
    const id = '3f2a91bc-0000-4000-8000-000000000001';
    expect(storedClientSchema.parse({ id, name: 'Acme' }).madeAt).toBeUndefined();
    expect(storedClientSchema.parse({ id, name: 'Acme', madeAt: 1_700_000_000_000 }).madeAt).toBe(
      1_700_000_000_000,
    );
    expect(storedClientSchema.safeParse({ id, name: 'Acme', madeAt: 'soon' }).success).toBe(false);
  });

  it('hold an id and a name, and a hash, and nothing more', () => {
    const id = '3f2a91bc-0000-4000-8000-000000000001';
    expect(storedClientSchema.safeParse({ id, name: 'Acme' }).success).toBe(true);
    expect(storedClientSchema.safeParse({ id: 'acme', name: 'Acme' }).success).toBe(false);
    expect(storedOperatorSchema.safeParse({ passwordHash: 'h' }).success).toBe(true);
    expect(storedOperatorSchema.safeParse({ passwordHash: 'h', root: true }).success).toBe(false);
  });
});

describe('a sign-in name', () => {
  it('is one user whatever its case, spacing or Unicode form', () => {
    expect(normaliseSignInName('  Root ')).toBe('root');
    expect(normaliseSignInName('Đạt'.normalize('NFD'))).toBe(normaliseSignInName('ĐẠT'));
  });
});

describe('a device id', () => {
  it('is 8 to 64 letters, digits, dashes or underscores, never a dot', () => {
    expect(deviceIdSchema.safeParse('3f2a-91bc_ok').success).toBe(true);
    for (const bad of ['short', 'has.a.dot-1234', 'has space 1234', 'x'.repeat(65)]) {
      expect(deviceIdSchema.safeParse(bad).success).toBe(false);
    }
  });
});
