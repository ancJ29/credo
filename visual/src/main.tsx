import '@fontsource-variable/noto-sans';
import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { isPartnersPage } from './nav';
import { Page } from './page';
import './page.css';
import { readReport } from './page-data';

/** The page's root, exported so the test that mounts it can unmount it before its window goes. */
export const root = createRoot(document.getElementById('root')!);
root.render(
  <Page report={readReport(document)} partner={isPartnersPage(window.location.protocol)} />,
);
