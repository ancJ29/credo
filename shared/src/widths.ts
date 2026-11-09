/**
 * The widths a screen is drawn at, widest first, so the app's breakpoints answer to each. The one
 * place they are written: the visual report, the walks and the mock all import it, and a width
 * that is not one of these is a type error where it is used.
 */
export const WIDTHS = { pc: 1280, tablet: 768, phone: 390 } as const;
export type Width = (typeof WIDTHS)[keyof typeof WIDTHS];
