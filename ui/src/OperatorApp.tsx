import { JOIN_PATH, type Language } from '@credo/shared';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { AddClientPage } from './AddClientPage';
import { type Api, ApiError, type Hop, hopOf } from './api';
import { Boot } from './Boot';
import { BEFORE_CONFIG } from './brand';
import { ClientsPage } from './ClientsPage';
import type { DeviceStore } from './device';
import { JoinPage } from './JoinPage';
import { OperatorPage } from './OperatorPage';
import { OPERATOR_PAGES, SOON_PAGES } from './operatorNav';
import { AddOperatorPage } from './AddOperatorPage';
import { OperatorSignIn } from './OperatorSignIn';
import type { Passkeys } from './passkeys';
import { OperatorsPage } from './OperatorsPage';
import { PasskeysPage } from './PasskeysPage';
import { Providers } from './Providers';
import { RootPasswordPage } from './RootPasswordPage';
import { ServicesPage } from './ServicesPage';
import { SessionEnded } from './SessionEnded';
import { signInWithPasskey } from './signInWithPasskey';
import { SoonPage } from './SoonPage';

type Props = {
  api: Api;
  device: DeviceStore;
  passkeys: Passkeys;
  /** The commit the app's own files were built from: the Services page compares it with the others. */
  build: string;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
};

const SIGNED_OUT = 401;

/**
 * The operator's app: a join link's page, or its own sign-in by passkey, then the dashboard (a menu
 * of five sections, the clients listed, a client added, one's own passkeys). It wears credo's name
 * and colour, asks no company's settings, and sends no client code. When the BFF's 401 says the
 * sign-in ended, the page stays and a prompt over it asks for the passkey again.
 */
export function OperatorApp(props: Props) {
  const { pathname } = useLocation();
  return pathname === JOIN_PATH ? <Joining {...props} /> : <Console {...props} />;
}

/** The join page, in credo's look and the device's language, outside the console's sign-in. */
function Joining({ api, device, passkeys, test }: Props) {
  return (
    <Providers
      colour={BEFORE_CONFIG.colour}
      language={device.language() ?? BEFORE_CONFIG.language}
      test={test}
    >
      <JoinPage api={api} device={device} passkeys={passkeys} />
    </Providers>
  );
}

function Console({ api, device, passkeys, build, test }: Props) {
  const [phase, setPhase] = useState<'loading' | 'unavailable' | 'signedOut' | 'signedIn'>(() =>
    device.operatorAuthId() ? 'loading' : 'signedOut',
  );
  const [signIn, setSignIn] = useState<'idle' | 'busy' | 'notGiven' | 'refused'>('idle');
  /** Who is signed in, from the sign-in's answer or from `me`. */
  const [who, setWho] = useState({ id: '', name: '' });
  /** The sign-in ended under an open page: null, or how the last try to go on ended. */
  const [ended, setEnded] = useState<
    null | 'idle' | 'busy' | 'notGiven' | 'refused' | 'unavailable'
  >(null);
  /** Bumped when another operator signs in over the page: the console starts over, empty. */
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState<Language>(() => device.language() ?? BEFORE_CONFIG.language);
  const [attempt, setAttempt] = useState(0);
  /** Which part of the service failed, when the console says it is unavailable. */
  const [hop, setHop] = useState<Hop | undefined>();

  useEffect(() => {
    if (!device.operatorAuthId()) return;
    api.operatorMe().then(
      (me) => {
        setWho(me.operator);
        setPhase('signedIn');
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === SIGNED_OUT) {
          device.clearOperatorAuthId();
          setPhase('signedOut');
        } else {
          setHop(hopOf(error));
          setPhase('unavailable');
        }
      },
    );
  }, [api, device, attempt]);

  const leave = () => {
    device.clearOperatorAuthId();
    setEnded(null);
    setPhase('signedOut');
  };

  async function submitSignIn() {
    setSignIn('busy');
    const result = await signInWithPasskey(api, passkeys);
    if (result.kind === 'in') {
      device.setOperatorAuthId(result.session.authId);
      setSignIn('idle');
      setWho(result.session.operator);
      setPhase('signedIn');
    } else if (result.kind === 'unavailable') {
      // The form comes back idle after "Try again", not still waiting on the touch.
      setSignIn('idle');
      setHop(result.hop);
      setPhase('unavailable');
    } else setSignIn(result.kind);
  }

  async function goOn() {
    setEnded('busy');
    const result = await signInWithPasskey(api, passkeys);
    if (result.kind !== 'in') return setEnded(result.kind);
    device.setOperatorAuthId(result.session.authId);
    // The same operator picks the task up where it was; another starts the console over.
    if (result.session.operator.id !== who.id) {
      setWho(result.session.operator);
      setRound((n) => n + 1);
    }
    setEnded(null);
  }

  async function signOut() {
    // The device is signed out whether or not the service heard.
    await api.operatorSignOut().catch(() => undefined);
    leave();
  }

  const retry = () => {
    // Without a handle there is nothing to ask the service: a failed sign-in goes back to the form.
    setPhase(device.operatorAuthId() ? 'loading' : 'signedOut');
    setAttempt((n) => n + 1);
  };

  return (
    <Providers colour={BEFORE_CONFIG.colour} language={chosen} test={test}>
      {phase === 'loading' || phase === 'unavailable' ? (
        <Boot status={phase} hop={hop} onRetry={retry} />
      ) : phase === 'signedOut' ? (
        <OperatorSignIn status={signIn} onSubmit={() => void submitSignIn()} />
      ) : (
        <OperatorPage
          name={who.name}
          onLanguage={(next) => {
            device.setLanguage(next);
            setChosen(next);
          }}
          onSignOut={() => void signOut()}
        >
          <Routes key={round}>
            <Route
              path="/operator/clients"
              element={<ClientsPage api={api} onSignedOut={() => setEnded('idle')} />}
            />
            <Route
              path="/operator/clients/new"
              element={<AddClientPage api={api} onSignedOut={() => setEnded('idle')} />}
            />
            <Route
              path="/operator/clients/:code/root-password"
              element={
                <RootPasswordPage
                  api={api}
                  passkeys={passkeys}
                  onSignedOut={() => setEnded('idle')}
                />
              }
            />
            <Route
              path="/operator/operators"
              element={<OperatorsPage api={api} onSignedOut={() => setEnded('idle')} />}
            />
            <Route
              path="/operator/operators/new"
              element={
                <AddOperatorPage
                  api={api}
                  passkeys={passkeys}
                  onSignedOut={() => setEnded('idle')}
                />
              }
            />
            <Route
              path="/operator/passkeys"
              element={
                <PasskeysPage api={api} passkeys={passkeys} onSignedOut={() => setEnded('idle')} />
              }
            />
            <Route
              path="/operator/services"
              element={
                <ServicesPage api={api} build={build} onSignedOut={() => setEnded('idle')} />
              }
            />
            {SOON_PAGES.map((page) => (
              <Route key={page.id} path={page.path} element={<SoonPage label={page.label} />} />
            ))}
            <Route path="*" element={<Navigate to={OPERATOR_PAGES[0].path} replace />} />
          </Routes>
          {ended !== null && (
            <SessionEnded
              status={ended}
              onContinue={() => void goOn()}
              onSignOut={() => void signOut()}
            />
          )}
        </OperatorPage>
      )}
    </Providers>
  );
}
