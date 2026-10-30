import { DICTIONARIES } from '@credo/ui/words';
import { App, sceneParts } from '@credo/ui/scene';
import type { Language } from '@credo/shared';
import { DEMO_CUSTOM_FIELDS } from '@credo/shared/demo';
import { useEffect, useMemo, useState } from 'react';
import { demoImportFile } from '@credo/ui/import-demo';
import { type Limits, LIMITS, runSteps } from './steps';
import type { Scene } from './walks';

/** The words a step names: the app's dictionary, and under `field` the name of each of the demo
 * company's own fields in the language, which no dictionary holds. */
export const stepWords = (language: Language) => ({
  ...DICTIONARIES[language],
  field: Object.fromEntries(DEMO_CUSTOM_FIELDS.map((field) => [field.key, field.label[language]])),
});

type Status = { phase: 'running' | 'done' } | { phase: 'failed'; why: string };

/**
 * A scene: the whole app on the fake, signed in as the scene says and opened where it says, then
 * its steps done on it as a person would. It stands in the router the frame gives it, drawn live,
 * so the page's screens and the build's words are one app. The wrapper's `data-scene` says where
 * the steps are: `running`, `done`, or `failed` with the reason shown under it.
 */
export function SceneView({
  scene,
  language,
  test,
  limits = LIMITS,
}: {
  scene: Scene;
  language: Language;
  /** Switches Mantine's transitions off, as the build's reading of the words draws. */
  test?: boolean;
  /** How long the steps wait, which a test shortens. */
  limits?: Limits;
}) {
  const parts = useMemo(
    () =>
      sceneParts({
        as: scene.as,
        cue: scene.cue,
        signIns: scene.signIns,
        out: scene.out,
        language,
      }),
    [scene, language],
  );
  /** The wrapper once it stands in its page, which may be a frame's: the app and the steps wait for it. */
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>({ phase: 'running' });

  useEffect(() => {
    if (!host) return;
    let live = true;
    runSteps(host.ownerDocument.body, scene.steps ?? [], stepWords(language), limits, (which) =>
      demoImportFile(language, which),
    ).then(
      () => live && setStatus({ phase: 'done' }),
      (error: unknown) => live && setStatus({ phase: 'failed', why: (error as Error).message }),
    );
    return () => {
      live = false;
    };
  }, [host, scene, language, limits]);

  return (
    <div ref={setHost} data-scene={status.phase}>
      {host && (
        <App
          api={parts.api}
          device={parts.device}
          test={test}
          look={{ scheme: 'light', root: () => host.ownerDocument.documentElement }}
        />
      )}
      {status.phase === 'failed' && (
        <p role="note" data-scene-failed style={{ color: '#b42318', padding: 8 }}>
          {status.why}
        </p>
      )}
    </div>
  );
}
