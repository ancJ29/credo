import '@fontsource-variable/noto-sans';
import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { MockPage } from './MockPage';

createRoot(document.getElementById('root')!).render(<MockPage />);
