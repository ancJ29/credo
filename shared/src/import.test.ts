import { describe, expect, it } from 'vitest';
import { DEMO_EMPLOYEES } from './demo';
import {
  IMPORT_CALL_ROWS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_ROUTE,
  importEmployeesReplySchema,
  importEmployeesRequestSchema,
} from './import';

const row = { name: 'Mai Linh', extra: {} };

describe('the import’s contract', () => {
  it('The file is read in the root’s browser alone; one over 2 MB or 500 rows is refused before reading; the BFF takes rows as JSON, at most 100 a call', () => {
    expect(IMPORT_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(IMPORT_MAX_ROWS).toBe(500);
    expect(IMPORT_CALL_ROWS).toBe(100);
    expect(IMPORT_ROUTE).toBe('/api/employees/import');

    const rows = (count: number) => ({ rows: Array.from({ length: count }, () => row) });
    expect(importEmployeesRequestSchema.safeParse(rows(100)).success).toBe(true);
    expect(importEmployeesRequestSchema.safeParse(rows(101)).success).toBe(false);
    expect(importEmployeesRequestSchema.safeParse(rows(0)).success).toBe(false);
  });

  it('Each row is checked as one add: a row the add refuses is refused here', () => {
    const request = (value: object) => importEmployeesRequestSchema.safeParse({ rows: [value]});
    expect(request({ ...row, code: 'EMP-0100', departmentId: null }).success).toBe(true);
    expect(request({ ...row, code: 'a b' }).success).toBe(false);
    expect(request({ extra: {} }).success).toBe(false);
    expect(request({ ...row, extra: JSON.parse('{"__proto__":1}') }).success).toBe(false);
    expect(request({ ...row, password: 'x' }).success).toBe(false);
  });

  it('An answer holds one result for each row: the person added, or why it was refused', () => {
    const reply = {
      results: [
        { kind: 'added', employee: DEMO_EMPLOYEES[0] },
        { kind: 'refused', reason: 'taken' },
        { kind: 'refused', reason: 'invalid' },
      ],
    };

    expect(importEmployeesReplySchema.safeParse(reply).data).toEqual(reply);
    expect(
      importEmployeesReplySchema.safeParse({ results: [{ kind: 'refused', reason: 'other' }] })
        .success,
    ).toBe(false);
    expect(importEmployeesReplySchema.safeParse({ results: [{ kind: 'added' }] }).success).toBe(
      false,
    );
  });
});
