import { LANGUAGES, type Language } from '@credo/shared';
import { DEMO_CONFIG } from '@credo/shared/demo';
import { Frame, SCREENS } from '@credo/ui/mock';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Choice, Choices } from './choices';
import { LANGUAGE_LABEL, MARK_TEXT, markOf, screenId } from './marks';
import type { Report, ReportScreen, ReportWalk } from './report';
import { SceneView } from './scene';
import type { Held, Shown } from './states';
import { answerKey } from './walks';

export type Choose = (key: string, choice: Choice) => void;

/** The view the whole page is drawn in: one language, and one device or all three. */
export type View = { language: Language; show: Report['devices'][number]['id'] | 'all' };

const NO_CHOICE: Choice = { answer: '', reason: '' };

export const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** What a screen draws in a frame: the mock's state, or its scene, the app itself on the fake. */
function drawing(screen: ReportScreen, language: Language) {
  const { scene, mock } = screen;
  if (scene) {
    return {
      colour: DEMO_CONFIG.colour,
      path: scene.path,
      node: <SceneView scene={scene} language={language} />,
    };
  }
  const state = SCREENS.find((candidate) => candidate.number === mock!.screen)!.states.find(
    (found) => found.id === mock!.state,
  )!;
  return { colour: state.colour, path: undefined, node: state.screen };
}

/**
 * A screen's two marks, one a language: outlined while open, filled for a yes, filled and struck
 * through for a no, dashed when asked again, so the state reads without its colour.
 */
export function Marks({
  walk,
  screen,
  choices,
}: {
  walk: ReportWalk;
  screen: ReportScreen;
  choices: Choices;
}) {
  return (
    <span className="w-marks">
      {LANGUAGES.map((language) => {
        const mark = markOf(
          screen.languages[language].shown,
          choices[answerKey(walk.id, screen.id, language)],
        );
        return (
          <span key={language} className="w-mark" data-mark={mark}>
            <span aria-hidden="true">{language.toUpperCase()}</span>
            <span className="w-sr">
              {LANGUAGE_LABEL[language]}: {MARK_TEXT[mark]}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * A box at a device's width, scaled down to fit the room it has. Its height follows the screen's
 * (the frame fits its own), scaled the same.
 */
function Scaled({ width, children }: { width: number; children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const fit = () => {
      setScale(Math.min(1, outer.current!.clientWidth / width));
      setHeight(inner.current!.offsetHeight);
    };
    const watcher = new ResizeObserver(fit);
    watcher.observe(outer.current!);
    watcher.observe(inner.current!);
    return () => watcher.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="w-scaled" style={{ height: height ? height * scale : undefined }}>
      <div ref={inner} style={{ width, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        {children}
      </div>
    </div>
  );
}

const Check = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
    <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const Cross = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16">
    <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);

/** What is on record for the screen in this language, and what a choice made here will do. */
function stateLine(shown: Shown, choice: Choice) {
  if (choice.answer !== '') {
    const chosen = `Your ${capital(choice.answer)} goes into the block when you copy.`;
    if (shown.kind === 'waiting') return chosen;
    const recorded = shown.kind === 'changed' ? shown.answer : shown.kind;
    return `${chosen} It replaces the ${recorded} of ${shown.on}.`;
  }
  switch (shown.kind) {
    case 'waiting':
      return 'Not answered yet.';
    case 'yes':
      return `Answered yes on ${shown.on}.`;
    case 'no':
      return `Answered no on ${shown.on}: ${shown.reason}`;
    case 'changed':
      return `Asked again: its words changed since the ${shown.answer} of ${shown.on}.`;
  }
}

/**
 * The screen's question and its answer in the page's language, one panel beside the drawn
 * screens: Yes or No, the reason a No needs, and one line on what is on record. Nothing is sent.
 */
function Panel({
  screen,
  language,
  name,
  choice,
  onChange,
}: {
  screen: ReportScreen;
  language: Language;
  name: string;
  choice: Choice;
  onChange: (choice: Choice) => void;
}) {
  const lacksReason = choice.answer === 'no' && choice.reason.trim() === '';
  return (
    <div className="w-panel">
      <p className="w-question" id={`${name}:question`}>
        {screen.question}
      </p>
      <fieldset className="w-choose" aria-describedby={`${name}:question`}>
        <legend>Your answer in {LANGUAGE_LABEL[language]}</legend>
        <div className="w-yesno">
          {(['yes', 'no'] as const).map((value) => (
            <label key={value} className="w-big" data-value={value}>
              <input
                type="radio"
                className="w-hide"
                name={name}
                checked={choice.answer === value}
                onChange={() => onChange({ ...choice, answer: value })}
              />
              <span className="w-face">
                {value === 'yes' ? <Check /> : <Cross />}
                {capital(value)}
              </span>
            </label>
          ))}
        </div>
        {choice.answer === 'no' && (
          <div className="w-reason">
            <label htmlFor={`${name}:reason`}>Reason for the No</label>
            <textarea
              id={`${name}:reason`}
              rows={3}
              required
              aria-invalid={lacksReason}
              placeholder="What is wrong, in a line"
              value={choice.reason}
              onChange={(event) => onChange({ ...choice, reason: event.target.value })}
            />
          </div>
        )}
      </fieldset>
      <p className="w-state">
        <span>{stateLine(screen.languages[language].shown, choice)}</span>
        {choice.answer !== '' && (
          <button type="button" className="w-clear" onClick={() => onChange(NO_CHOICE)}>
            Clear
          </button>
        )}
      </p>
    </div>
  );
}

/** One partner's answer to the screen, as the human's is read: it marks nothing and counts in no bar. */
function partnerLine(label: string, shown: Held) {
  switch (shown.kind) {
    case 'yes':
      return `${label}: yes on ${shown.on}.`;
    case 'no':
      return `${label}: no on ${shown.on}: ${shown.reason}`;
    case 'changed':
      return `${label}: asked again, its words changed since the ${shown.answer} of ${shown.on}.`;
  }
}

function Lines({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <div>
      <p className="w-lines-title">{title}</p>
      <pre className="w-lines">{lines.join('\n')}</pre>
    </div>
  );
}

/**
 * The words the answer is keyed to, the machine's record: folded, unless they changed since an
 * answer, when the words before and now are what the human reads.
 */
function Words({ shown, words }: { shown: Shown; words: readonly string[] }) {
  if (shown.kind === 'changed') {
    return (
      <details className="w-words" open>
        <summary>What changed in the screen’s words</summary>
        <div className="w-compare">
          <Lines title="Words before" lines={shown.before} />
          <Lines title="Words now" lines={shown.now} />
        </div>
      </details>
    );
  }
  return (
    <details className="w-words">
      <summary>The screen’s words, as the build read them</summary>
      <pre className="w-lines">{words.join('\n')}</pre>
    </details>
  );
}

/**
 * One walk screen: its number and sentence, then the screen drawn at the shown widths in the
 * page's language beside its question and answer. A screen answered yes in both languages folds.
 */
export function ScreenCard({
  report,
  walk,
  screen,
  view,
  choices,
  choose,
}: {
  report: Report;
  walk: ReportWalk;
  screen: ReportScreen;
  view: View;
  choices: Choices;
  choose: Choose;
}) {
  const { language, show } = view;
  const drawn = drawing(screen, language);
  const settled = LANGUAGES.every((one) => screen.languages[one].shown.kind === 'yes');
  const key = answerKey(walk.id, screen.id, language);
  const here = screen.languages[language];
  const devices = report.devices.filter((device) => show === 'all' || device.id === show);
  return (
    <details className="w-screen" open={!settled} id={screenId(walk, screen)}>
      <summary>
        <span className="w-number">{screen.number}</span>
        <span className="w-sentence">
          <b lang="en">{screen.sentence.en}</b>
          <span lang="vi">{screen.sentence.vi}</span>
        </span>
        <Marks walk={walk} screen={screen} choices={choices} />
      </summary>
      <div className="w-screen-body">
        <div className="w-screen-grid">
          <div className="w-stage">
            <div className="w-frames" data-show={show}>
              {devices.map((device) => (
                <figure
                  key={device.id}
                  className="w-frame"
                  data-device={device.id}
                  style={{ maxWidth: device.width }}
                >
                  <figcaption>
                    <b>{capital(device.label)}</b> {device.width} px
                  </figcaption>
                  <Scaled width={device.width}>
                    <Frame
                      key={language}
                      title={`Screen ${screen.number} in ${LANGUAGE_LABEL[language]}, ${capital(device.label)} ${device.width}`}
                      colour={drawn.colour}
                      language={language}
                      scheme="light"
                      width={device.width}
                      path={drawn.path}
                    >
                      {drawn.node}
                    </Frame>
                  </Scaled>
                </figure>
              ))}
            </div>
          </div>
          <Panel
            screen={screen}
            language={language}
            name={key}
            choice={choices[key] ?? NO_CHOICE}
            onChange={(choice) => choose(key, choice)}
          />
          {here.partners.length > 0 && (
            <ul className="w-partners" aria-label="Partners’ answers">
              {here.partners.map(({ label, shown }) => (
                <li key={label}>{partnerLine(label, shown)}</li>
              ))}
            </ul>
          )}
          <Words shown={here.shown} words={here.words} />
        </div>
      </div>
    </details>
  );
}
