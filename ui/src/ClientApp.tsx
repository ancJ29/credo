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
import { AddRecordPage } from './pages/client/AddRecordPage';
import { AddPersonPage } from './pages/client/AddPersonPage';
import { type Api, ApiError } from './api';
import { Boot } from './frame/Boot';
import { BEFORE_CONFIG } from './brand';
import { localToday } from './day';
import type { DeviceStore } from './device';
import { DeliveriesPage } from './pages/client/DeliveriesPage';
import { DriverDayPage } from './pages/client/DriverDayPage';
import { CustomerPage } from './pages/client/CustomerPage';
import { DeliveryPage } from './pages/client/DeliveryPage';
import { MyDeliveriesPage } from './pages/client/MyDeliveriesPage';
import { MyDeliveryPage } from './pages/client/MyDeliveryPage';
import { ImportPage } from './pages/client/ImportPage';
import { ListImportPage } from './pages/client/ListImportPage';
import { ListPage } from './pages/client/ListPage';
import { type PageProps } from './page';
import { shrinkToProof } from './photo';
import { PersonPage } from './pages/client/PersonPage';
import { ProductPage } from './pages/client/ProductPage';
import { type Look, Providers } from './frame/Providers';
import { mayOpen, type Page, pagesOf } from './nav';
import { MorePage } from './pages/MorePage';
import { Notice } from './pages/client/Notice';
import { NewOrderPage, OrderPage } from './pages/client/OrderPage';
import { OrdersPage } from './pages/client/OrdersPage';
import { OwnPasswordPage } from './pages/client/OwnPasswordPage';
import { QrLanding } from './pages/client/QrLanding';
import { SettingsPage } from './pages/client/SettingsPage';
import { Shell } from './frame/Shell';
import { StaffListPage } from './pages/client/StaffListPage';
import { StaffSetupPage } from './pages/client/StaffSetupPage';
import { SignIn } from './pages/SignIn';
import { UnknownClient } from './pages/client/UnknownClient';

type Props = {
  api: Api;
  device: DeviceStore;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
  /** Where the app is drawn inside another page's window: its colour scheme and root element. */
  look?: Look;
  /** The office's day now; the data set's on the fake, the browser's own otherwise. */
  today?: () => string;
  /** Makes a delivery's photo small enough to send; the browser's own by default. */
  shrink?: (file: File) => Promise<string>;
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
export function ClientApp({
  api,
  device,
  test,
  look,
  today = localToday,
  shrink = shrinkToProof,
}: Props) {
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
    <>
      <Route
        path="/password"
        element={<OwnPasswordPage {...pageFor(who)} onSession={replaced} />}
      />
      <Route path="/more" element={<MorePage />} />
    </>
  );
  const pageFor = (who: UserView): PageProps => ({
    api,
    user: who,
    onSignedOut: signedOut,
    onForbidden: () => void readAgain(),
    today,
    shrink,
  });

  const landing = !user && qr !== null && qrStatus !== 'done';
  const chooseLanguage = (next: Language) => {
    device.setLanguage(next);
    setChosen(next);
  };

  return (
    <Providers colour={config.colour} language={language} test={test} {...look}>
      {landing ? (
        <QrLanding
          brand={config}
          status={qrStatus === 'refused' ? 'refused' : 'busy'}
          languages={config.languages}
          onLanguage={chooseLanguage}
          onPassword={() => {
            setQrStatus('done');
            void navigate('/', { replace: true });
          }}
        />
      ) : user ? (
        <Shell
          brand={config}
          look={config}
          user={user.name}
          pages={pages}
          passwordPath="/password"
          shown={device.menuShown()}
          onShown={device.setMenuShown}
          languages={config.languages}
          onLanguage={chooseLanguage}
          onSignOut={() => void signOut()}
        >
          {first ? (
            <Routes>
              {ownPassword(user)}
              <Route
                path="/my-deliveries"
                element={guarded(user, 'my-deliveries', <MyDeliveriesPage {...pageFor(user)} />)}
              />
              <Route
                path="/my-deliveries/:day/:id"
                element={guarded(user, 'my-deliveries', <MyDeliveryPage {...pageFor(user)} />)}
              />
              <Route
                path="/orders"
                element={guarded(user, 'orders', <OrdersPage {...pageFor(user)} />)}
              />
              <Route
                path="/orders/new"
                element={
                  can(user, 'orders.canEdit') ? (
                    <NewOrderPage {...pageFor(user)} />
                  ) : (
                    <Notice kind="forbidden" />
                  )
                }
              />
              <Route
                path="/orders/:day/:id"
                element={guarded(user, 'orders', <OrderPage {...pageFor(user)} />)}
              />
              <Route
                path="/deliveries"
                element={guarded(user, 'deliveries', <DeliveriesPage {...pageFor(user)} />)}
              />
              <Route
                path="/deliveries/:day/drivers/:driverId"
                element={guarded(user, 'deliveries', <DriverDayPage {...pageFor(user)} />)}
              />
              <Route
                path="/deliveries/:day/:id"
                element={guarded(user, 'deliveries', <DeliveryPage {...pageFor(user)} />)}
              />
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
                path="/staff/import"
                element={
                  // Only the root imports staff (case-table row 4): no permission allows it.
                  user.root ? <ImportPage {...pageFor(user)} /> : <Notice kind="forbidden" />
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
              {(['customers', 'products'] as const).map((kind) => (
                <Route
                  key={kind}
                  path={`/${kind}`}
                  element={guarded(user, kind, <ListPage kind={kind} {...pageFor(user)} />)}
                />
              ))}
              {(['customers', 'products'] as const).map((kind) => (
                <Route
                  key={kind}
                  path={`/${kind}/new`}
                  element={
                    // Whoever may edit orders adds, as they correct these records (case-table row 11),
                    // and only through a page their menu lists: the list's own question comes first.
                    mayOpen(user, kind) && can(user, 'orders.canEdit') ? (
                      <AddRecordPage kind={kind} {...pageFor(user)} />
                    ) : (
                      <Notice kind="forbidden" />
                    )
                  }
                />
              ))}
              <Route
                path="/customers/:id"
                element={guarded(user, 'customers', <CustomerPage {...pageFor(user)} />)}
              />
              <Route
                path="/products/:id"
                element={guarded(user, 'products', <ProductPage {...pageFor(user)} />)}
              />
              {(['customers', 'products'] as const).map((kind) => (
                <Route
                  key={kind}
                  path={`/${kind}/import`}
                  element={
                    // Only the root imports (case-table row 22): no permission allows it.
                    user.root ? (
                      <ListImportPage kind={kind} {...pageFor(user)} />
                    ) : (
                      <Notice kind="forbidden" />
                    )
                  }
                />
              ))}
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
        <SignIn
          brand={config}
          status={signIn}
          languages={config.languages}
          onLanguage={chooseLanguage}
          onSubmit={(n, p) => void submit(n, p)}
        />
      )}
    </Providers>
  );
}
