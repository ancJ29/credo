import type { Language } from '@credo/shared';
import { useEffect, useRef, useState } from 'react';
import { LABEL } from './block';
import { blockOf, type Choices, saveLabel, shareOf } from './choices';
import { labelsOf, plural, progressOf, type Whose } from './marks';
import type { Report } from './report';
import { normalizeLabel } from './share';

/**
 * The bar at the foot, always in view: the note above, then one row: every screen in every
 * language as a ledger, how many are answered, and the two buttons that turn the choices into text: "Copy my answers", the human's
 * block for the chat, and Share, a Slack message under the partner's label, which is asked for
 * once and kept in the browser. Its height is kept on the page as `--bar`, so an answer docked at
 * the foot rests above it.
 */
export function Send({
  report,
  choices,
  whose,
  label,
  onLabel,
  only,
  onGo,
  note,
  onNote,
  onUndo,
  action,
}: {
  report: Report;
  choices: Choices;
  whose: Whose;
  label: string;
  onLabel: (label: string) => void;
  only: boolean;
  onGo: (id: string, language: Language) => void;
  note: string;
  onNote: (note: string) => void;
  /** Puts back the choices before the last bulk action or paste, while there is one to undo. */
  onUndo: (() => void) | undefined;
  /** The one action that stands out on the page now. */
  action: string;
}) {
  const bar = useRef<HTMLElement>(null);
  const [block, setBlock] = useState('');
  const { answered: chosen } = blockOf(report, choices);
  const progress = progressOf(report, choices, whose);

  useEffect(() => {
    const root = document.documentElement;
    const watcher = new ResizeObserver(() =>
      root.style.setProperty('--bar', `${bar.current!.offsetHeight}px`),
    );
    watcher.observe(bar.current!);
    return () => watcher.disconnect();
  }, []);

  const copy = async (share: boolean) => {
    setBlock('');
    if (share && !LABEL.test(normalizeLabel(label))) {
      onNote('Type your label first: 1 to 20 lowercase letters, digits or hyphens.');
      return;
    }
    const made = share ? shareOf(report, choices, normalizeLabel(label)) : blockOf(report, choices);
    if (made.answered === 0) {
      onNote('Nothing chosen yet: answer a screen first.');
    } else if (made.missing.length > 0) {
      const labels = labelsOf(report);
      onNote(`A No needs its reason: ${made.missing.map((key) => labels.get(key)).join(', ')}.`);
    } else {
      setBlock(made.text);
      try {
        await navigator.clipboard.writeText(made.text);
        onNote(share ? 'Copied. Paste it into Slack.' : 'Copied. Paste it into the chat.');
      } catch {
        onNote(`Select the text below, copy it and paste it into ${share ? 'Slack' : 'the chat'}.`);
      }
    }
  };

  return (
    <section
      ref={bar}
      className="w-send"
      aria-label="Your answers"
      data-action={action}
      data-partner={whose.partner}
    >
      <span role="status" className="w-note">
        {note}
        {onUndo && (
          <>
            {' · '}
            <button type="button" className="w-undo" onClick={onUndo}>
              Undo
            </button>
          </>
        )}
      </span>
      <div className="w-send-row">
        <span className="w-ledger" aria-hidden="true">
          {progress.marks.map(({ key, id, language, mark }) =>
            only && (mark === 'yes' || mark === 'no') ? (
              <span key={key} className="w-tick" data-mark={mark} />
            ) : (
              <a
                key={key}
                className="w-tick"
                data-mark={mark}
                href={`#${id}`}
                tabIndex={-1}
                onClick={(event) => {
                  event.preventDefault();
                  onGo(id, language);
                }}
              />
            ),
          )}
        </span>
        <span className="w-count">
          <span className="w-progress">{`${progress.answered} of ${progress.total} answered`}</span>
          <span className="w-tocopy">{plural(chosen, 'answer')} to copy</span>
        </span>
        <input
          className="w-label"
          aria-label="Your label"
          placeholder="Your label"
          maxLength={20}
          autoCapitalize="none"
          spellCheck={false}
          value={label}
          onChange={(event) => {
            const typed = event.target.value.toLowerCase();
            onLabel(typed);
            saveLabel(typed);
          }}
        />
        <button type="button" className="w-share" onClick={() => void copy(true)}>
          Share
        </button>
        <button type="button" className="w-copy" onClick={() => void copy(false)}>
          Copy my answers
        </button>
      </div>
      {block !== '' && (
        <div className="w-block-row">
          <textarea
            readOnly
            className="w-block"
            aria-label="The text to paste"
            rows={Math.min(8, block.split('\n').length)}
            value={block}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className="w-quiet" onClick={() => setBlock('')}>
            Hide the text
          </button>
        </div>
      )}
    </section>
  );
}
