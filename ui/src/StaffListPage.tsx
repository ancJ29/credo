import { can, type Employee, type StaffSetup } from '@credo/shared';
import { Anchor, Badge, Button, Checkbox, Group, Stack, Table, Text, Title } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Loaded } from './Loaded';
import { type PageProps, useLoad } from './page';
import { phoneOf, unitName } from './staffNames';

/** What the table draws while nothing is read yet. */
const NOTHING_YET: { setup: StaffSetup; people: Employee[] } = {
  setup: { departments: [], positions: [], extra: {} },
  people: [],
};

/** The staff, in code order, with who left hidden until the filter shows them. Names come from the
 * staff setup as it stands, so a rename follows each person. */
export function StaffListPage(page: PageProps) {
  const { api, user } = page;
  const { t } = useTranslation();
  const loaded = useLoad(
    async () => ({ setup: (await api.getStaffSetup()).setup, people: await api.listEmployees() }),
    page,
    [api],
  );
  const [showLeft, setShowLeft] = useState(false);

  const { setup, people: everyone } = loaded.data ?? NOTHING_YET;
  const people = everyone
    .filter((person) => showLeft || !person.archived)
    .sort((a, b) => a.code.localeCompare(b.code));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('staff.title')}</Title>
        {can(user, 'staff.canCreate') && (
          <Button component={Link} to="/staff/new">
            {t('staff.add')}
          </Button>
        )}
      </Group>
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        <Checkbox
          label={t('staff.showLeft')}
          checked={showLeft}
          onChange={(event) => setShowLeft(event.currentTarget.checked)}
        />
        {people.length === 0 ? (
          <Text c="dimmed">{t('staff.empty')}</Text>
        ) : (
          <Table.ScrollContainer minWidth={640}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('staff.colName')}</Table.Th>
                  <Table.Th>{t('staff.colCode')}</Table.Th>
                  <Table.Th>{t('staff.colDepartment')}</Table.Th>
                  <Table.Th>{t('staff.colPosition')}</Table.Th>
                  <Table.Th>{t('staff.colPhone')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {people.map((person) => (
                  <Table.Tr key={person.id}>
                    <Table.Td>
                      <Group gap="xs">
                        <Anchor component={Link} to={`/staff/${person.id}`}>
                          {person.name}
                        </Anchor>
                        {person.archived && <Badge color="gray">{t('staff.left')}</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{person.code}</Table.Td>
                    <Table.Td>{unitName(person.department, setup.departments)}</Table.Td>
                    <Table.Td>{unitName(person.position, setup.positions)}</Table.Td>
                    <Table.Td>{phoneOf(person)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Loaded>
    </Stack>
  );
}
