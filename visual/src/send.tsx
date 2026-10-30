import type { Language } from '@credo/shared';
import { useEffect, useRef, useState } from 'react';
import { LABEL } from './block';
import { blockOf, type Choices, shareOf } from './choices';
import { labelsOf, plural, progressOf, type Whose } from './marks';
import { Modal } from './modal';
import type { Report } from './report';
import { normalizeLabel } from './share';

/** What the notice above the footer says, and the screen it opens when it names one. */
export type Notice = { text: string; go?: { id: string; language: Language } };

/**
 * The footer, always in view and always one row: a bar a walk (as wide as its share of the
 * answers, filled to what is answered in it, opening its first screen waiting), the count in plain
 * words, and one button: "Copy my answers" on the human's page, Share on a partner's, whose label
 * from the invite is asked for once. The text it makes opens in a dialog. Notices, and Undo, ride
 * above the footer, never in it. Its height is kept on the page as `--bar`, so an answer docked at
 * the foot rests above it.
 */
export function Send({
  report,
  choices,
  whose,
  label,
  onLabel,
  onLabelDone,
  onOpenWalk,
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
  /** The label is left or sent: judge it, and give the choices as they stand after. */
  onLabelDone: () => Choices;
  onOpenWalk: (walkId: string) => void;
  onGo: (id: string, language: Language) => void;
  note: Notice;
  onNote: (note: Notice) => void;
  /** Puts back the choices before the last bulk action or paste, while there is one to undo. */
  onUndo: (() => void) | undefined;
  /** The one action that stands out on the page now. */
  action: string;
}) {
  const bar = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState(false);
  const [copied, setCopied] = useState<{ choices: Choices; count: number; text: string }>();
  const [editing, setEditing] = useState(() => !LABEL.test(normalizeLabel(label)));
  const { answered: chosen } = blockOf(report, choices);
  const progress = progressOf(report, choices, whose);
  const everything = progress.answered === progress.total;
  const share = whose.partner;

  useEffect(() => {
    const root = document.documentElement;
    const watcher = new ResizeObserver(() =>
      root.style.setProperty('--bar', `${bar.current!.offsetHeight}px`),
    );
    watcher.observe(bar.current!);
    return () => watcher.disconnect();
  }, []);

  const copy = async () => {
    if (share && !LABEL.test(normalizeLabel(label))) {
      onNote({
        text: 'Type the label from your invite first: 1 to 20 lowercase letters, digits or hyphens.',
      });
      setEditing(true);
      return;
    }
    const now = share ? onLabelDone() : choices;
    const made = share ? shareOf(report, now, normalizeLabel(label)) : blockOf(report, now);
    if (made.missing.length > 0) {
      const labels = labelsOf(report);
      const [first] = made.missing;
      const [walk, screen, language] = first.split(':');
      onNote({
        text: `A No needs its reason: ${made.missing.map((key) => labels.get(key)).join(', ')}.`,
        go: { id: `${walk}-${screen}`, language: language as Language },
      });
      return;
    }
    setCopied({ choices: now, count: made.answered, text: made.text });
    setOpen(true);
    await write(made.text);
  };
  const write = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setRefused(false);
    } catch {
      setRefused(true);
    }
  };

  const text = copied?.text ?? '';
  const shown = copied && copied.choices === choices ? copied.count : undefined;
  const walks = report.walks.map((walk) => {
    const mine = progress.marks.filter(({ key }) => key.startsWith(`${walk.id}:`));
    const done = mine.filter(({ mark }) => mark === 'yes' || mark === 'no').length;
    const left = new Set(
      mine.filter(({ mark }) => mark === 'open' || mark === 'again').map(({ id }) => id),
    ).size;
    return { walk, total: mine.length, done, left };
  });
  const { go } = note;

  return (
    <section
      ref={bar}
      className="w-send"
      aria-label="Your answers"
      data-action={action}
      data-partner={whose.partner}
    >
      <span role="status" className="w-note">
        {note.text !== '' && (
          <>
            {go ? (
              <button type="button" className="w-note-go" onClick={() => onGo(go.id, go.language)}>
                {note.text}
              </button>
            ) : (
              note.text
            )}
            {onUndo && (
              <>
                {' · '}
                <button type="button" className="w-undo" onClick={onUndo}>
                  Undo
                </button>
              </>
            )}
            <button
              type="button"
              className="w-dismiss"
              aria-label="Dismiss"
              onClick={() => onNote({ text: '' })}
            />
          </>
        )}
      </span>
      <div className="w-send-row">
        <span className="w-ledger">
          {walks.map(({ walk, total, done, left }) => {
            const says = `${walk.title.en}: ${left === 0 ? 'done' : `${left} left`}`;
            return (
              <a
                key={walk.id}
                className="w-walkbar"
                href={`#${walk.id}`}
                tabIndex={-1}
                title={says}
                aria-label={says}
                style={{ flex: `${total} 1 0` }}
                onClick={(event) => {
                  event.preventDefault();
                  onOpenWalk(walk.id);
                }}
              >
                <span className="w-walkfill" style={{ width: `${(done / total) * 100}%` }} />
              </a>
            );
          })}
        </span>
        <span className="w-count">
          <span className="w-progress">
            {everything
              ? `All ${progress.total} answered${share ? ' by you' : ''}`
              : `${progress.answered} of ${progress.total} answered`}
          </span>
          {' · '}
          <span className="w-tocopy">
            {shown !== undefined
              ? `${shown} copied`
              : chosen === 0
                ? 'none chosen yet'
                : `${chosen} ready to copy`}
          </span>
        </span>
        {share &&
          (editing ? (
            <input
              className="w-label"
              aria-label="Label from the invite"
              placeholder="Label from the invite"
              maxLength={20}
              autoCapitalize="none"
              spellCheck={false}
              value={label}
              onChange={(event) => onLabel(event.target.value.toLowerCase())}
              onBlur={() => {
                setEditing(!LABEL.test(normalizeLabel(label)));
                onLabelDone();
              }}
            />
          ) : (
            <span className="w-label-kept">
              as {normalizeLabel(label)},{' '}
              <button type="button" className="w-quiet" onClick={() => setEditing(true)}>
                change
              </button>
            </span>
          ))}
        <button
          type="button"
          className={share ? 'w-share' : 'w-copy'}
          disabled={chosen === 0}
          onClick={() => void copy()}
        >
          {share ? 'Share' : 'Copy my answers'}
        </button>
      </div>
      <Modal
        open={open}
        title={refused ? 'Copy this text' : `Copied: ${plural(copied?.count ?? 0, 'answer')}`}
        onClose={() => setOpen(false)}
      >
        <p>
          {refused && 'Select the text and copy it. '}
          {share ? 'Post it in Slack.' : 'Paste it into the chat.'}
        </p>
        <textarea
          readOnly
          className="w-block"
          aria-label="The text to paste"
          rows={Math.min(10, text.split('\n').length)}
          value={text}
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className="w-moves">
          <button type="button" onClick={() => void write(text)}>
            Copy again
          </button>
          <button type="button" className="w-next" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </Modal>
    </section>
  );
}
