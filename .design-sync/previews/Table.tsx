import { Table } from 'credo-design-system';

export const Basic = () => (
  <Table>
    <Table.Thead>
      <Table.Tr>
        <Table.Th>Name</Table.Th>
        <Table.Th>Phone</Table.Th>
      </Table.Tr>
    </Table.Thead>
    <Table.Tbody>
      <Table.Tr>
        <Table.Td>An Nguyen</Table.Td>
        <Table.Td>0901 234 567</Table.Td>
      </Table.Tr>
      <Table.Tr>
        <Table.Td>Binh Tran</Table.Td>
        <Table.Td>0902 345 678</Table.Td>
      </Table.Tr>
    </Table.Tbody>
  </Table>
);
