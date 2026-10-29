import '@fontsource-variable/noto-sans';
import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { createApi } from './api';
import { createDeviceStore } from './device';

/** `?fake` serves the app over invented data, and only in the fake build (`vite build --mode
 * fake`): the test is a constant there and false in every other build, which drops the fake and its
 * data from the bundle, as the scripts' fake.test.ts reads. The fake answers null when neither the
 * address nor the tab asks for it. */
const fake =
  import.meta.env.MODE === 'fake'
    ? (await import('./fake')).fakeParts(location.search, sessionStorage)
    : null;
const { api, device } = fake ?? realParts();

function realParts() {
  const device = createDeviceStore(localStorage);
  const api = createApi({
    deviceId: device.deviceId(),
    clientCode: device.clientCode,
    authId: device.authId,
    operatorAuthId: device.operatorAuthId,
  });
  return { api, device };
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App api={api} device={device} />
  </BrowserRouter>,
);
