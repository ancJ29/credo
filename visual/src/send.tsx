import { useEffect, useRef, useState } from 'react';
import { blockOf, type Choices } from './choices';
import { labelsOf, plural, progressOf } from './marks';
import type { Report } from './report';

/**
 * The bar at the foot, always in view: every screen in every language as a ledger, how many are
 * answered, and the button that turns the choices into the block for the chat. Its height is
 * kept on the page as `--bar`, so an answer docked at the foot rests above it.
 */
export function Send({ report, choices }: { report: Report; choices: Choices }) {
  const bar = useRef<HTMLElement>(null);
  const [block, setBlock] = useState('');
  const [note, setNote] = useState('');
  const { answered: chosen } = blockOf(report, choices);
  const progress = progressOf(report, choices);

  useEffect(() => {
    const root = document.documentElement;
    const watcher = new ResizeObserver(() =>
      root.style.setProperty('--bar', `${bar.current!.offsetHeight}px`),
    );
    watcher.observe(bar.current!);
    return () => watcher.disconnect();
  }, []);

  const copy = async () => {
    const made = blockOf(report, choices);
    setBlock('');
    if (made.answered === 0) {
      setNote('Nothing chosen yet: answer a screen first.');
    } else if (made.missing.length > 0) {
      const labels = labelsOf(report);
      setNote(`A No needs its reason: ${made.missing.map((key) => labels.get(key)).join(', ')}.`);
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
    <section ref={bar} className="w-send" aria-label="Your answers">
      <div className="w-send-row">
        <span className="w-ledger" aria-hidden="true">
          {progress.marks.map(({ key, mark }) => (
            <span key={key} className="w-tick" data-mark={mark} />
          ))}
        </span>
        <span className="w-count">
          <span className="w-progress">{`${progress.answered} of ${progress.total} answered`}</span>
          <span className="w-tocopy">{plural(chosen, 'answer')} to copy</span>
        </span>
        <span role="status" className="w-note">
          {note}
        </span>
        <button type="button" className="w-copy" onClick={() => void copy()}>
          Copy my answers
        </button>
      </div>
      {block !== '' && (
        <div className="w-block-row">
          <textarea
            readOnly
            className="w-block"
            aria-label="The block to paste into the chat"
            rows={Math.min(8, block.split('\n').length)}
            value={block}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button type="button" className="w-quiet" onClick={() => setBlock('')}>
            Hide the block
          </button>
        </div>
      )}
    </section>
  );
}
