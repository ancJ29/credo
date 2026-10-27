/** The English words, and the shape the Vietnamese must match. */
export const en = {
  app: { name: 'Credo' },
  common: {
    loading: 'Loading',
    retry: 'Try again',
    loadFailed: 'This page could not be loaded. Nothing you typed is lost: try again.',
  },
  auth: {
    title: 'Sign in',
    username: 'Sign-in name',
    password: 'Password',
    submit: 'Sign in',
    refused: 'The sign-in name or the password is wrong. Check them and try again.',
  },
  nav: { menu: 'Menu', settings: 'Settings' },
  user: { language: 'Language', signOut: 'Sign out' },
  settings: {
    title: 'Settings',
    intro: 'What your people see on every screen, sign-in included.',
    name: 'Company name',
    logo: 'Logo',
    logoNone: 'No logo yet',
    logoChoose: 'Choose a logo',
    logoRemove: 'Remove the logo',
    colour: 'Brand colour',
    languages: 'Languages offered',
    defaultLanguage: 'Language when someone first opens the app',
    save: 'Save',
    saved: 'Saved. The new name and colour show on every screen.',
    saveFailed: 'The settings were not saved. What you typed is still here: try again.',
    conflict: 'Someone saved newer settings first. Your changes were not saved.',
    conflictReload: 'Show the newer settings',
  },
  boot: {
    unavailableTitle: 'The service is not answering',
    unavailable: 'This is not your doing. Wait a moment, then try again.',
  },
};

type Words<T> = { [K in keyof T]: T[K] extends string ? string : Words<T[K]> };

/** The shape every language's words must have. */
export type Dictionary = Words<typeof en>;
