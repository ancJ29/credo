/** The commit this BFF was built from, `dev` for any other build. The bundle's build replaces the
 * expression below with the commit it was given (`bundleBff`); nothing reads it at run time. */
export const BUILD: string = process.env.CREDO_BUILD ?? 'dev';
