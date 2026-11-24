import { Button, PageHeader } from 'credo-design-system';

const box = (n: React.ReactNode) => <div style={{ width: 640, maxWidth: '100%' }}>{n}</div>;

export const TitleOnly = () => box(<PageHeader title="Staff" />);
export const WithActions = () => box(<PageHeader title="Staff" actions={<Button>Add staff member</Button>} />);
export const WithStatusAndSubtitle = () =>
  box(<PageHeader title="An Nguyen" status="inactive" subtitle="NV-001" />);
export const OrderConfirmed = () =>
  box(<PageHeader title="Order 1042" status="confirmed" subtitle="12 Le Loi" />);
