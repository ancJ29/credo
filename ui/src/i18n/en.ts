/** The English words, and the shape the Vietnamese must match. */
export const en = {
  app: { name: 'Credo' },
  common: {
    loading: 'Loading',
    retry: 'Try again',
    loadFailed: 'This page could not be loaded. Try again.',
    unavailable: 'The service is unavailable. Try again in a moment.',
  },
  auth: {
    title: 'Sign in to your account',
    username: 'Username',
    usernamePlaceholder: 'Enter your username',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    submit: 'Sign In',
    refused: 'Wrong username or password.',
  },
  nav: { menu: 'Menu', settings: 'Settings' },
  user: { language: 'Language', signOut: 'Sign out' },
  settings: {
    title: 'Settings',
    basics: 'Basic Information',
    intro: 'What your people see on every screen, sign-in included.',
    name: 'Company name',
    logo: 'Logo',
    logoNone: 'No logo yet',
    logoChoose: 'Choose a logo',
    logoRemove: 'Remove the logo',
    logoTooLarge: 'That logo is larger than {{max}} KB, so it was not used. The logo is as it was.',
    logoNotImage: 'That file is not an image, so it was not used. The logo is as it was.',
    colour: 'Brand colour',
    languages: 'Languages offered',
    defaultLanguage: 'Language when someone first opens the app',
    save: 'Save',
    saved: 'Saved. The new name and colour show on every screen.',
    saveFailed: 'The settings were not saved. What you typed is still here: try again.',
    saveRefused:
      'The settings were refused as they are. Check the logo, the name and the colour: what you typed is still here.',
    conflict: 'Someone saved newer settings first. Your changes were not saved.',
    conflictReload: 'Show the newer settings',
  },
};

type Words<T> = { [K in keyof T]: T[K] extends string ? string : Words<T[K]> };

/** The shape every language's words must have. */
export type Dictionary = Words<typeof en>;
