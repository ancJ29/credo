import { z } from 'zod';
import { addEmployeeRequestSchema, employeeSchema } from './staff';

/** The limits of staff read from an Excel file. The file is read in the root's browser alone: one
 * over the size or the rows is refused before it is read, and the BFF takes the rows as JSON. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 500;
/** The most rows one call to the BFF takes. */
export const IMPORT_CALL_ROWS = 100;

/** The import's route, under the employees. */
export const IMPORT_ROUTE = '/api/employees/import';

/** Up to a call's rows, each checked as one add by hand. Only the root imports. */
export const importEmployeesRequestSchema = z.strictObject({
  rows: z.array(addEmployeeRequestSchema).min(1).max(IMPORT_CALL_ROWS),
});
export type ImportEmployeesRequest = z.infer<typeof importEmployeesRequestSchema>;

/** What became of a row: the person added, without a sign-in, or the reason it was refused (its
 * code was taken meanwhile, or the add would have refused it). */
export const importResultSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('added'), employee: employeeSchema }),
  z.strictObject({ kind: z.literal('refused'), reason: z.enum(['taken', 'invalid']) }),
]);
export type ImportResult = z.infer<typeof importResultSchema>;

/** One result for each row sent, in the order sent. */
export const importEmployeesReplySchema = z.strictObject({ results: z.array(importResultSchema) });
export type ImportEmployeesReply = z.infer<typeof importEmployeesReplySchema>;
