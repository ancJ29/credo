import { useState } from 'react';
import type { Choices } from './choices';
import { type Fill, fillFrom, fillSays } from './fill';
import type { Whose } from './marks';
import type { Report } from './report';

/**
 * The box for "Paste last answers": an earlier block or Share message goes in, the page says what
 * it will fill and what it leaves, and "Fill" does it.
 */
export function PasteBox({
  report,
  choices,
  whose,
  onFill,
  onClose,
}: {
  report: Report;
  choices: Choices;
  whose: Whose;
  onFill: (fill: Fill) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const fill = text.trim() === '' ? undefined : fillFrom(text, report, choices, whose);
  return (
    <div className="w-paste">
      <label>
        Paste an earlier block or Share message
        <textarea
          rows={5}
          spellCheck={false}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <p className="w-fill-says" aria-live="polite">
        {fill ? fillSays(fill) : ''}
      </p>
      <div className="w-moves">
        <button
          type="button"
          className="w-fill"
          disabled={!fill || fill.whole !== undefined || fill.filled === 0}
          onClick={() => onFill(fill!)}
        >
          Fill
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
