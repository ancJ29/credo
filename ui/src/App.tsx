import { type ConfigDoc, type Language, type UserView } from '@credo/shared';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { type Api, ApiError } from './api';
import { Boot } from './Boot';
import { BEFORE_CONFIG } from './brand';
import type { DeviceStore } from './device';
import { Providers } from './Providers';
import { SettingsPage } from './SettingsPage';
import { Shell } from './Shell';
import { SignIn } from './SignIn';

type Props = {
  api: Api;
  device: DeviceStore;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
};

const SIGNED_OUT = 401;

/** The company's settings, then who is signed in; null when the service cannot say. A stored
 * handle the BFF refuses is dropped; any other failure is not a sign-out. */
async function boot(api: Api, device: DeviceStore) {
  try {
    const doc = await api.getConfig();
    let user: UserView | null = null;
    if (device.authId()) {
      try {
        user = (await api.me()).user;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== SIGNED_OUT) throw error;
        device.clearAuthId();
      }
    }
    return { doc, user };
  } catch {
    return null;
  }
}

/**
 * The app: the company's settings, then who is signed in, then the page. The settings come before
 * sign-in so the sign-in already wears the company's name and colour. Only the BFF's 401 signs
 * anyone out; any other failure says the service is unavailable and offers a retry.
 */
export function App({ api, device, test }: Props) {
  const [phase, setPhase] = useState<'loading' | 'unavailable'>('loading');
  const [doc, setDoc] = useState<ConfigDoc | null>(null);
  const [user, setUser] = useState<UserView | null>(null);
  const [chosen, setChosen] = useState<Language | null>(() => device.language());
  const [signIn, setSignIn] = useState<'idle' | 'busy' | 'refused'>('idle');

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    void boot(api, device).then((found) => {
      if (!found) return setPhase('unavailable');
      setDoc(found.doc);
      setUser(found.user);
    });
    // A retry runs the boot again; nothing else does.
  }, [api, device, attempt]);

  const retry = () => {
    setDoc(null);
    setPhase('loading');
    setAttempt((n) => n + 1);
  };

  if (!doc) {
    return (
      <Providers
        colour={BEFORE_CONFIG.colour}
        language={chosen ?? BEFORE_CONFIG.language}
        test={test}
      >
        <Boot status={phase} onRetry={retry} />
      </Providers>
    );
  }

  const { config } = doc;
  // A language the company stopped offering gives way to its default.
  const language = chosen && config.languages.includes(chosen) ? chosen : config.defaultLanguage;
  const signedOut = () => {
    device.clearAuthId();
    setUser(null);
  };

  async function submit(name: string, password: string) {
    setSignIn('busy');
    try {
      const session = await api.signIn(name, password);
      device.setAuthId(session.authId);
      setSignIn('idle');
      setUser(session.user);
    } catch (error) {
      if (error instanceof ApiError && error.status === SIGNED_OUT) setSignIn('refused');
      else {
        setDoc(null);
        setPhase('unavailable');
      }
    }
  }

  async function signOut() {
    // The device is signed out whether or not the service heard: a retry would only hold the user.
    await api.signOut().catch(() => undefined);
    signedOut();
  }

  return (
    <Providers colour={config.colour} language={language} test={test}>
      {user ? (
        <Shell
          brand={config}
          user={user.name}
          languages={config.languages}
          onLanguage={(next) => {
            device.setLanguage(next);
            setChosen(next);
          }}
          onSignOut={() => void signOut()}
        >
          <Routes>
            <Route
              path="/settings"
              element={<SettingsPage api={api} doc={doc} onDoc={setDoc} onSignedOut={signedOut} />}
            />
            <Route path="*" element={<Navigate to="/settings" replace />} />
          </Routes>
        </Shell>
      ) : (
        <SignIn brand={config} status={signIn} onSubmit={(n, p) => void submit(n, p)} />
      )}
    </Providers>
  );
}
