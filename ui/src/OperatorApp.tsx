import { type CreateClientReply, normaliseClientCode } from '@credo/shared';
import { useEffect, useState } from 'react';
import { type Api, ApiError } from './api';
import { Boot } from './Boot';
import { BEFORE_CONFIG } from './brand';
import { ClientMade } from './ClientMade';
import type { DeviceStore } from './device';
import { NewClient } from './NewClient';
import { OperatorPage } from './OperatorPage';
import { OperatorSignIn } from './OperatorSignIn';
import { Providers } from './Providers';

type Props = {
  api: Api;
  device: DeviceStore;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
};

const SIGNED_OUT = 401;

/**
 * The operator's page: its own sign-in, then a form that makes a client and shows its link, its
 * root's name and its first password once. It wears credo's name and colour, asks no company's
 * settings, and sends no client code. Only the BFF's 401 signs the operator out.
 */
export function OperatorApp({ api, device, test }: Props) {
  const [phase, setPhase] = useState<'loading' | 'unavailable' | 'signedOut' | 'signedIn'>(() =>
    device.operatorAuthId() ? 'loading' : 'signedOut',
  );
  const [signIn, setSignIn] = useState<'idle' | 'busy' | 'refused'>('idle');
  const [make, setMake] = useState<'idle' | 'busy' | 'failed' | 'taken'>('idle');
  /** Held in this state alone: the password is shown once and is kept nowhere else. */
  const [made, setMade] = useState<CreateClientReply | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!device.operatorAuthId()) return;
    api.operatorMe().then(
      () => setPhase('signedIn'),
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
    setMade(null);
    setMake('idle');
    setPhase('signedOut');
  };

  async function submitSignIn(name: string, password: string) {
    setSignIn('busy');
    try {
      const session = await api.operatorSignIn(name, password);
      device.setOperatorAuthId(session.authId);
      setSignIn('idle');
      setPhase('signedIn');
    } catch (error) {
      if (error instanceof ApiError && error.status === SIGNED_OUT) setSignIn('refused');
      else setPhase('unavailable');
    }
  }

  async function submitClient(code: string, name: string) {
    setMake('busy');
    try {
      const result = await api.makeClient(normaliseClientCode(code), name);
      if (result.kind === 'taken') return setMake('taken');
      setMake('idle');
      setMade(result.client);
    } catch (error) {
      if (error instanceof ApiError && error.status === SIGNED_OUT) signedOut();
      else setMake('failed');
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

  const language = device.language() ?? BEFORE_CONFIG.language;
  return (
    <Providers colour={BEFORE_CONFIG.colour} language={language} test={test}>
      {phase === 'loading' || phase === 'unavailable' ? (
        <Boot status={phase} onRetry={retry} />
      ) : phase === 'signedOut' ? (
        <OperatorSignIn status={signIn} onSubmit={(n, p) => void submitSignIn(n, p)} />
      ) : (
        <OperatorPage onSignOut={() => void signOut()}>
          {made ? (
            <ClientMade
              link={`${window.location.origin}${made.link}`}
              rootName={made.rootName}
              password={made.password}
              onAnother={() => setMade(null)}
            />
          ) : (
            <NewClient status={make} onSubmit={(c, n) => void submitClient(c, n)} />
          )}
        </OperatorPage>
      )}
    </Providers>
  );
}
