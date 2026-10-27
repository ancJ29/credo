import '@fontsource-variable/noto-sans';
import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { createApi } from './api';
import { createDeviceStore } from './device';

const device = createDeviceStore(localStorage);
const api = createApi({ deviceId: device.deviceId(), authId: device.authId });

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App api={api} device={device} />
  </BrowserRouter>,
);
