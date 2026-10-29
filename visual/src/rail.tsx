import { LANGUAGES } from '@credo/shared';
import { useEffect, useRef } from 'react';
import type { Choices } from './choices';
import { LANGUAGE_LABEL, type Whose } from './marks';
import { leftIn, type Place } from './nav';
import type { Report } from './report';
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
 * The list: the language and the widths, the toggle for the unanswered, then each walk with what is
 * left in it, the walk in view open and the others folded, and each of its screens on one line in
 * number order with its marks; the screen in view marked and kept in view. A side list on a PC; on
 * a phone it opens over the page from the line atop.
 */
export function Rail({
  report,
  places,
  view,
  onView,
  choices,
  whose,
  current,
  only,
  onOnly,
  shown,
  open,
  onGo,
  onClose,
}: {
  report: Report;
  places: readonly Place[];
  view: View;
  onView: (view: View) => void;
  choices: Choices;
  whose: Whose;
  current: string;
  only: boolean;
  onOnly: (only: boolean) => void;
  shown: readonly Place[];
  open: boolean;
  onGo: (id: string) => void;
  onClose: () => void;
}) {
  const list = useRef<HTMLElement>(null);
  useEffect(() => {
    list.current!.querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest' });
  }, [current]);
  const here = places.find(({ id }) => id === current)!.walk.id;
  return (
    <aside ref={list} className="w-rail" aria-label="The view and the screens" data-open={open}>
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
        <label className="w-only">
          <input
            type="checkbox"
            checked={only}
            onChange={(event) => onOnly(event.target.checked)}
          />
          Only unanswered
        </label>
        <button type="button" className="w-rail-close" onClick={onClose}>
          Close the list
        </button>
      </div>
      <nav className="w-rail-nav" aria-label="The walks’ screens">
        {report.walks.map((walk) => {
          const { id } = walk;
          const mine = places.filter((place) => place.walk.id === id);
          const left = mine.filter((place) => leftIn(place, choices, whose).length > 0).length;
          return (
            <details key={id} className="w-rail-walk" open={id === here}>
              <summary className="w-rail-title">
                <span>{walk.title.en}</span>
                <span className="w-rail-left">{left === 0 ? 'done' : `${left} left`}</span>
              </summary>
              <ul>
                {mine
                  .filter((place) => shown.includes(place))
                  .map((place) => (
                    <li key={place.id}>
                      <a
                        className="w-rail-item"
                        href={`#${place.id}`}
                        aria-current={current === place.id ? 'location' : undefined}
                        onClick={(event) => {
                          event.preventDefault();
                          onGo(place.id);
                        }}
                      >
                        <span className="w-rail-number">{place.screen.number}</span>
                        <span className="w-rail-sentence">
                          {place.screen.sentence.en}
                          {place.screen.path === 'wrong' && (
                            <span className="w-rail-wrong">goes wrong</span>
                          )}
                        </span>
                        <Marks
                          walk={place.walk}
                          screen={place.screen}
                          choices={choices}
                          whose={whose}
                        />
                      </a>
                    </li>
                  ))}
              </ul>
            </details>
          );
        })}
      </nav>
    </aside>
  );
}
