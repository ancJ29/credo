import { type Language, LANGUAGES } from '@credo/shared';

const KEYS = { device: 'credo.device', session: 'credo.session', language: 'credo.language' };

/** What this device keeps between visits: the id it minted once, the session handle (a reload
 * keeps the sign-in) and the language its user chose. */
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
    authId: () => storage.getItem(KEYS.session),
    setAuthId: (authId: string) => storage.setItem(KEYS.session, authId),
    clearAuthId: () => storage.removeItem(KEYS.session),
    /** The language chosen on this device, if it is one of ours. */
    language(): Language | null {
      const kept = storage.getItem(KEYS.language);
      return LANGUAGES.find((language) => language === kept) ?? null;
    },
    setLanguage: (language: Language) => storage.setItem(KEYS.language, language),
  };
}

export type DeviceStore = ReturnType<typeof createDeviceStore>;
