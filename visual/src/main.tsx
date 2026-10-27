import '@fontsource-variable/noto-sans';
import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { Page } from './page';
import './page.css';
import { readReport } from './page-data';

createRoot(document.getElementById('root')!).render(<Page report={readReport(document)} />);
