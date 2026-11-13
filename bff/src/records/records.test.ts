import { recordKeys } from '@credo/shared';
import { describe, expect, it } from 'vitest';
import { replyFor } from '../errors';
import { type RecordStore, tenantStorage } from './records';

const TENANT = '3f2c1d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const OTHER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OWN = recordKeys.tenant(TENANT);
const THEIRS = recordKeys.tenant(OTHER);
/** An id that begins with the company's own. */
const LONGER = recordKeys.tenant(`${TENANT}0`);

/** A fake client that records every call it is sent, in order, and answers a fixed way. */
function fake() {
  const sent: string[] = [];
  const store: RecordStore = {
    getRecord: (key) => {
      sent.push(`get ${key}`);
      return Promise.resolve({ data: { key }, tag: 't1' });
    },
    listRecords: (prefix) => {
      sent.push(`list ${prefix}`);
      return Promise.resolve({ records: [{ key: `${prefix}x`, data: 1, tag: 't2' }], more: false });
    },
    putRecord: (key, _data, ifTag) => {
      sent.push(`put ${key} ${String(ifTag)}`);
      return Promise.resolve(ifTag === 'old' ? 'moved' : 'saved');
    },
    removeRecord: (key, ifTag) => {
      sent.push(`remove ${key} ${String(ifTag)}`);
      return Promise.resolve(ifTag === 'old' ? 'moved' : 'removed');
    },
  };
  return { sent, client: tenantStorage(store, TENANT) };
}

describe('a company client', () => {
  it('refuses a read, a write and a removal of a key outside the company, sending nothing', () => {
    const { sent, client } = fake();
    const key = THEIRS.customer('c1');
    expect(() => client.getRecord(key)).toThrow('GET a record outside');
    expect(() => client.putRecord(key, {}, null)).toThrow('POST a record outside');
    expect(() => client.removeRecord(key)).toThrow('DELETE a record outside');
    expect(sent).toEqual([]);
  });

  it('refuses a list under a prefix outside the company and sends one under its own', async () => {
    const { sent, client } = fake();
    expect(() => client.listRecords(THEIRS.customerPrefix)).toThrow('GET a list outside');
    expect(() => client.listRecords('')).toThrow('GET a list outside');
    expect(sent).toEqual([]);
    await client.listRecords(OWN.customerPrefix);
    await client.listRecords(OWN.all);
    expect(sent).toEqual([`list ${OWN.customerPrefix}`, `list ${OWN.all}`]);
  });

  it("refuses the prefix without its last dot and an id that begins with the company's", () => {
    const { sent, client } = fake();
    expect(() => client.listRecords(OWN.all.slice(0, -1))).toThrow('GET a list outside');
    expect(() => client.listRecords(LONGER.all)).toThrow('GET a list outside');
    expect(() => client.getRecord(LONGER.customer('c1'))).toThrow('GET a record outside');
    expect(sent).toEqual([]);
  });

  it('sends a key inside the company as given and returns the answer unchanged', async () => {
    const { sent, client } = fake();
    const key = OWN.customer('c1');
    expect(client.tenantId).toBe(TENANT);
    expect(await client.getRecord(key)).toEqual({ data: { key }, tag: 't1' });
    expect(await client.listRecords(OWN.customerPrefix)).toEqual({
      records: [{ key: `${OWN.customerPrefix}x`, data: 1, tag: 't2' }],
      more: false,
    });
    expect(await client.putRecord(key, {}, null)).toBe('saved');
    expect(await client.putRecord(key, {}, 'old')).toBe('moved');
    expect(await client.removeRecord(key, 'new')).toBe('removed');
    expect(await client.removeRecord(key, 'old')).toBe('moved');
    expect(sent).toEqual([
      `get ${key}`,
      `list ${OWN.customerPrefix}`,
      `put ${key} null`,
      `put ${key} old`,
      `remove ${key} new`,
      `remove ${key} old`,
    ]);
  });

  it('names the call and never the key, and answers 500', () => {
    const { client } = fake();
    const key = THEIRS.user('someone@example.com');
    let fault: unknown;
    try {
      void client.getRecord(key);
    } catch (error) {
      fault = error;
    }
    expect(fault).toBeInstanceOf(Error);
    const { message } = fault as Error;
    expect(message).toContain('GET a record');
    expect(message).not.toContain(OTHER);
    expect(message).not.toContain('someone@example.com');
    expect(replyFor(fault)).toEqual({ status: 500, body: { error: 'Internal error' } });
  });
});
