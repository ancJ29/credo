import { Modal } from './modal';

/**
 * The guide: what the keys do, what the teal button is, the many-at-once actions, the paste, the
 * toggle, and where this page's answers go. It opens from the "?" and the ? key, and by itself on a
 * first visit.
 */
export function Guide({
  open,
  partner,
  onClose,
}: {
  open: boolean;
  partner: boolean;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="How this page works" onClose={onClose}>
      <div className="w-guide">
        <h3>Keys</h3>
        <dl>
          <dt>J · K</dt>
          <dd>next screen · previous screen</dd>
          <dt>Y · N</dt>
          <dd>Yes · No for the language shown (a No opens its reason box)</dd>
          <dt>L</dt>
          <dd>the other language</dd>
          <dt>U</dt>
          <dd>next unanswered</dd>
          <dt>?</dt>
          <dd>this guide</dd>
          <dt>Esc</dt>
          <dd>close it</dd>
        </dl>
        <h3>What to do next</h3>
        <p>The teal button is the next thing to do.</p>
        <h3>Many at once</h3>
        <p>
          “Yes for both languages”, “Yes to” and “Clear” on a walk or on the page answer, or take
          back, many screens at once. Each shows its count first; Undo, in the notice above the
          footer, puts them back until you change a choice. “Paste last answers” fills what is
          unchanged from an earlier block or message. “Only unanswered” leaves out every screen you
          have answered.
        </p>
        <h3>Where your answers go</h3>
        {partner ? (
          <p>
            This is a partner’s page. Type the label from your invite (a label, never a name), press
            “Share”, then post the message in Slack.
          </p>
        ) : (
          <p>
            This is your own page, opened from disk. Press “Copy my answers”, then paste the text
            into the chat.
          </p>
        )}
        <div className="w-moves">
          <button type="button" className="w-next" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
