import { type Language, LANGUAGES } from '@credo/shared';

const KEYS = {
  device: 'credo.device',
  session: 'credo.session',
  operator: 'credo.operator',
  client: 'credo.client',
  language: 'credo.language',
  shown: 'credo.shown',
  menu: 'credo.menu',
};

const languageOf = (kept: string | null) => LANGUAGES.find((language) => language === kept) ?? null;

/** What this device keeps between visits: the id it minted once, the client it was linked to, the
 * session handle (a reload keeps the sign-in), the operator's own handle apart from it, whether
 * the side menu shows, the language its user chose, and the language the last successful boot showed, which speaks before
 * the settings load. */
export function createDeviceStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>) {
  return {
    /** Minted on first use and kept; the BFF names a session record by it. */
    deviceId() {
      const kept = storage.getItem(KEYS.device);
      if (kept) return kept;
      const minted = crypto.randomUUID();
      storage.setItem(KEYS.device, minted);
      return minted;
    },
    /** The one client this device belongs to, kept from the link that named it. */
    clientCode: () => storage.getItem(KEYS.client),
    setClientCode: (code: string) => storage.setItem(KEYS.client, code),
    authId: () => storage.getItem(KEYS.session),
    setAuthId: (authId: string) => storage.setItem(KEYS.session, authId),
    clearAuthId: () => storage.removeItem(KEYS.session),
    /** The operator's handle, which opens no client and which no client's opens. */
    operatorAuthId: () => storage.getItem(KEYS.operator),
    setOperatorAuthId: (authId: string) => storage.setItem(KEYS.operator, authId),
    clearOperatorAuthId: () => storage.removeItem(KEYS.operator),
    /** The language chosen on this device, if it is one of ours. */
    language: (): Language | null => languageOf(storage.getItem(KEYS.language)),
    setLanguage: (language: Language) => storage.setItem(KEYS.language, language),
    /** The language the last successful boot showed on this device, if one did. */
    shownLanguage: (): Language | null => languageOf(storage.getItem(KEYS.shown)),
    setShownLanguage: (language: Language) => storage.setItem(KEYS.shown, language),
    /** Whether the side menu shows on a PC: it does, until a person hides it. */
    menuShown: () => storage.getItem(KEYS.menu) !== 'hidden',
    setMenuShown: (shown: boolean) => storage.setItem(KEYS.menu, shown ? 'shown' : 'hidden'),
  };
}

export type DeviceStore = ReturnType<typeof createDeviceStore>;
