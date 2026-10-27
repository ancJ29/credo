import { LANGUAGES, type Language } from '@credo/shared';
import { Frame, SCREENS } from '@credo/ui/mock';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { type Choice, type Choices, blockOf, loadChoices, saveChoices } from './choices';
import type { Report, ReportScreen, ReportWalk } from './report';
import { type Shown, type Tally, tallyOf } from './states';
import { answerKey, DEVICE_LABEL } from './walks';

const LANGUAGE_LABEL: Record<Language, string> = { vi: 'Tiếng Việt', en: 'English' };

const stateOf = (screen: ReportScreen) =>
  SCREENS.find((candidate) => candidate.number === screen.mock.screen)!.states.find(
    (state) => state.id === screen.mock.state,
  )!;

const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

function Pill({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`w-pill w-${kind}`}>{children}</span>;
}

/** What waits, what was said no to, and what is answered, as pills; nothing for a zero. */
function TallyPills({ tally }: { tally: Tally }) {
  return (
    <span className="w-pills">
      {tally.waiting > 0 && <Pill kind="waiting">{tally.waiting} waiting</Pill>}
      {tally.changed > 0 && <Pill kind="changed">{tally.changed} asked again</Pill>}
      {tally.no > 0 && <Pill kind="no">{tally.no} no</Pill>}
      {tally.yes > 0 && <Pill kind="yes">{tally.yes} yes</Pill>}
    </span>
  );
}

function Lines({ title, lines }: { title: string; lines: readonly string[] }) {
  return (
    <div>
      <p className="w-label">{title}</p>
      <pre className="w-words">{lines.join('\n')}</pre>
    </div>
  );
}

/** The answer beside a drawn screen. */
function Answer({ shown }: { shown: Shown }) {
  switch (shown.kind) {
    case 'waiting':
      return <Pill kind="waiting">Not yet asked</Pill>;
    case 'yes':
      return <Pill kind="yes">Yes · {shown.on}</Pill>;
    case 'no':
      return (
        <>
          <Pill kind="no">No · {shown.on}</Pill>
          <p className="w-reason">{shown.reason}</p>
        </>
      );
    case 'changed':
      return (
        <>
          <Pill kind="changed">Asked again</Pill>
          <p className="w-reason">
            Its words changed since the {shown.answer} of {shown.on}.
          </p>
          <div className="w-compare">
            <Lines title="Words before" lines={shown.before} />
            <Lines title="Words now" lines={shown.now} />
          </div>
        </>
      );
  }
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

type Choose = (key: string, choice: Choice) => void;

/** Yes or No, and the reason a No needs, for one screen in one language. Nothing is sent. */
function Choosing({
  id,
  choice,
  onChange,
}: {
  id: string;
  choice: Choice;
  onChange: (c: Choice) => void;
}) {
  const lacksReason = choice.answer === 'no' && choice.reason.trim() === '';
  return (
    <fieldset className="w-choose">
      <legend>Your answer</legend>
      <div className="w-radios">
        {(['yes', 'no'] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={id}
              checked={choice.answer === value}
              onChange={() => onChange({ ...choice, answer: value })}
            />
            {value === 'yes' ? 'Yes' : 'No'}
          </label>
        ))}
        <button type="button" onClick={() => onChange({ answer: '', reason: '' })}>
          Clear
        </button>
      </div>
      <textarea
        aria-label="Reason"
        placeholder="Reason (needed for a No)"
        rows={2}
        required={choice.answer === 'no'}
        aria-invalid={lacksReason}
        value={choice.reason}
        onChange={(event) => onChange({ ...choice, reason: event.target.value })}
      />
    </fieldset>
  );
}

const NO_CHOICE: Choice = { answer: '', reason: '' };

function ScreenCard({
  report,
  walk,
  screen,
  choices,
  choose,
}: {
  report: Report;
  walk: ReportWalk;
  screen: ReportScreen;
  choices: Choices;
  choose: Choose;
}) {
  const state = stateOf(screen);
  const settled = LANGUAGES.every((language) => screen.languages[language].shown.kind === 'yes');
  const columns = report.devices.map((device) => `minmax(0, ${device.width}fr)`).join(' ');
  return (
    <details className="w-card" open={!settled} id={`${walk.id}-${screen.id}`}>
      <summary>
        <span className="w-number">{screen.number}</span>
        <span className="w-sentence">
          <b lang="en">{screen.sentence.en}</b>
          <span lang="vi">{screen.sentence.vi}</span>
        </span>
        <TallyPills
          tally={tallyOf(LANGUAGES.map((language) => screen.languages[language].shown))}
        />
      </summary>
      <p className="w-question">{screen.question}</p>
      <div className="w-languages">
        {LANGUAGES.map((language) => {
          const key = answerKey(walk.id, screen.id, language);
          return (
            <section key={language} className="w-language" aria-label={LANGUAGE_LABEL[language]}>
              <p className="w-label">{LANGUAGE_LABEL[language]}</p>
              <div className="w-frames" style={{ ['--cols' as string]: columns }}>
                {report.devices.map((device) => (
                  <figure key={device.id} className="w-frame">
                    <figcaption className="w-label">
                      {device.label} · {device.width}
                    </figcaption>
                    <Scaled width={device.width}>
                      <Frame
                        title={`${screen.number} ${screen.id} · ${language} · ${device.width}`}
                        colour={state.colour}
                        language={language}
                        scheme="light"
                        width={device.width}
                      >
                        {state.screen}
                      </Frame>
                    </Scaled>
                  </figure>
                ))}
              </div>
              <div className="w-answer">
                <div className="w-shown">
                  <Answer shown={screen.languages[language].shown} />
                </div>
                <Choosing
                  id={key}
                  choice={choices[key] ?? NO_CHOICE}
                  onChange={(choice) => choose(key, choice)}
                />
              </div>
              <details>
                <summary>The words</summary>
                <pre className="w-words">{screen.languages[language].words.join('\n')}</pre>
              </details>
            </section>
          );
        })}
      </div>
    </details>
  );
}

function WalkSection({
  report,
  walk,
  choices,
  choose,
}: {
  report: Report;
  walk: ReportWalk;
  choices: Choices;
  choose: Choose;
}) {
  const person = report.people.find((candidate) => candidate.id === walk.person)!;
  const group = (path: ReportScreen['path'], heading: string) => {
    const screens = walk.screens.filter((screen) => screen.path === path);
    return (
      screens.length > 0 && (
        <>
          <h3>{heading}</h3>
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              report={report}
              walk={walk}
              screen={screen}
              choices={choices}
              choose={choose}
            />
          ))}
        </>
      )
    );
  };
  return (
    <section id={walk.id} className="w-walk" aria-labelledby={`${walk.id}-title`}>
      <h2 id={`${walk.id}-title`}>{walk.title.en}</h2>
      <p className="w-sub">
        {walk.title.vi} · {person.name.en} on a {DEVICE_LABEL[person.device]}; every screen is drawn
        at {report.devices.map((device) => `${device.label} ${device.width}`).join(', ')} pixels
      </p>
      <TallyPills tally={walk.tally} />
      {group('main', 'The main path')}
      {group('wrong', 'What can go wrong')}
    </section>
  );
}

/** The map of the day: the parts across, the people down; a walk is a card, an empty cell hatched. */
function DayMap({ report }: { report: Report }) {
  return (
    <section aria-labelledby="map-title">
      <h2 id="map-title">The map of the day</h2>
      <div className="w-map" style={{ ['--parts' as string]: report.parts.length }}>
        <span aria-hidden="true" />
        {report.parts.map((part) => (
          <span key={part.id} className="w-label w-colhead">
            {part.name.en}
          </span>
        ))}
        {report.people.map((person) => (
          <div key={person.id} className="w-row">
            <div className="w-person">
              <b>{person.name.en}</b>
              <span className="w-label">{DEVICE_LABEL[person.device]}</span>
            </div>
            {report.parts.map((part) => {
              const walks = report.walks.filter(
                (walk) => walk.person === person.id && walk.part === part.id,
              );
              return walks.length === 0 ? (
                <div key={part.id} className="w-cell w-empty" title="Not built yet" />
              ) : (
                <div key={part.id} className="w-cell-group">
                  {walks.map((walk) => (
                    <a key={walk.id} className="w-cell" href={`#${walk.id}`}>
                      <b>{walk.title.en}</b>
                      <span className="w-sub">{plural(walk.screens.length, 'screen')}</span>
                      <TallyPills tally={walk.tally} />
                    </a>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

/** The bar that turns the choices into the block for the chat. */
function Send({ report, choices }: { report: Report; choices: Choices }) {
  const [block, setBlock] = useState('');
  const [note, setNote] = useState('');
  const { answered } = blockOf(report, choices);

  const copy = async () => {
    const made = blockOf(report, choices);
    setBlock('');
    if (made.answered === 0) {
      setNote('Nothing answered yet.');
    } else if (made.missing.length > 0) {
      setNote(`A No needs its reason: ${made.missing.join(', ')}`);
    } else {
      setBlock(made.text);
      try {
        await navigator.clipboard.writeText(made.text);
        setNote('Copied. Paste it into the chat.');
      } catch {
        setNote('Select the text below, copy it and paste it into the chat.');
      }
    }
  };

  return (
    <section className="w-send" aria-label="Your answers">
      <div className="w-send-row">
        <button type="button" className="w-copy" onClick={() => void copy()}>
          Copy my answers
        </button>
        <span>{plural(answered, 'answer')} chosen</span>
        <span role="status">{note}</span>
      </div>
      {block !== '' && (
        <textarea
          readOnly
          className="w-block"
          aria-label="The block to paste into the chat"
          rows={Math.min(10, block.split('\n').length)}
          value={block}
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </section>
  );
}

/** The walks page: the build line, the map of the day, then each walk's screens. */
export function Page({ report }: { report: Report }) {
  const { build } = report;
  const [choices, setChoices] = useState(() => loadChoices(report));
  useEffect(() => saveChoices(report, choices), [report, choices]);
  const choose: Choose = (key, choice) => setChoices((before) => ({ ...before, [key]: choice }));
  return (
    <>
      <main className="w-wrap">
        <header>
          <h1>A business’s day in Credo</h1>
          <p className="w-sub">Who does what, on the device they use.</p>
          <p className="w-howto">
            Answer each screen in each language: Yes or No, and a reason for any No. Then press
            “Copy my answers” and paste the block into the chat; this page sends nothing.
          </p>
          <p className="w-build">
            Branch <code>{build.branch}</code>, commit <code>{build.commit}</code>
            {build.changed && ' with changes'}, committed {build.committed}; built {build.built}.
          </p>
          <TallyPills tally={report.tally} />
        </header>
        <DayMap report={report} />
        {report.walks.map((walk) => (
          <WalkSection
            key={walk.id}
            report={report}
            walk={walk}
            choices={choices}
            choose={choose}
          />
        ))}
        {report.orphans.length > 0 && (
          <section aria-labelledby="orphans-title">
            <h2 id="orphans-title">Answers whose screen left the walks</h2>
            <ul>
              {report.orphans.map((orphan) => (
                <li key={orphan.key}>
                  <code>{orphan.key}</code>: {orphan.answer} on {orphan.on}
                  {orphan.reason && `, ${orphan.reason}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Send report={report} choices={choices} />
    </>
  );
}
