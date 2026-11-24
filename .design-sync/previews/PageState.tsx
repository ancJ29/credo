import { ActionButton, PageState } from 'credo-design-system';

const box = (n: React.ReactNode) => <div style={{ width: 394, maxWidth: '100%' }}>{n}</div>;

export const Loading = () => box(<PageState state="loading" title="Loading" />);
export const Failed = () =>
  box(
    <PageState state="failed" title="Could not load" onRetry={() => undefined}>
      The server did not answer.
    </PageState>,
  );
export const Forbidden = () =>
  box(
    <PageState state="forbidden" title="Not allowed">
      Your role cannot open this page.
    </PageState>,
  );
export const Empty = () =>
  box(
    <PageState state="empty" title="Staff" add={<ActionButton meaning="other">Add staff member</ActionButton>}>
      No staff yet.
    </PageState>,
  );
export const NotFound = () =>
  box(
    <PageState state="notFound" title="Not found">
      This page does not exist.
    </PageState>,
  );
