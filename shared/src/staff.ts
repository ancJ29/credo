import { z } from 'zod';
import { extraInputSchema, extraSchema } from './extra';
import {
  type CustomField,
  customFieldsSchema,
  DEFAULT_NUMBERING,
  type Numbering,
  numberingSchema,
  type StaffFields,
  staffFieldsSchema,
} from './fields';
import { permissionLayerSchema } from './permissions';
import { tagSchema } from './wire';

/** A code is 2 to 20 of the letters A to Z, digits and hyphens, unique in any case: a code is
 * typed in any case and kept in capitals. */
const EMPLOYEE_CODE = /^[A-Z0-9-]{2,20}$/;
export const normaliseEmployeeCode = (raw: string) => raw.trim().toUpperCase();
/** The list's order, code order: the one comparison the BFF's list and the fake's both sort by, so
 * the page shows the list as it is answered. */
export const byCode = (a: { code: string }, b: { code: string }) => (a.code < b.code ? -1 : 1);
export const employeeCodeIsValid = (raw: string) => EMPLOYEE_CODE.test(normaliseEmployeeCode(raw));

/** 8 to 128 printable characters (spaces inside, any script, no control or format character) with a
 * capital, a small letter, a digit and one of `@$!%*?&`, and no space at either end: it would not
 * show on the screen the password is shown once on. */
const PASSWORD = /^(?!\s)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[^\p{C}]{8,128}(?<!\s)$/u;
export const passwordIsValid = (password: string) => PASSWORD.test(password);

const nameSchema = z.string().trim().min(1).max(200);

/** A department or position as a person names it: the minted id, and the name as it was saved,
 * which shows when the unit has since been removed. */
export const unitLinkSchema = z.strictObject({ id: z.uuid(), name: z.string() });
export type UnitLink = z.infer<typeof unitLinkSchema>;

/** A person: what the BFF reasons about is typed; the phone, the note and a company's own fields
 * are in `extra`. */
export const employeeSchema = z.strictObject({
  id: z.uuid(),
  code: z.string().regex(EMPLOYEE_CODE),
  name: nameSchema,
  department: unitLinkSchema.nullable(),
  position: unitLinkSchema.nullable(),
  /** Only what differs from the position's, and the department's. */
  permissions: permissionLayerSchema.default({}),
  archived: z.boolean().default(false),
  extra: extraSchema,
});
export type Employee = z.infer<typeof employeeSchema>;

/** A person with the version they were read at, and how they sign in: by their code, once the root
 * has given them a password. */
export const employeeDocSchema = z.strictObject({
  employee: employeeSchema,
  version: z.string(),
  signIn: z.strictObject({ name: z.string(), ready: z.boolean() }),
});
export type EmployeeDoc = z.infer<typeof employeeDocSchema>;

export const employeeListReplySchema = z.strictObject({ employees: z.array(employeeSchema) });
export type EmployeeListReply = z.infer<typeof employeeListReplySchema>;

/** Adding a person. Only the root's add carries a department and a position, and gets a first
 * password back. A code left out is numbered by the BFF. */
export const addEmployeeRequestSchema = z.strictObject({
  name: nameSchema,
  code: z.string().refine(employeeCodeIsValid, 'a code').optional(),
  extra: extraInputSchema,
  departmentId: z.uuid().nullable().optional(),
  positionId: z.uuid().nullable().optional(),
});
export type AddEmployeeRequest = z.infer<typeof addEmployeeRequestSchema>;

export const addEmployeeReplySchema = z.strictObject({
  employee: employeeDocSchema,
  /** Shown once, to the root who added; null when the one who added may not give a sign-in. */
  password: z.string().nullable(),
});
export type AddEmployeeReply = z.infer<typeof addEmployeeReplySchema>;

/** Saving a person over the version read. The name and `extra` are for whoever may change a person,
 * and each is required, since a save replaces `extra` whole; the rest only for the root, and an
 * absent one is unchanged. */
export const saveEmployeeRequestSchema = z.strictObject({
  version: tagSchema,
  name: nameSchema,
  extra: extraInputSchema,
  departmentId: z.uuid().nullable().optional(),
  positionId: z.uuid().nullable().optional(),
  permissions: permissionLayerSchema.optional(),
});
export type SaveEmployeeRequest = z.infer<typeof saveEmployeeRequestSchema>;

/** A new code for a person, over the version read. */
export const changeCodeRequestSchema = z.strictObject({
  version: tagSchema,
  code: z.string().refine(employeeCodeIsValid, 'a code'),
});
export type ChangeCodeRequest = z.infer<typeof changeCodeRequestSchema>;

/** `password` null asks the app to make one. */
export const setPasswordRequestSchema = z.strictObject({
  password: z.string().refine(passwordIsValid, 'a password').nullable(),
});
export type SetPasswordRequest = z.infer<typeof setPasswordRequestSchema>;
export const setPasswordReplySchema = z.strictObject({ password: z.string() });
export type SetPasswordReply = z.infer<typeof setPasswordReplySchema>;

export const archiveEmployeeRequestSchema = z.strictObject({ version: tagSchema });

/** A department or a position: a minted id, a name, what its staff may do, and `extra`. */
export const staffUnitSchema = z.strictObject({
  id: z.uuid(),
  name: nameSchema,
  permissions: permissionLayerSchema.default({}),
  extra: extraSchema,
});
export type StaffUnit = z.infer<typeof staffUnitSchema>;

/** The root's setup of the company's staff: its departments and positions, the person's optional
 * fields, the company's own fields and how a code is numbered. A setup saved before the last three
 * existed holds none of them, and `staffConfig` reads it as the defaults. */
export const staffSetupSchema = z.strictObject({
  departments: z.array(staffUnitSchema),
  positions: z.array(staffUnitSchema),
  fields: staffFieldsSchema.optional(),
  customFields: customFieldsSchema.optional(),
  numbering: numberingSchema.optional(),
  extra: extraSchema,
});
export type StaffSetup = z.infer<typeof staffSetupSchema>;

/** What the setup says about a person's fields and codes, whole: off, none and `EMP-0001` style
 * where it says nothing. The one place those defaults are written. */
export function staffConfig(setup: Partial<StaffSetup>): {
  fields: StaffFields;
  customFields: CustomField[];
  numbering: Numbering;
} {
  return {
    fields: { personalPhone: false, photo: false, ...setup.fields },
    customFields: setup.customFields ?? [],
    numbering: setup.numbering ?? DEFAULT_NUMBERING,
  };
}

export const staffSetupDocSchema = z.strictObject({ setup: staffSetupSchema, version: z.string() });
export type StaffSetupDoc = z.infer<typeof staffSetupDocSchema>;

/** A unit sent without an id is new: the BFF mints it. A save replaces a unit whole, so its
 * permissions and `extra` are required: an absent one would erase what is stored. */
const staffUnitInputSchema = staffUnitSchema.extend({
  id: z.uuid().optional(),
  permissions: permissionLayerSchema,
  extra: extraInputSchema,
});
export const saveStaffSetupRequestSchema = z.strictObject({
  setup: z.strictObject({
    departments: z.array(staffUnitInputSchema),
    positions: z.array(staffUnitInputSchema),
    fields: staffFieldsSchema.optional(),
    customFields: customFieldsSchema.optional(),
    numbering: numberingSchema.optional(),
    extra: extraInputSchema,
  }),
  /** The tag the setup was read at; `''` names a company that has never saved one. */
  version: tagSchema.or(z.literal('')),
});
export type SaveStaffSetupRequest = z.infer<typeof saveStaffSetupRequestSchema>;
