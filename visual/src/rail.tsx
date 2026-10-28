import { LANGUAGES } from '@credo/shared';
import { useEffect, useState } from 'react';
import type { Choices } from './choices';
import { LANGUAGE_LABEL, screenId } from './marks';
import type { Report, ReportScreen } from './report';
import { capital, Marks, type View } from './screen';

/** One of a few, as a row of buttons: radios under their legend, so the keys and a reader know it. */
function Segmented<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="w-seg">
      <legend>{legend}</legend>
      <div className="w-seg-options">
        {options.map((option) => (
          <label key={option.value}>
            <input
              type="radio"
              className="w-hide"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="w-face">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * The section in a band near the top of the window, among the ids given, the first of them in
 * the page's order; none until the browser reports one. jsdom has no IntersectionObserver.
 */
export function useCurrent(ids: readonly string[]) {
  const [current, setCurrent] = useState<string>();
  const list = ids.join(' ');
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const order = list.split(' ');
    const inBand = new Set<string>();
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        const first = order.find((id) => inBand.has(id));
        if (first) setCurrent(first);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (const id of order) watcher.observe(document.getElementById(id)!);
    return () => watcher.disconnect();
  }, [list]);
  return current;
}

const PATHS: [ReportScreen['path'], string][] = [
  ['main', 'The main path'],
  ['wrong', 'What can go wrong'],
];

/**
 * The page's view and its place: the language and the widths every screen is drawn in, then each
 * walk's screens with their marks, the one in view marked as the current. A side rail on a PC and
 * a strip across the top on a phone, in view while the page scrolls.
 */
export function Rail({
  report,
  view,
  onView,
  choices,
  current,
}: {
  report: Report;
  view: View;
  onView: (view: View) => void;
  choices: Choices;
  current: string | undefined;
}) {
  return (
    <aside className="w-rail" aria-label="The view and the screens">
      <div className="w-view">
        <Segmented
          legend="Language"
          name="w-language"
          options={LANGUAGES.map((language) => ({
            value: language,
            label: LANGUAGE_LABEL[language],
          }))}
          value={view.language}
          onChange={(language) => onView({ ...view, language })}
        />
        <Segmented
          legend="Show"
          name="w-show"
          options={[
            ...report.devices.map((device) => ({ value: device.id, label: capital(device.label) })),
            { value: 'all' as const, label: 'All three' },
          ]}
          value={view.show}
          onChange={(show) => onView({ ...view, show })}
        />
      </div>
      <nav className="w-rail-nav" aria-label="The walks’ screens">
        {report.walks.map((walk) => (
          <div key={walk.id} className="w-rail-walk">
            <a className="w-rail-title" href={`#${walk.id}`}>
              {walk.title.en}
            </a>
            {PATHS.map(([path, heading]) => {
              const on = walk.screens.filter((screen) => screen.path === path);
              return (
                on.length > 0 && (
                  <div key={path} className="w-rail-group">
                    <p className="w-rail-path">{heading}</p>
                    <ul>
                      {on.map((screen) => {
                        const id = screenId(walk, screen);
                        return (
                          <li key={screen.id}>
                            <a
                              className="w-rail-item"
                              href={`#${id}`}
                              aria-current={current === id ? 'location' : undefined}
                            >
                              <span className="w-rail-number">{screen.number}</span>
                              <span className="w-rail-sentence">{screen.sentence.en}</span>
                              <Marks walk={walk} screen={screen} choices={choices} />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
