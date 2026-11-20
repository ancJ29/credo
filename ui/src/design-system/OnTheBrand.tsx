import { IconCheck } from '@tabler/icons-react';
import { shadesOf } from './appTheme';
import { onBrand, beforeOf, type Pick, type Surface } from './onBrand';
import { PALETTES } from './palettes';

const SIZES = { fontSize: 13, fontWeight: 600, borderRadius: 4, padding: '6px 12px' } as const;

/** One drawn surface: the pick's span as the ground, its ink on it. */
function Sample({
  surface,
  shades,
  pick,
}: {
  surface: Surface;
  shades: readonly string[];
  pick: Pick;
}) {
  const ground = pick.span.map((shade) => shades[shade]);
  const ink = { color: pick.colour, ...SIZES };
  if (surface === 'filled') {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ ...ink, background: ground[0] }}>Save</span>
        <span style={{ ...ink, background: ground[1] }}>Hover</span>
        <span style={{ ...ink, background: ground[0], padding: '2px 8px', fontSize: 11 }}>
          Badge
        </span>
        <span style={{ ...ink, background: ground[0], padding: 3, display: 'flex' }}>
          <IconCheck size={14} aria-hidden />
        </span>
      </div>
    );
  }
  const angle = surface === 'header' ? '135deg' : '180deg';
  return (
    <div
      style={{
        ...ink,
        width: surface === 'header' ? 260 : 150,
        height: surface === 'header' ? 40 : 56,
        display: 'flex',
        alignItems: 'center',
        background: `linear-gradient(${angle}, ${ground[0]} 0%, ${ground[ground.length - 1]} 100%)`,
      }}
    >
      {surface === 'header' ? 'Company name' : 'Staff'}
    </div>
  );
}

/** What the rule says of a pick, in words: the ink and the least ratio against the surface's shades. */
const said = (pick: Pick) => `${pick.ink} ${pick.least.toFixed(2)}:1`;

/** The colours drawn: the six stock ones, then two typed ones, as a company types its own. */
const ROWS = [
  ...PALETTES.map(({ name, shades }) => ({
    label: `${name[0].toUpperCase()}${name.slice(1)}`,
    shades,
  })),
  // The walks' company's colour, typed here (the data set stays out of the app's bundle): no stock shade 6 reads under either ink, so its buttons move a shade under white.
  {
    label: 'Typed #2f7d6d',
    shades: shadesOf('#2f7d6d') as readonly string[],
  },
  // A light colour of the kind the stock six no longer hold: it gets dark text.
  { label: 'Typed #d97757', shades: shadesOf('#d97757') as readonly string[] },
];

/** The six stock colours and two typed ones on one surface, the white before the rule beside the rule's pick, each with its least ratio. */
export function OnTheBrand({ surface }: { surface: Surface }) {
  return (
    <table style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th scope="col">Colour</th>
          <th scope="col">Before</th>
          <th scope="col">The rule</th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(({ label, shades }) => {
          const tuple = shades as unknown as Parameters<typeof onBrand>[0];
          const before = beforeOf(tuple, surface);
          const rule = onBrand(tuple, surface);
          return (
            <tr key={label}>
              <th scope="row" style={{ textAlign: 'left', paddingRight: 12 }}>
                {label}
              </th>
              {[before, rule].map((pick, at) => (
                <td key={at} style={{ padding: '4px 16px 4px 0' }}>
                  <Sample surface={surface} shades={shades} pick={pick} />
                  <div style={{ fontSize: 12 }}>{said(pick)}</div>
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
