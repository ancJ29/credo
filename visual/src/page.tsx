import { LANGUAGES } from '@credo/shared';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadChoices, saveChoices, type Choices } from './choices';
import { inPageOrder, plural, screenId } from './marks';
import { Rail, useCurrent } from './rail';
import type { Report, ReportScreen, ReportWalk } from './report';
import { type Choose, ScreenCard, type View } from './screen';
import { Send } from './send';
import type { Tally } from './states';
import { DEVICE_LABEL } from './walks';

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
  view,
  choices,
  choose,
}: {
  report: Report;
  walk: ReportWalk;
  view: View;
  choices: Choices;
  choose: Choose;
}) {
  const person = report.people.find((candidate) => candidate.id === walk.person)!;
  const group = (path: ReportScreen['path'], heading: string) => {
    const screens = walk.screens.filter((screen) => screen.path === path);
    return (
      screens.length > 0 && (
        <>
          <h3 className="w-path">{heading}</h3>
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              report={report}
              walk={walk}
              screen={screen}
              view={view}
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
      <div className="w-walk-head">
        <h2 id={`${walk.id}-title`}>{walk.title.en}</h2>
        <p className="w-sub">
          <span lang="vi">{walk.title.vi}</span>. {person.name.en} on a{' '}
          {DEVICE_LABEL[person.device]}; every screen is drawn at{' '}
          {report.devices.map((device) => `${device.label} ${device.width}`).join(', ')} pixels
        </p>
        <TallyPills tally={walk.tally} />
      </div>
      {group('main', 'The main path')}
      {group('wrong', 'What can go wrong')}
    </section>
  );
}

/** The map of the day: the parts across, the people down; a walk is a card, an empty cell hatched. */
function DayMap({ report }: { report: Report }) {
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

/**
 * The walks page: the build line and the map of the day, then a desk of the rail and the walks,
 * every screen drawn in the one language and at the widths the rail shows, and the bar at the
 * foot that copies the answers. A change of view brings back the screen that was in view.
 */
export function Page({ report }: { report: Report }) {
  const { build } = report;
  const [choices, setChoices] = useState(() => loadChoices(report));
  useEffect(() => saveChoices(report, choices), [report, choices]);
  const choose: Choose = (key, choice) => setChoices((before) => ({ ...before, [key]: choice }));

  const [view, setView] = useState<View>({ language: LANGUAGES[0], show: 'all' });
  const current = useCurrent(
    report.walks.flatMap((walk) => inPageOrder(walk).map((screen) => screenId(walk, screen))),
  );
  const keep = useRef<string>(undefined);
  const changeView = (next: View) => {
    keep.current = current;
    setView(next);
  };
  useLayoutEffect(() => {
    if (keep.current) document.getElementById(keep.current)!.scrollIntoView({ block: 'start' });
    keep.current = undefined;
  }, [view]);

  return (
    <>
      <header className="w-head">
        <div className="w-intro">
          <h1>A business’s day in Credo</h1>
          <p className="w-sub">Who does what, on the device they use.</p>
          <p className="w-howto">
            Answer each screen’s question Yes or No, in Tiếng Việt and in English, with a reason for
            any No. Then press “Copy my answers” and paste the block into the chat; this page sends
            nothing.
          </p>
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
        <DayMap report={report} />
        <div className="w-desk">
          <Rail
            report={report}
            view={view}
            onView={changeView}
            choices={choices}
            current={current}
          />
          <div className="w-walks">
            {report.walks.map((walk) => (
              <WalkSection
                key={walk.id}
                report={report}
                walk={walk}
                view={view}
                choices={choices}
                choose={choose}
              />
            ))}
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
      <Send report={report} choices={choices} />
    </>
  );
}
