import { type ReactNode, useEffect, useId, useRef } from 'react';

/**
 * A modal `<dialog>`: Escape, the focus kept inside and the page behind made inert are the
 * browser's. The focus goes in when it opens and comes back to where it was when it closes. Its
 * content is drawn only while it is open.
 */
export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const before = useRef<HTMLElement>(null);
  const id = useId();

  useEffect(() => {
    const node = dialog.current!;
    if (open) {
      before.current = document.activeElement as HTMLElement;
      node.showModal();
      // A dialog that asks for text takes the focus into its field; one that asks for none opens
      // at its title, so a tall one shows its top, not its foot.
      (node.querySelector<HTMLElement>('textarea, input') ??
        node.querySelector<HTMLElement>('h2'))!.focus();
    } else if (node.open) {
      node.close();
      before.current!.focus();
    }
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="w-dialog"
      aria-labelledby={id}
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      {open && (
        <>
          <h2 id={id} tabIndex={-1}>
            {title}
          </h2>
          {children}
        </>
      )}
    </dialog>
  );
}
