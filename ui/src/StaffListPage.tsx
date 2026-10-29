import {
  can,
  type CustomField,
  type Employee,
  fieldValueShown,
  type Language,
  type StaffSetup,
  staffConfig,
} from '@credo/shared';
import {
  Anchor,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Group,
  NativeSelect,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Loaded } from './Loaded';
import { type PageProps, useLoad } from './page';
import { phoneOf, unitName } from './staffNames';
import { type Criteria, criteriaOf, matches, paramsOf } from './staffFilter';

/** What the table draws while nothing is read yet. */
const NOTHING_YET: { setup: StaffSetup; people: Employee[] } = {
  setup: { departments: [], positions: [], extra: {} },
  people: [],
};

/** The criteria less any the page cannot show. */
function known(criteria: Criteria, setup: StaffSetup, choices: readonly CustomField[]): Criteria {
  const has = (units: StaffSetup['departments'], id: string) =>
    units.some((unit) => unit.id === id);
  return {
    ...criteria,
    department: has(setup.departments, criteria.department) ? criteria.department : '',
    position: has(setup.positions, criteria.position) ? criteria.position : '',
    choices: Object.fromEntries(
      Object.entries(criteria.choices).filter(([key, value]) =>
        choices.some(
          (field) => field.key === key && field.options.some((option) => option.value === value),
        ),
      ),
    ),
  };
}

/** The staff, as the BFF lists them, in code order, narrowed by what the address holds: typed words,
 * a department, a position, whether people who left show, and the company's choice fields. Names
 * come from the staff setup as it stands, so a rename follows each person. */
export function StaffListPage(page: PageProps) {
  const { api, user } = page;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const loaded = useLoad(
    async () => ({ setup: (await api.getStaffSetup()).setup, people: await api.listEmployees() }),
    page,
    [api],
  );
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  const { setup, people: everyone } = loaded.data ?? NOTHING_YET;
  const { fields, customFields } = staffConfig(setup);
  const columns = customFields.filter((field) => field.inList);
  const choices = columns.filter((field) => field.kind === 'choice');
  // A criterion the page cannot show (a department or a field since removed, an option the field
  // lacks) narrows nothing and is dropped at the next write; before the setup is read, all stand.
  const criteria = loaded.data ? known(criteriaOf(params), setup, choices) : criteriaOf(params);
  // What is typed is kept here, and the address is written once a syllable is whole: a Vietnamese
  // letter is composed from several keystrokes, and rewriting the field mid-way would break it.
  const [typed, setTyped] = useState(criteria.q);
  const composing = useRef(false);
  // The addresses written and not yet seen back, the last of them the newest criteria: two
  // narrowings before the router commits each build on the one before, not on the address it shows.
  const written = useRef<{ address: string; criteria: Criteria }[]>([]);
  const address = params.toString();
  useEffect(() => {
    const mine = written.current.findLastIndex((entry) => entry.address === address);
    if (mine >= 0) written.current.splice(0, mine + 1);
    else {
      // Another page, the menu or the history set the address: the box follows it.
      written.current = [];
      setTyped(criteriaOf(new URLSearchParams(address)).q);
    }
  }, [address]);
  const narrow = (next: Partial<Criteria>) => {
    const base = written.current.at(-1)?.criteria ?? criteria;
    const made = { ...base, ...next };
    const address = paramsOf(made);
    written.current.push({ address: address.toString(), criteria: made });
    setParams(address, { replace: true });
  };
  // In the order the BFF answers, which is code order.
  const people = everyone.filter((person) =>
    matches(person, criteria, { setup, language, columns }),
  );

  const unitFilter = (
    label: string,
    key: 'department' | 'position',
    units: StaffSetup['departments'],
  ) => (
    <NativeSelect
      label={label}
      value={criteria[key]}
      onChange={(event) => narrow({ [key]: event.currentTarget.value })}
      data={[
        { value: '', label: t('staff.filterAll') },
        ...units.map((unit) => ({ value: unit.id, label: unit.name })),
      ]}
    />
  );

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
        <TextInput
          label={t('staff.search')}
          placeholder={t('staff.searchPlaceholder')}
          value={typed}
          onChange={(event) => {
            setTyped(event.currentTarget.value);
            if (!composing.current) narrow({ q: event.currentTarget.value });
          }}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            narrow({ q: event.currentTarget.value });
          }}
        />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {unitFilter(t('staff.filterDepartment'), 'department', setup.departments)}
          {unitFilter(t('staff.filterPosition'), 'position', setup.positions)}
          {choices.map((field) => (
            <NativeSelect
              key={field.key}
              label={field.label[language]}
              value={criteria.choices[field.key] ?? ''}
              onChange={(event) =>
                narrow({ choices: { ...criteria.choices, [field.key]: event.currentTarget.value } })
              }
              data={[
                { value: '', label: t('staff.filterAll') },
                ...field.options.map((option) => ({
                  value: option.value,
                  label: option.label[language],
                })),
              ]}
            />
          ))}
        </SimpleGrid>
        <Checkbox
          label={t('staff.showLeft')}
          checked={criteria.left}
          onChange={(event) => narrow({ left: event.currentTarget.checked })}
        />
        {people.length === 0 ? (
          <Text c="dimmed">{t(everyone.length === 0 ? 'staff.empty' : 'staff.noMatch')}</Text>
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
                  {columns.map((field) => (
                    <Table.Th key={field.key}>{field.label[language]}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {people.map((person) => (
                  <Table.Tr key={person.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        {fields.photo && (
                          <Avatar name={person.name} color="initials" size={28} aria-hidden />
                        )}
                        <Anchor
                          component={Link}
                          to={`/staff/${person.id}`}
                          state={{ list: search }}
                        >
                          {person.name}
                        </Anchor>
                        {person.archived && <Badge color="gray">{t('staff.left')}</Badge>}
                      </Group>
                    </Table.Td>
                    <Table.Td>{person.code}</Table.Td>
                    <Table.Td>{unitName(person.department, setup.departments)}</Table.Td>
                    <Table.Td>{unitName(person.position, setup.positions)}</Table.Td>
                    <Table.Td>{phoneOf(person)}</Table.Td>
                    {columns.map((field) => (
                      <Table.Td key={field.key}>
                        {fieldValueShown(field, person.extra[field.key], language)}
                      </Table.Td>
                    ))}
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
