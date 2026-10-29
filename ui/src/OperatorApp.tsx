import type { Language } from '@credo/shared';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AddClientPage } from './AddClientPage';
import { type Api, ApiError } from './api';
import { Boot } from './Boot';
import { BEFORE_CONFIG } from './brand';
import { ClientsPage } from './ClientsPage';
import type { DeviceStore } from './device';
import { OperatorPage } from './OperatorPage';
import { OPERATOR_PAGES, SOON_PAGES } from './operatorNav';
import { OperatorSignIn } from './OperatorSignIn';
import { Providers } from './Providers';
import { SoonPage } from './SoonPage';

type Props = {
  api: Api;
  device: DeviceStore;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
};

const SIGNED_OUT = 401;

/**
 * The operator's app: its own sign-in, then the dashboard (a menu of five sections, the clients
 * listed, a client added). It wears credo's name and colour, asks no company's settings, and
 * sends no client code. Only the BFF's 401 signs the operator out.
 */
export function OperatorApp({ api, device, test }: Props) {
  const [phase, setPhase] = useState<'loading' | 'unavailable' | 'signedOut' | 'signedIn'>(() =>
    device.operatorAuthId() ? 'loading' : 'signedOut',
  );
  const [signIn, setSignIn] = useState<'idle' | 'busy' | 'refused'>('idle');
  /** Who is signed in, from the sign-in's answer or from `me`. */
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<Language>(() => device.language() ?? BEFORE_CONFIG.language);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!device.operatorAuthId()) return;
    api.operatorMe().then(
      (me) => {
        setName(me.operator.name);
        setPhase('signedIn');
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === SIGNED_OUT) {
          device.clearOperatorAuthId();
          setPhase('signedOut');
        } else setPhase('unavailable');
      },
    );
  }, [api, device, attempt]);

  const signedOut = () => {
    device.clearOperatorAuthId();
    setPhase('signedOut');
  };

  async function submitSignIn(signInName: string, password: string) {
    setSignIn('busy');
    try {
      const session = await api.operatorSignIn(signInName, password);
      device.setOperatorAuthId(session.authId);
      setSignIn('idle');
      setName(session.operator.name);
      setPhase('signedIn');
    } catch (error) {
      if (error instanceof ApiError && error.status === SIGNED_OUT) setSignIn('refused');
      else setPhase('unavailable');
    }
  }

  async function signOut() {
    // The device is signed out whether or not the service heard.
    await api.operatorSignOut().catch(() => undefined);
    signedOut();
  }

  const retry = () => {
    // Without a handle there is nothing to ask the service: a failed sign-in goes back to the form.
    setPhase(device.operatorAuthId() ? 'loading' : 'signedOut');
    setAttempt((n) => n + 1);
  };

  return (
    <Providers colour={BEFORE_CONFIG.colour} language={chosen} test={test}>
      {phase === 'loading' || phase === 'unavailable' ? (
        <Boot status={phase} onRetry={retry} />
      ) : phase === 'signedOut' ? (
        <OperatorSignIn status={signIn} onSubmit={(n, p) => void submitSignIn(n, p)} />
      ) : (
        <OperatorPage
          name={name}
          onLanguage={(next) => {
            device.setLanguage(next);
            setChosen(next);
          }}
          onSignOut={() => void signOut()}
        >
          <Routes>
            <Route
              path="/operator/clients"
              element={<ClientsPage api={api} onSignedOut={signedOut} />}
            />
            <Route
              path="/operator/clients/new"
              element={<AddClientPage api={api} onSignedOut={signedOut} />}
            />
            {SOON_PAGES.map((page) => (
              <Route key={page.id} path={page.path} element={<SoonPage label={page.label} />} />
            ))}
            <Route path="*" element={<Navigate to={OPERATOR_PAGES[0].path} replace />} />
          </Routes>
        </OperatorPage>
      )}
    </Providers>
  );
}
