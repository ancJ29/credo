import { StatusBadge } from 'credo-design-system';

const row = (items: string[]) => (
  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
    {items.map((s) => (
      <StatusBadge key={s} status={s as 'draft'} />
    ))}
  </div>
);

export const Orders = () => row(['draft', 'confirmed', 'fulfilled', 'cancelled']);
export const Requests = () => row(['waiting', 'delivered']);
export const Accounts = () => row(['active', 'inactive']);
