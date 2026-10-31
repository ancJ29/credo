import { z } from 'zod';
import { extraInputSchema, extraSchema } from './extra';
import { importRefusedSchema } from './import';
import { codeSchema, employeeCodeIsValid, nameSchema } from './staff';

/** The customers and the products the company sells to and sells: what the BFF reasons about is
 * typed, the rest (a phone, an address, a note) is in `extra`. A code is the employee's rule,
 * reused: 2 to 20 of A to Z, digits and hyphens, in capitals, unique in its list. */
export const customerSchema = z.strictObject({
  id: z.uuid(),
  code: codeSchema,
  name: nameSchema,
  extra: extraSchema,
});
export type Customer = z.infer<typeof customerSchema>;

/** The most a unit is: a bag, a tonne, a thousand bricks. */
export const UNIT_MAX = 20;
/** A price in whole đồng, above zero and no more than 10¹². */
export const PRICE_MAX = 10 ** 12;
const unitSchema = z.string().trim().min(1).max(UNIT_MAX);
export const priceSchema = z.number().int().min(1).max(PRICE_MAX);

export const productSchema = z.strictObject({
  id: z.uuid(),
  code: codeSchema,
  name: nameSchema,
  unit: unitSchema,
  price: priceSchema,
  /** Whether its stock is kept (Quản lý tồn kho): typed, since the stock piece's BFF relies on it. */
  stocked: z.boolean(),
  extra: extraSchema,
});
export type Product = z.infer<typeof productSchema>;

export const customerListReplySchema = z.strictObject({ customers: z.array(customerSchema) });
export const productListReplySchema = z.strictObject({ products: z.array(productSchema) });

/** An add as the import reads each row. The code is required, as typed in any case. */
const typedCode = z.string().refine(employeeCodeIsValid, 'a code');
export const addCustomerRequestSchema = z.strictObject({
  code: typedCode,
  name: nameSchema,
  extra: extraInputSchema,
});
export type AddCustomerRequest = z.infer<typeof addCustomerRequestSchema>;
export const addProductRequestSchema = z.strictObject({
  code: typedCode,
  name: nameSchema,
  unit: unitSchema,
  price: priceSchema,
  stocked: z.boolean(),
  extra: extraInputSchema,
});
export type AddProductRequest = z.infer<typeof addProductRequestSchema>;

/** One result for each row sent, in the order sent: the record added, or why it was not, as the
 * staff import's results are. Both lists' imports use it, each with its own record. */
export const importReplyOf = <T extends z.ZodType>(record: T) =>
  z.strictObject({
    results: z.array(
      z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('added'), record }),
        importRefusedSchema,
      ]),
    ),
  });
export const importCustomersReplySchema = importReplyOf(customerSchema);
export type ImportCustomersReply = z.infer<typeof importCustomersReplySchema>;
export const importProductsReplySchema = importReplyOf(productSchema);
export type ImportProductsReply = z.infer<typeof importProductsReplySchema>;
