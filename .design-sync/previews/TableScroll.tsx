import { Table, TableScroll } from 'credo-design-system';

export const NarrowTable = () => (
  <div style={{ width: 394, maxWidth: '100%' }}>
    <TableScroll>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Phone</Table.Th>
            <Table.Th>Address</Table.Th>
            <Table.Th>Staff</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>An Phat</Table.Td>
            <Table.Td>0901 000 000</Table.Td>
            <Table.Td>12 Le Loi</Table.Td>
            <Table.Td>3</Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </TableScroll>
  </div>
);
