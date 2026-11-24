import { Anchor, DataTable } from 'credo-design-system';

export const OrderLines = () => (
  <div style={{ width: 640 }}>
    <DataTable
      columns={[
        { heading: 'Product' },
        { heading: 'Quantity', number: true },
        { heading: 'Amount', number: true },
      ]}
      rows={[
        { key: 'rice', cells: ['Sticky rice', 12, '480,000 ₫'] },
        { key: 'sauce', cells: ['Fish sauce', 6, '270,000 ₫'] },
        { key: 'tea', cells: ['Jasmine tea', 3, '195,000 ₫'] },
      ]}
      total={['Total', 21, '945,000 ₫']}
    />
  </div>
);
export const NamesThatOpenAPage = () => (
  <div style={{ width: 640 }}>
    <DataTable
      columns={[{ heading: 'Name' }, { heading: 'Phone' }]}
      rows={[
        { key: 'an', cells: [<Anchor key="a">An Nguyen</Anchor>, '0901 234 567'] },
        { key: 'binh', cells: [<Anchor key="b">Binh Tran</Anchor>, '0902 345 678'] },
        { key: 'chi', cells: [<Anchor key="c">Chi Le</Anchor>, '0903 456 789'] },
      ]}
    />
  </div>
);
