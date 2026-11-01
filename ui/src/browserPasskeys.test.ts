import { beforeEach, describe, expect, it, vi } from 'vitest';
import { browserPasskeys } from './browserPasskeys';
import { PasskeyAlreadyHere, PasskeyNotGiven } from './passkeys';

const library = vi.hoisted(() => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));
vi.mock('@simplewebauthn/browser', () => library);

const options = { challenge: 'Zm9v', rpId: 'localhost' };
const credential = {
  id: 'k',
  rawId: 'k',
  type: 'public-key',
  response: { clientDataJSON: 'x' },
  clientExtensionResults: {},
};
const named = (name: string) => Object.assign(new Error(name), { name });

describe('the browser’s passkeys', () => {
  beforeEach(() => {
    library.startRegistration.mockReset();
    library.startAuthentication.mockReset();
  });

  it('Makes a passkey with the options as the library takes them, and returns the device’s answer', async () => {
    library.startRegistration.mockResolvedValue(credential);

    await expect(browserPasskeys.register(options)).resolves.toEqual(credential);
    expect(library.startRegistration).toHaveBeenCalledExactlyOnceWith({ optionsJSON: options });
  });

  it('Signs with a passkey with the options as the library takes them, and returns the device’s answer', async () => {
    library.startAuthentication.mockResolvedValue(credential);

    await expect(browserPasskeys.authenticate(options)).resolves.toEqual(credential);
    expect(library.startAuthentication).toHaveBeenCalledExactlyOnceWith({ optionsJSON: options });
  });

  it('Only the browser’s NotAllowedError reads as the passkey not given', async () => {
    library.startRegistration.mockRejectedValue(named('NotAllowedError'));
    library.startAuthentication.mockRejectedValue(named('NotAllowedError'));

    await expect(browserPasskeys.register(options)).rejects.toBeInstanceOf(PasskeyNotGiven);
    await expect(browserPasskeys.authenticate(options)).rejects.toBeInstanceOf(PasskeyNotGiven);
  });

  it('The browser’s InvalidStateError reads as the device already holding a passkey for the operator', async () => {
    library.startRegistration.mockRejectedValue(named('InvalidStateError'));

    await expect(browserPasskeys.register(options)).rejects.toBeInstanceOf(PasskeyAlreadyHere);
    await expect(browserPasskeys.register(options)).rejects.not.toBeInstanceOf(PasskeyNotGiven);
  });

  it('Any other failure, or an answer that is no credential, stays an error that is not "not given"', async () => {
    library.startRegistration.mockRejectedValue(named('SecurityError'));
    library.startAuthentication.mockResolvedValue({ id: 'k' });

    await expect(browserPasskeys.register(options)).rejects.not.toBeInstanceOf(PasskeyNotGiven);
    await expect(browserPasskeys.register(options)).rejects.toMatchObject({
      name: 'SecurityError',
    });
    await expect(browserPasskeys.authenticate(options)).rejects.toThrow();
    library.startAuthentication.mockRejectedValue('not an error');
    await expect(browserPasskeys.authenticate(options)).rejects.toBe('not an error');
  });
});
