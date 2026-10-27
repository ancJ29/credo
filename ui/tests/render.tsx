import type { Language } from '@credo/shared';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { Providers } from '../src/Providers';

const inApp = (screen: ReactNode, language: Language) => (
  <Providers colour="#2f7d6d" language={language} test>
    <MemoryRouter initialEntries={['/settings']}>{screen}</MemoryRouter>
  </Providers>
);

/** A screen drawn as the app draws it: the look, the words, a router at Settings. */
export function draw(screen: ReactNode, language: Language = 'en') {
  const drawn = render(inApp(screen, language));
  return { ...drawn, rerender: (next: ReactNode) => drawn.rerender(inApp(next, language)) };
}

/** The whole app, which brings its own look and words, at `path`. */
export function drawApp(app: ReactNode, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}>{app}</MemoryRouter>);
}
