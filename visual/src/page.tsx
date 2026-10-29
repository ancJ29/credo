import { LANGUAGES, type Language } from '@credo/shared';
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type Bulk, fillIn, openToBulk, yesTo } from './bulk';
import { LABEL } from './block';
import {
  blockOf,
  type Choices,
  loadChoices,
  loadGuideSeen,
  loadLabel,
  loadMade,
  loadOnly,
  type Made,
  saveChoices,
  saveGuideSeen,
  saveLabel,
  saveMade,
  saveOnly,
} from './choices';
import type { Fill } from './fill';
import { HUMAN, LANGUAGE_LABEL, markIn, plural, type Whose } from './marks';
import {
  landOn,
  leftIn,
  neighbour,
  nextLabel,
  nextUnanswered,
  opening,
  type Place,
  placesOf,
  visibleOf,
} from './nav';
import { Guide } from './guide';
import { Rail } from './rail';
import type { Report, ReportScreen, ReportWalk } from './report';
import { type Choose, ScreenCard, type View } from './screen';
import { type Notice, Send } from './send';
import { normalizeLabel } from './share';
import type { Tally } from './states';
import { answerKey, DEVICE_LABEL } from './walks';

function Pill({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`w-pill w-${kind}`}>{children}</span>;
}

/** What is on record: what waits, what was said no to, and what is answered; nothing for a zero. */
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

function WalkSection({
  report,
  walk,
  action,
  children,
}: {
  report: Report;
  walk: ReportWalk;
  action: string;
  children: ReactNode;
}) {
  const person = report.people.find((candidate) => candidate.id === walk.person)!;
  return (
    <section
      id={walk.id}
      className="w-walk"
      aria-labelledby={`${walk.id}-title`}
      data-action={action}
    >
      <div className="w-walk-head">
        <h2 id={`${walk.id}-title`}>{walk.title.en}</h2>
        <p className="w-sub">
          <span lang="vi">{walk.title.vi}</span>. {person.name.en} on a{' '}
          {DEVICE_LABEL[person.device]}; every screen is drawn at{' '}
          {report.devices.map((device) => `${device.label} ${device.width}`).join(', ')} pixels
        </p>
        <TallyPills tally={walk.tally} />
      </div>
      {children}
    </section>
  );
}

/** The map of the day: the parts across, the people down; a walk is a card, an empty cell hatched. */
function DayMap({ report, onOpen }: { report: Report; onOpen: (walkId: string) => void }) {
  return (
    <section className="w-map-section" aria-labelledby="map-title">
      <h2 id="map-title">The map of the day</h2>
      <div className="w-map" style={{ ['--parts' as string]: report.parts.length }}>
        <span aria-hidden="true" />
        {report.parts.map((part) => (
          <span key={part.id} className="w-colhead">
            {part.name.en}
          </span>
        ))}
        {report.people.map((person) => (
          <div key={person.id} className="w-row">
            <div className="w-person">
              <b>{person.name.en}</b>
              <span>{DEVICE_LABEL[person.device]}</span>
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
                    <a
                      key={walk.id}
                      className="w-cell"
                      href={`#${walk.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        onOpen(walk.id);
                      }}
                    >
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

/** The line atop the screen: where you are, how to move, and what a key does. */
function Where({
  walk,
  screen,
  view,
  report,
  prev,
  next,
  nextText,
  done,
  said,
  onGo,
  onNext,
  onList,
  onHelp,
}: {
  walk: ReportWalk;
  screen: ReportScreen;
  view: View;
  report: Report;
  prev: Place | undefined;
  next: Place | undefined;
  nextText: { text: string; none: boolean };
  /** Nothing waits on the page: how many are answered, and the last action. */
  done: { text: string; label: string; off: boolean; onDone: () => void } | undefined;
  said: string;
  onGo: (id: string) => void;
  onNext: () => void;
  onList: () => void;
  onHelp: () => void;
}) {
  const device = report.devices.find((candidate) => candidate.id === view.show);
  return (
    <div className="w-where">
      <p className="w-place">
        <button type="button" className="w-screens" onClick={onList}>
          Screens
        </button>
        <span>
          {walk.title.en} · screen {screen.number} of {walk.screens.length} ·{' '}
          {LANGUAGE_LABEL[view.language]} ·{' '}
          {device ? `${device.label} ${device.width}` : 'all three widths'}
        </span>
        <button type="button" className="w-help" aria-label="How this page works" onClick={onHelp}>
          ?
        </button>
      </p>
      <div className="w-moves">
        <button type="button" disabled={!prev} onClick={() => onGo(prev!.id)}>
          ‹ Prev
        </button>
        <button type="button" disabled={!next} onClick={() => onGo(next!.id)}>
          Next ›
        </button>
        {done ? (
          <>
            <span className="w-all">{done.text}</span>
            <button type="button" className="w-next" disabled={done.off} onClick={done.onDone}>
              {done.label}
            </button>
          </>
        ) : (
          <button type="button" className="w-next" disabled={nextText.none} onClick={onNext}>
            {nextText.text}
          </button>
        )}
      </div>
      <p className="w-keys">
        Keys: J next · K previous · Y yes · N no · L other language · U next unanswered
      </p>
      <p className="w-moved" aria-live="polite">
        {said}
      </p>
      {screen.path === 'wrong' && <p className="w-path">Goes wrong</p>}
    </div>
  );
}

/** A key typed where text is typed, or with a modifier, is the browser's, not the page's. */
function isTyping(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  return (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    target.closest(
      'textarea, select, [contenteditable], input:not([type="radio"], [type="checkbox"], [type="button"])',
    ) !== null
  );
}

const NO_CHOICE = { answer: '', reason: '' } as const;

const otherLanguage = (language: Language) => LANGUAGES.find((one) => one !== language)!;

/**
 * The walks page: the build line and the map of the day, then a desk of the list and the one screen
 * in view, and the bar at the foot that copies the answers. The address names the screen.
 */
export function Page({ report, partner = false }: { report: Report; partner?: boolean }) {
  const { build } = report;
  const places = useMemo(() => placesOf(report), [report]);
  const [choices, setChoices] = useState(() => loadChoices(report));
  useEffect(() => saveChoices(report, choices), [report, choices]);
  const [label, setLabel] = useState(loadLabel);
  const whose: Whose = partner ? { partner: true, label: normalizeLabel(label) } : HUMAN;

  const [start] = useState(() => opening(places, choices, whose, window.location.hash, loadOnly()));
  const [current, setCurrent] = useState(start.id);
  const [only, setOnly] = useState(start.only);
  const [said, setSaid] = useState(start.said);
  const [stay, setStay] = useState<string>();
  useEffect(() => saveOnly(only), [only]);
  const [view, setView] = useState<View>({ language: LANGUAGES[0], show: 'pc' });
  const [listOpen, setListOpen] = useState(false);
  const [asked, setAsked] = useState(0);
  const [notice, setNotice] = useState<Notice>({ text: '' });
  const setNote = (text: string) => setNotice({ text });
  const [undo, setUndo] = useState<{
    before: Choices;
    label?: string;
    made: Made;
  }>();
  /**
   * The keys a bulk action or a paste answered, which a change of label re-judges; a paste's
   * carry the label it filled them under. Kept in the browser, as the choices are.
   */
  const [made, setMade] = useState<Made>(
    () => new Map([...loadMade()].filter(([at]) => at in choices)),
  );
  useEffect(() => saveMade(made), [made]);
  const [guideOpen, setGuideOpen] = useState(() => !loadGuideSeen());
  useEffect(() => {
    if (guideOpen) saveGuideSeen();
  }, [guideOpen]);
  const entries = useMemo(
    () =>
      new Map(
        places.flatMap((one) =>
          LANGUAGES.map(
            (language) =>
              [
                answerKey(one.walk.id, one.screen.id, language),
                one.screen.languages[language],
              ] as const,
          ),
        ),
      ),
    [places],
  );

  const place = places.find(({ id }) => id === current)!;
  const shown = visibleOf(places, choices, whose, only, stay);
  const none = only && shown.length === 0;
  /** A partner's bulk answers wait for a label, as Share does: their record is read by it. */
  const bulkOff = partner && !LABEL.test(normalizeLabel(label));
  const key = answerKey(place.walk.id, place.screen.id, view.language);
  const reason = useRef('');
  reason.current = `${key}:reason`;
  useEffect(() => {
    if (asked > 0) document.getElementById(reason.current)?.focus();
  }, [asked]);

  const choose: Choose = (at, choice) => {
    setChoices((before) => ({ ...before, [at]: choice }));
    setMade((before) => new Map([...before].filter(([one]) => one !== at)));
    setStay(current);
    if (undo) {
      setUndo(undefined);
      setNote('');
    }
  };
  /** A bulk action or a paste: it acts at once, says what it did, and can be undone until a choice changes. */
  const apply = (bulk: Bulk, said: string, label?: string, pastedUnder: string | null = null) => {
    setChoices(bulk.next);
    setUndo({ before: bulk.undo, label, made });
    setMade(
      new Map([
        ...[...made].filter(([one]) => one in bulk.next),
        ...Object.keys(bulk.next)
          .filter((one) => bulk.next[one] !== bulk.undo[one])
          .map((one) => [one, pastedUnder] as const),
      ]),
    );
    setNote(said);
    setStay(current);
  };
  const fillFrom = (fill: Fill) => {
    apply(
      fillIn(fill.fills, choices),
      `${fill.filled} filled`,
      fill.label ? label : undefined,
      fill.label ?? normalizeLabel(label),
    );
    if (fill.label) {
      setLabel(fill.label);
      saveLabel(fill.label);
    }
  };
  /** A label typed is kept as it is typed; it is judged once it is left, and when Share is pressed. */
  const changeLabel = (typed: string) => {
    setLabel(typed);
    saveLabel(typed);
  };
  /**
   * What a bulk action answered is judged again, as the label's own record: an answer its record
   * already holds, or a paste's answers filled under another label, are taken back. Returns the
   * choices as they stand after it.
   */
  const judgeLabel = (): Choices => {
    const reading: Whose = { partner: true, label: normalizeLabel(label) };
    if (!LABEL.test(reading.label)) return choices;
    const taken = [...made]
      .filter(
        ([at, under]) =>
          !openToBulk(entries.get(at)!, undefined, reading) ||
          (under !== null && under !== reading.label),
      )
      .map(([at]) => at);
    if (taken.length === 0) return choices;
    const after = Object.fromEntries(Object.entries(choices).filter(([at]) => !taken.includes(at)));
    setChoices(after);
    setMade(new Map([...made].filter(([at]) => !taken.includes(at))));
    setUndo(undefined);
    setNote(
      `${plural(taken.length, 'answer')} taken back: ${reading.label} had answered them already`,
    );
    return after;
  };
  const bothCount = yesTo([place], choices, whose).count;
  const go = (id: string, language?: Language) => {
    setCurrent(id);
    setStay(undefined);
    setSaid('');
    setListOpen(false);
    if (language) setView((before) => ({ ...before, language }));
    if (window.location.hash !== `#${id}`) window.history.pushState(null, '', `#${id}`);
  };
  const next = nextUnanswered(places, { id: current, language: view.language }, choices, whose);
  const goNext = () => {
    if (!next) {
      setSaid('Nothing left to answer.');
      return;
    }
    go(next.id, next.language);
    if (next.wrapped) setSaid('Back at the first screen: that was the last one waiting.');
  };
  const toggle = (on: boolean) => {
    setOnly(on);
    setStay(undefined);
    setSaid('');
    if (on && leftIn(place, choices, whose).length === 0 && next) go(next.id, next.language);
  };
  const openWalk = (walkId: string) => {
    const landed = landOn(places, choices, whose, walkId, only);
    go(landed.id);
    setSaid(landed.said);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      const mine = choices[key] ?? NO_CHOICE;
      const step = (by: 1 | -1) => {
        const to = neighbour(shown, current, by);
        if (to) go(to.id);
      };
      if (document.querySelector('dialog[open]')) return;
      const typed = event.key.toLowerCase();
      if (typed === '?') {
        event.preventDefault();
        setGuideOpen(true);
        return;
      }
      if (none && ['y', 'n', 'l'].includes(typed)) return;
      const keys: Record<string, () => void> = {
        j: () => step(1),
        k: () => step(-1),
        y: () => choose(key, { ...mine, answer: 'yes' }),
        n: () => {
          choose(key, { ...mine, answer: 'no' });
          setAsked((count) => count + 1);
        },
        l: () => setView((before) => ({ ...before, language: otherLanguage(before.language) })),
        u: goNext,
      };
      const act = keys[typed];
      if (!act) return;
      event.preventDefault();
      act();
    };
    const onHash = () => {
      const opened = opening(places, choices, whose, window.location.hash, only);
      setCurrent(opened.id);
      setOnly(opened.only);
      setSaid(opened.said);
      setStay(undefined);
    };
    document.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  });

  const moved = useRef(false);
  useLayoutEffect(() => {
    if (moved.current) document.getElementById(current)?.scrollIntoView({ block: 'start' });
    moved.current = true;
  }, [current]);

  const nothingWaits = places.every((one) => leftIn(one, choices, whose).length === 0);
  const here = choices[key] ?? NO_CHOICE;
  const drawn = markIn(place.screen.languages[view.language], here, whose);
  let action = 'next';
  if (here.answer === 'no' && here.reason.trim() === '') action = 'reason';
  else if (nothingWaits) action = 'done';
  else if (drawn === 'open' || drawn === 'again') action = 'answer';
  const chosen = blockOf(report, choices).answered;
  const finish = () =>
    document
      .querySelector<HTMLButtonElement>(partner ? '.w-send .w-share' : '.w-send .w-copy')!
      .click();
  return (
    <>
      <header className="w-head">
        <div className="w-intro">
          <h1>A business’s day in Credo</h1>
          <p className="w-sub">Who does what, on the device they use.</p>
          <p className="w-howto">Answer Yes or No for each screen; press ? for how.</p>
        </div>
        <div className="w-meta">
          <p className="w-build">
            Branch <code>{build.branch}</code>, commit <code>{build.commit}</code>
            {build.changed && ' with changes'}, committed {build.committed}; built {build.built}.
          </p>
          <TallyPills tally={report.tally} />
        </div>
      </header>
      <main className="w-main">
        <DayMap report={report} onOpen={openWalk} />
        <div className="w-desk">
          <Rail
            report={report}
            places={places}
            view={view}
            onView={setView}
            choices={choices}
            whose={whose}
            current={current}
            only={only}
            onOnly={toggle}
            shown={shown}
            open={listOpen}
            onGo={go}
            onClose={() => setListOpen(false)}
            onBulk={apply}
            onFill={fillFrom}
            bulkOff={bulkOff}
          />
          <div className="w-walks">
            {none ? (
              <section className="w-walk w-done" aria-labelledby="done-title">
                <h2 id="done-title">Nothing left to answer</h2>
                <p>All {plural(places.length * LANGUAGES.length, 'answer')} are given.</p>
                <div className="w-moves">
                  <button type="button" className="w-next" disabled={chosen === 0} onClick={finish}>
                    {partner ? 'Share' : 'Copy my answers'}
                  </button>
                  <button type="button" onClick={() => toggle(false)}>
                    Show all screens
                  </button>
                </div>
              </section>
            ) : (
              <WalkSection report={report} walk={place.walk} action={action}>
                <Where
                  walk={place.walk}
                  screen={place.screen}
                  view={view}
                  report={report}
                  prev={neighbour(shown, current, -1)}
                  next={neighbour(shown, current, 1)}
                  nextText={{ text: nextLabel(next, places, current), none: !next }}
                  done={
                    nothingWaits
                      ? {
                          text: `All ${places.length * LANGUAGES.length} answered`,
                          label: partner ? 'Share' : 'Copy my answers',
                          off: chosen === 0,
                          onDone: finish,
                        }
                      : undefined
                  }
                  said={said}
                  onGo={go}
                  onNext={goNext}
                  onList={() => setListOpen(true)}
                  onHelp={() => setGuideOpen(true)}
                />
                <ScreenCard
                  report={report}
                  walk={place.walk}
                  screen={place.screen}
                  view={view}
                  choices={choices}
                  choose={choose}
                  whose={whose}
                  onNo={() => setAsked((count) => count + 1)}
                  onBoth={() => apply(yesTo([place], choices, whose), `${bothCount} answered Yes`)}
                  bothCount={bothCount}
                  bothOff={bulkOff}
                  onShow={(language) => setView((before) => ({ ...before, language }))}
                />
              </WalkSection>
            )}
            {report.orphans.length > 0 && (
              <section className="w-orphans" aria-labelledby="orphans-title">
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
          </div>
        </div>
      </main>
      <Send
        report={report}
        choices={choices}
        whose={whose}
        label={label}
        onLabel={changeLabel}
        onLabelDone={judgeLabel}
        onOpenWalk={openWalk}
        onGo={go}
        note={notice}
        onNote={setNotice}
        onUndo={
          undo
            ? () => {
                setChoices(undo.before);
                setMade(undo.made);
                if (undo.label !== undefined) {
                  setLabel(undo.label);
                  saveLabel(undo.label);
                }
                setUndo(undefined);
                setNote('');
              }
            : undefined
        }
        action={action}
      />
      <Guide open={guideOpen} partner={partner} onClose={() => setGuideOpen(false)} />
    </>
  );
}
