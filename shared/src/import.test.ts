import { describe, expect, it } from 'vitest';
import { DEMO_EMPLOYEES } from './demo';
import {
  IMPORT_CALL_ROWS,
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  IMPORT_ROUTE,
  importCallSchema,
  importEmployeesReplySchema,
} from './import';

const row = { name: 'Mai Linh', extra: {} };

describe('the import’s contract', () => {
  it('The file is read in the root’s browser alone; one over 2 MB or 500 rows is refused before reading; the BFF takes rows as JSON, at most 100 a call', () => {
    expect(IMPORT_MAX_BYTES).toBe(2 * 1024 * 1024);
    expect(IMPORT_MAX_ROWS).toBe(500);
    expect(IMPORT_CALL_ROWS).toBe(100);
    expect(IMPORT_ROUTE).toBe('/api/employees/import');
  });

  it('A call is read first as one to a call’s rows of anything, so a row the add refuses is that row’s result and not the call’s refusal', () => {
    const call = (rows: unknown[]) => importCallSchema.safeParse({ rows }).success;
    expect(call(Array.from({ length: IMPORT_CALL_ROWS }, () => 'not a row'))).toBe(true);
    expect(call(Array.from({ length: IMPORT_CALL_ROWS + 1 }, () => row))).toBe(false);
    expect(call([])).toBe(false);
    expect(importCallSchema.safeParse({ rows: [row], other: 1 }).success).toBe(false);
  });

  it('An answer holds one result for each row: the person added, or why it was not (refused, or the system was busy)', () => {
    const reply = {
      results: [
        { kind: 'added', employee: DEMO_EMPLOYEES[0] },
        { kind: 'refused', reason: 'taken' },
        { kind: 'refused', reason: 'invalid' },
        { kind: 'refused', reason: 'busy' },
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
