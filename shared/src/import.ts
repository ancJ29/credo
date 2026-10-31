import { z } from 'zod';
import { employeeSchema } from './staff';

/** The limits of staff read from an Excel file. The file is read in the root's browser alone: one
 * over the size or the rows is refused before it is read, and the BFF takes the rows as JSON. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 500;
/** The most rows one call to the BFF takes. */
export const IMPORT_CALL_ROWS = 100;

/** The import's route, under the employees. */
export const IMPORT_ROUTE = '/api/employees/import';

/** A call as the BFF first reads it: only that it holds one to a call's rows. Each row is then
 * checked as one add, so a row the add refuses is that row's result, not the call's 400. */
export const importCallSchema = z.strictObject({
  rows: z.array(z.unknown()).min(1).max(IMPORT_CALL_ROWS),
});

/** What became of a row: the person added, without a sign-in, or the reason it was not: refused
 * (its code was taken meanwhile, or the add would have refused it), or `busy` (the system could
 * not answer for the row: it is to be tried again, and the call went on to the next row). A row's
 * place in the reply is its place in the call, so no result carries a row number. */
export const importRefusedSchema = z.strictObject({
  kind: z.literal('refused'),
  reason: z.enum(['taken', 'invalid', 'busy']),
});
export const importResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('added'), employee: employeeSchema }),
  importRefusedSchema,
]);
export type ImportResult = z.infer<typeof importResultSchema>;

/** One result for each row sent, in the order sent. */
export const importEmployeesReplySchema = z.strictObject({ results: z.array(importResultSchema) });
export type ImportEmployeesReply = z.infer<typeof importEmployeesReplySchema>;
