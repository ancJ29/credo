import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router';
import type { Api } from './api';
import { BEFORE_CONFIG } from './brand';
import { ClientApp } from './ClientApp';
import { isComputer } from './computer';
import type { DeviceStore } from './device';
import { OperatorApp } from './OperatorApp';
import { SignUpPage } from './pages/SignUpPage';
import { UnknownClient } from './pages/client/UnknownClient';
import type { Passkeys } from './passkeys';
import { type Look, Providers } from './frame/Providers';

type Props = {
  api: Api;
  device: DeviceStore;
  /** The device's passkeys: the browser's, or the fake that answers as one would. */
  passkeys: Passkeys;
  /** The commit the app's own files were built from, or `dev` where none is stamped. */
  build: string;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
  /** The web address's name (`location.hostname`), given by the page that is the app's own. Where it
   * names a company, that company opens; given none, as every test and the walks page draw the app,
   * the link and the device decide alone. */
  address?: string;
  /** Set where the app is drawn inside another page's window, as the walks page draws a scene. */
  look?: Look;
  /** The office's day now, for a client's pages; the browser's own when none is given. */
  today?: () => string;
  /** Makes a delivery's photo small enough to send; the browser's own when none is given. */
  shrink?: (file: File) => Promise<string>;
};

/** The operator's door is `/operator`; it is drawn outside the client's boot, which asks a
 * company's settings before anything, and an operator belongs to none. */
const isOperatorPath = (pathname: string) =>
  pathname === '/operator' || pathname.startsWith('/operator/');

/** The sign-up page is `/sign-up` at any address: a company asks for its address there, before any
 * company's boot, since it belongs to none yet. */
const isSignUpPath = (pathname: string) => pathname === '/sign-up';

/** The design system's gallery sits at `/48b74d079/gallery` and below it; like the operator's door
 * it is drawn outside the client's boot and asks nobody to sign in. */
const isGalleryPath = (pathname: string) =>
  pathname === '/48b74d079/gallery' || pathname.startsWith('/48b74d079/gallery/');

/** The gallery's code, samples and words are a chunk of their own: a client's phone never fetches it. */
const Gallery = lazy(() => import('./design-system/Gallery').then((m) => ({ default: m.Gallery })));

/** The whole app: the gallery at `/48b74d079/gallery` (for a computer: a phone or a tablet gets
 * the not-found screen there), the operator's page at `/operator`, a client's at every other address. */
export function App(props: Props) {
  const { pathname } = useLocation();
  if (isGalleryPath(pathname)) {
    if (!isComputer(navigator)) {
      return (
        <Providers {...BEFORE_CONFIG} test={props.test} {...props.look}>
          <UnknownClient />
        </Providers>
      );
    }
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    );
  }
  if (isSignUpPath(pathname)) {
    return (
      <Providers
        {...BEFORE_CONFIG}
        language={props.device.language() ?? props.device.shownLanguage() ?? BEFORE_CONFIG.language}
        test={props.test}
        {...props.look}
      >
        <SignUpPage api={props.api} />
      </Providers>
    );
  }
  return isOperatorPath(pathname) ? <OperatorApp {...props} /> : <ClientApp {...props} />;
}
