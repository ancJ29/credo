import {
  can,
  clientCodeSchema,
  type ConfigDoc,
  type Language,
  normaliseClientCode,
  parseQr,
  type SessionReply,
  type UserView,
} from '@credo/shared';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AddPersonPage } from './AddPersonPage';
import { type Api, ApiError } from './api';
import { Boot } from './Boot';
import { BEFORE_CONFIG } from './brand';
import type { DeviceStore } from './device';
import { type PageProps } from './page';
import { PersonPage } from './PersonPage';
import { type Look, Providers } from './Providers';
import { mayOpen, type Page, pagesOf } from './nav';
import { Notice } from './Notice';
import { OwnPasswordPage } from './OwnPasswordPage';
import { QrLanding } from './QrLanding';
import { SettingsPage } from './SettingsPage';
import { Shell } from './Shell';
import { StaffListPage } from './StaffListPage';
import { StaffSetupPage } from './StaffSetupPage';
import { SignIn } from './SignIn';
import { UnknownClient } from './UnknownClient';

type Props = {
  api: Api;
  device: DeviceStore;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
  /** Where the app is drawn inside another page's window: its colour scheme and root element. */
  look?: Look;
};

const SIGNED_OUT = 401;
const NOT_FOUND = 404;

/** The language a device shows once the settings are known: its user's choice, while the company
 * still offers it, else the company's default. */
const languageShown = (config: ConfigDoc['config'], chosen: Language | null) =>
  chosen && config.languages.includes(chosen) ? chosen : config.defaultLanguage;

/** The code the address names, lowered and trimmed; null when the address names none. */
const linkedCode = (search: string) => {
  const raw = new URLSearchParams(search).get('client-code');
  return raw === null ? null : normaliseClientCode(raw);
};

/** The company's settings, then who is signed in. `unknown` when the address names no code, a
 * malformed one, or a client the BFF does not know; `unavailable` when the service cannot say. A
 * stored handle the BFF refuses is dropped; any other failure is not a sign-out. */
async function boot(api: Api, device: DeviceStore, linked: string | null) {
  const named = clientCodeSchema.safeParse(linked ?? device.clientCode());
  if (!named.success) return { kind: 'unknown' } as const;
  // The device belongs to the client its latest link named.
  if (linked !== null) device.setClientCode(named.data);
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
    return { kind: 'ready', doc, user } as const;
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND)
      return { kind: 'unknown' } as const;
    return { kind: 'unavailable' } as const;
  }
}

/**
 * The client's app: the company's settings, then who is signed in, then the page. The settings come before
 * sign-in so the sign-in already wears the company's name and colour. Only the BFF's 401 signs
 * anyone out; any other failure says the service is unavailable and offers a retry. An address
 * that names no company we know shows one screen in credo's colour and nothing of any client's.
 */
export function ClientApp({ api, device, test, look }: Props) {
  const [phase, setPhase] = useState<'loading' | 'unavailable' | 'unknown'>('loading');
  const [doc, setDoc] = useState<ConfigDoc | null>(null);
  const [user, setUser] = useState<UserView | null>(null);
  const [chosen, setChosen] = useState<Language | null>(() => device.language());
  const [shown] = useState<Language | null>(() => device.shownLanguage());
  const [signIn, setSignIn] = useState<'idle' | 'busy' | 'refused'>('idle');
  /** What the address named when the app opened; the sign-in's own navigation does not change it. */
  const { search } = useLocation();
  const [linked] = useState(() => linkedCode(search));
  /** The QR code the address carried when the app opened: it signs this device in once the
   * settings are known, and the address is then cleared of it. */
  const [qr] = useState(() => parseQr(new URLSearchParams(search).get('qr')));
  const [qrStatus, setQrStatus] = useState<'waiting' | 'refused' | 'done'>(qr ? 'waiting' : 'done');
  const qrAsked = useRef(false);
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    void boot(api, device, linked).then((found) => {
      if (found.kind !== 'ready') return setPhase(found.kind);
      // Kept, so the next boot speaks this language while the settings load, or fail to.
      device.setShownLanguage(languageShown(found.doc.config, device.language()));
      setDoc(found.doc);
      setUser(found.user);
    });
    // A retry runs the boot again; nothing else does.
  }, [api, device, linked, attempt]);

  useEffect(() => {
    if (!doc || !qr || qrAsked.current) return;
    qrAsked.current = true;
    void api.signInQr(qr.id, qr.secret).then(
      (session) => {
        device.setAuthId(session.authId);
        setUser(session.user);
        setQrStatus('done');
        // The code is spent: the address is cleared of it, and the first page opens.
        void navigate('/', { replace: true });
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === SIGNED_OUT) return setQrStatus('refused');
        // Not a refusal of the code: the service is unavailable, and a retry asks again.
        qrAsked.current = false;
        setDoc(null);
        setPhase('unavailable');
      },
    );
  }, [api, device, doc, qr, navigate]);

  const retry = () => {
    // A sign-in that failed on the service left its status busy: the form it returns to is idle.
    setSignIn('idle');
    setDoc(null);
    setPhase('loading');
    setAttempt((n) => n + 1);
  };

  if (!doc) {
    return (
      <Providers
        colour={BEFORE_CONFIG.colour}
        language={chosen ?? shown ?? BEFORE_CONFIG.language}
        test={test}
        {...look}
      >
        {phase === 'unknown' ? <UnknownClient /> : <Boot status={phase} onRetry={retry} />}
      </Providers>
    );
  }

  const { config } = doc;
  // A language the company stopped offering gives way to its default.
  const language = languageShown(config, chosen);
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

  /** A 403 says what this person may do changed: who they are is read again, and the menu and
   * the page are drawn from it. */
  async function readAgain() {
    try {
      setUser((await api.me()).user);
    } catch (error) {
      if (error instanceof ApiError && error.status === SIGNED_OUT) signedOut();
    }
  }

  async function signOut() {
    // The device is signed out whether or not the service heard: a retry would only hold the user.
    await api.signOut().catch(() => undefined);
    signedOut();
  }

  /** The session that replaces the one held, when one's own password changed. */
  const replaced = (session: SessionReply) => {
    device.setAuthId(session.authId);
    setUser(session.user);
  };

  const pages = user ? pagesOf(user) : [];
  const first = pages[0];
  /** A page by its address opens only for someone whose menu lists it; else the 403 page. */
  const guarded = (who: UserView, id: Page['id'], page: ReactElement) =>
    mayOpen(who, id) ? page : <Notice kind="forbidden" />;
  /** One's own password is the one page every signed-in person has, whatever else they may open. */
  const ownPassword = (who: UserView) => (
    <Route path="/password" element={<OwnPasswordPage {...pageFor(who)} onSession={replaced} />} />
  );
  const pageFor = (who: UserView): PageProps => ({
    api,
    user: who,
    onSignedOut: signedOut,
    onForbidden: () => void readAgain(),
  });

  const landing = !user && qr !== null && qrStatus !== 'done';

  return (
    <Providers colour={config.colour} language={language} test={test} {...look}>
      {landing ? (
        <QrLanding
          brand={config}
          status={qrStatus === 'refused' ? 'refused' : 'busy'}
          onPassword={() => {
            setQrStatus('done');
            void navigate('/', { replace: true });
          }}
        />
      ) : user ? (
        <Shell
          brand={config}
          user={user.name}
          pages={pages}
          passwordPath="/password"
          languages={config.languages}
          onLanguage={(next) => {
            device.setLanguage(next);
            setChosen(next);
          }}
          onSignOut={() => void signOut()}
        >
          {first ? (
            <Routes>
              {ownPassword(user)}
              <Route
                path="/settings"
                element={guarded(
                  user,
                  'settings',
                  <SettingsPage
                    api={api}
                    doc={doc}
                    onDoc={setDoc}
                    onSignedOut={signedOut}
                    onForbidden={() => void readAgain()}
                  />,
                )}
              />
              <Route
                path="/staff"
                element={guarded(user, 'staff', <StaffListPage {...pageFor(user)} />)}
              />
              <Route
                path="/staff/new"
                element={
                  can(user, 'staff.canCreate') ? (
                    <AddPersonPage {...pageFor(user)} />
                  ) : (
                    <Notice kind="forbidden" />
                  )
                }
              />
              <Route
                path="/staff/:id"
                element={guarded(user, 'staff', <PersonPage {...pageFor(user)} />)}
              />
              <Route
                path="/staff-setup"
                element={guarded(user, 'staff-setup', <StaffSetupPage {...pageFor(user)} />)}
              />
              <Route path="*" element={<Navigate to={first.path} replace />} />
            </Routes>
          ) : (
            <Routes>
              {ownPassword(user)}
              <Route path="*" element={<Notice kind="nothing" />} />
            </Routes>
          )}
        </Shell>
      ) : (
        <SignIn brand={config} status={signIn} onSubmit={(n, p) => void submit(n, p)} />
      )}
    </Providers>
  );
}
