import { FormMessage } from 'credo-design-system';

const box = (n: React.ReactNode) => <div style={{ width: 394 }}>{n}</div>;

export const Error = () => box(<FormMessage kind="error">Could not save. Try again.</FormMessage>);
export const Warning = () => box(<FormMessage kind="warning">This record changed since you opened it.</FormMessage>);
export const Success = () => box(<FormMessage kind="success">The staff member was added.</FormMessage>);
export const Info = () => box(<FormMessage kind="info">Changes are kept when you save.</FormMessage>);
export const Saved = () => box(<FormMessage kind="saved">Saved.</FormMessage>);
export const Standing = () =>
  box(
    <FormMessage kind="warning" standing title="ACME-01">
      The sign-in link has expired. Ask your manager for a new one.
    </FormMessage>,
  );
