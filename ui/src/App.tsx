import { useLocation } from 'react-router';
import type { Api } from './api';
import { ClientApp } from './ClientApp';
import type { DeviceStore } from './device';
import { OperatorApp } from './OperatorApp';
import type { Look } from './Providers';

type Props = {
  api: Api;
  device: DeviceStore;
  /** Tests switch Mantine's transitions off. */
  test?: boolean;
  /** Set where the app is drawn inside another page's window, as the walks page draws a scene. */
  look?: Look;
};

/** The operator's door is `/operator`; it is drawn outside the client's boot, which asks a
 * company's settings before anything, and an operator belongs to none. */
const isOperatorPath = (pathname: string) =>
  pathname === '/operator' || pathname.startsWith('/operator/');

/** The whole app: the operator's page at `/operator`, a client's at every other address. */
export function App(props: Props) {
  const { pathname } = useLocation();
  return isOperatorPath(pathname) ? <OperatorApp {...props} /> : <ClientApp {...props} />;
}
