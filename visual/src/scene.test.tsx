import { Stage } from '@credo/ui/mock';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SceneView } from './scene';
import type { Scene } from './walks';

const QUICK = { findFor: 150, stillFor: 10, stillAtMost: 100 };

const scene = (view: Scene, language: 'vi' | 'en' = 'en', quick = QUICK) =>
  render(
    <Stage colour="#2f7d6d" language={language} scheme="light" test path={view.path}>
      <SceneView scene={view} language={language} test limits={quick} />
    </Stage>,
  );
/** How long a test waits for a scene to end: the machine's load decides, not the scene. */
const ENDS = { timeout: 20_000 };
const phase = (container: HTMLElement) =>
  container.querySelector('[data-scene]')!.getAttribute('data-scene');

describe('a scene on the walks page', () => {
  it('draws the whole app on the fake at its address, as the person it names, and says when its steps are done', async () => {
    const { container } = scene({ path: '/staff', as: 'EMP-0001' });

    expect(phase(container)).toBe('running');
    expect(await screen.findByRole('heading', { level: 2, name: 'Staff' }, ENDS)).toBeTruthy();
    await waitFor(() => expect(phase(container)).toBe('done'), ENDS);
    expect(screen.getByRole('link', { name: 'Add a person' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Settings' })).toBeNull();
  });

  it('speaks the language it is given, and does its steps with that language’s words', async () => {
    const { container } = scene(
      {
        path: '/staff/new',
        steps: [
          { fill: 'addPerson.name', text: 'Mai Linh' },
          { fill: 'addPerson.code', text: 'EMP-0100' },
          { press: 'addPerson.submit' },
        ],
      },
      'vi',
    );

    await waitFor(() => expect(phase(container)).toBe('done'), ENDS);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Đã thêm nhân viên' }, ENDS),
    ).toBeTruthy();
  });

  it('shows why a step failed under the app, and stops', async () => {
    const { container } = scene({
      path: '/staff',
      steps: [{ press: 'staff.empty' }],
    });

    await waitFor(() => expect(phase(container)).toBe('failed'), ENDS);

    expect(container.querySelector('[data-scene-failed]')!.textContent).toBe(
      'step 1 ({"press":"staff.empty"}): found no button, link or choice named “No one is on the list yet.”',
    );
  });

  it('signs the operator in when the scene says so, and leaves the operator’s door shut when it does not', async () => {
    const { container, unmount } = scene({ path: '/operator/clients', operator: true });

    await waitFor(() => expect(phase(container)).toBe('done'), ENDS);
    expect(await screen.findByText('Bình An', {}, ENDS)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Clients' })).toBeTruthy();
    unmount();

    scene({ path: '/operator/clients' });
    expect(
      (await screen.findByRole('heading', { level: 2, name: 'Operator sign-in' }, ENDS))
        .textContent,
    ).toBe('Operator sign-in');
  });

  it('shows the failure of a call the scene cues, as the app does', async () => {
    const { container } = scene({ path: '/staff', cue: 'listEmployees:503' });

    await waitFor(() => expect(phase(container)).toBe('done'), ENDS);

    expect((await screen.findByRole('alert', {}, ENDS)).textContent).toContain(
      'could not be loaded',
    );
  });

  it('draws nothing more once it is gone, whether its steps ended or failed', async () => {
    for (const steps of [[], [{ press: 'staff.empty' }]]) {
      const { container, unmount } = scene({ path: '/staff', steps });
      expect(phase(container)).toBe('running');
      unmount();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(document.body.textContent).toBe('');
    }
  });

  it('waits as long as the build can afford when it is given no limits', async () => {
    const { container } = render(
      <Stage colour="#2f7d6d" language="en" scheme="light" test path="/staff">
        <SceneView scene={{ path: '/staff' }} language="en" test />
      </Stage>,
    );

    await waitFor(() => expect(phase(container)).toBe('done'), ENDS);
  });
});
