import {
  IMPORT_CALL_ROWS,
  IMPORT_MAX_BYTES,
  type ImportResult,
  type Language,
  normaliseEmployeeCode,
  type StaffSetup,
} from '@credo/shared';
import { Group, Paper, Stack, Table, Text, TextInput } from '@mantine/core';
import { type TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readFirstSheet, writeWorkbook } from '../../importFile';
import {
  columnsOf,
  headingOf,
  type Problem,
  type ReadRow,
  readStaff,
  templateSheets,
} from '../../importSheet';
import { INVALID } from '../../parts/ownFields';
import { type PageProps, refusal, useLoad } from '../../page';
import { saveAs } from '../../saveAs';
import { TYPE } from '../../design-system/tokens';
import { ActionButton } from '../../components/atoms/ActionButton';
import { PageShell } from '../../parts/PageShell';
import { FormMessage } from '../../components/molecules/FormMessage';
import { PageHeader } from '../../components/organisms/PageHeader';

/** Why a file was not read, or read to nothing. */
type FileProblem = 'too-big' | 'unreadable' | 'too-many' | 'no-name' | 'no-rows';

const FILE_WORDS = {
  'too-big': 'import.tooBig',
  unreadable: 'import.unreadable',
  'too-many': 'import.tooMany',
  'no-name': 'import.noName',
  'no-rows': 'import.noRows',
} as const;

/** A row's reason, in words. */
function reasonOf(problem: Problem, t: TFunction, language: Language) {
  switch (problem.kind) {
    case 'name':
      return t('import.refusedName');
    case 'code-invalid':
      return t('import.refusedCodeInvalid', { code: problem.code });
    case 'code-taken':
      return t('import.refusedCodeTaken', { code: problem.code });
    case 'code-twice':
      return t('import.refusedCodeTwice', { code: problem.code });
    case 'department':
      return t('import.refusedDepartment', { name: problem.name });
    case 'position':
      return t('import.refusedPosition', { name: problem.name });
    case 'row':
      return t('import.refusedRow');
    case 'field':
      return t('import.refusedField', {
        field: problem.field.label[language],
        why: t(INVALID[problem.field.kind]),
      });
  }
}

/**
 * Staff from an Excel file, the root's. The template is made here from what the company keeps; the
 * file is chosen, read in this browser alone, and every row is shown with the reason for any that
 * will not be added. Only then are the rows that hold sent, a call's worth at a time, each added
 * without a sign-in. The two libraries load here and nowhere else.
 */
export function ImportPage(page: PageProps) {
  const { api } = page;
  const { t } = useTranslation();
  const loaded = useLoad(
    async () => {
      const [setup, people] = await Promise.all([api.getStaffSetup(), api.listEmployees()]);
      // The root's own sign-in name is a code no one may be given, though no person holds it.
      const codes = [...people.map((person) => person.code), normaliseEmployeeCode(page.user.name)];
      return { setup: setup.setup, taken: new Set(codes) };
    },
    page,
    [api],
  );
  if (loaded.data) return <ImportForm page={page} {...loaded.data} />;
  return (
    <PageShell title={t('import.title')} status={loaded.status} onRetry={loaded.reload}>
      {null}
    </PageShell>
  );
}

/** The page once the staff setup and the codes taken are read. */
function ImportForm({
  page,
  setup,
  taken,
}: {
  page: PageProps;
  setup: StaffSetup;
  taken: ReadonlySet<string>;
}) {
  const { api } = page;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const [rows, setRows] = useState<ReadRow[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle');
  // The rows answered so far, each with its result: a call that fails does not take back the calls
  // answered before it, and a result is read against its own row, never against the file held now.
  const [answered, setAnswered] = useState<{ row: ReadRow; result: ImportResult }[]>([]);
  // Whether a send has ended: the results are shown once it has, not call by call as it runs.
  const [ended, setEnded] = useState(false);

  const held = rows?.filter((row) => row.request !== null) ?? [];

  async function template() {
    saveAs(await writeWorkbook(templateSheets(setup, language)), `staff-${language}.xlsx`);
  }

  async function read(chosen: File) {
    setProblem(null);
    if (chosen.size > IMPORT_MAX_BYTES) return setProblem('too-big');
    setStatus('busy');
    let table;
    try {
      table = await readFirstSheet(chosen);
    } catch {
      setStatus('idle');
      return setProblem('unreadable');
    }
    setStatus('idle');
    const found = readStaff(table, setup, taken);
    if (found.kind === 'failed') return setProblem(found.reason);
    setRows(found.rows);
  }

  /** Sends the rows not answered yet, a call's worth at a time, keeping each call's results. */
  async function send() {
    if (answered.length === 0) setEnded(false);
    setStatus('busy');
    const done = new Set(answered.map((one) => one.row));
    const todo = held.filter((row) => !done.has(row));
    let results = answered;
    try {
      for (let at = 0; at < todo.length; at += IMPORT_CALL_ROWS) {
        const part = todo.slice(at, at + IMPORT_CALL_ROWS);
        const reply = await api.importEmployees(part.map((row) => row.request!));
        // One result for each row sent, in the order sent.
        results = [...results, ...reply.results.map((result, i) => ({ row: part[i], result }))];
        setAnswered(results);
      }
    } catch (error) {
      refusal(error, page);
      setEnded(true);
      return setStatus('failed');
    }
    setEnded(true);
    setStatus('idle');
  }

  const chooseAgain = () => {
    setRows(null);
    setFile(null);
    setProblem(null);
    setAnswered([]);
    setEnded(false);
    setStatus('idle');
  };

  if (answered.length > 0 && ended) {
    const busy = answered.flatMap(({ row, result }) =>
      result.kind === 'refused' && result.reason === 'busy' ? [row] : [],
    );
    const added = answered.filter(({ result }) => result.kind === 'added').length;
    const invalid = answered.filter(
      ({ result }) => result.kind === 'refused' && result.reason === 'invalid',
    ).length;
    const taken = answered.length - added - invalid - busy.length;
    const rest = held.filter((row) => !answered.some((one) => one.row === row)).length;
    return (
      <Stack gap="lg">
        <PageHeader title={t('import.doneTitle')} />
        <FormMessage kind="success">{t('import.doneAdded', { count: added })}</FormMessage>
        {taken > 0 && (
          <FormMessage kind="warning">{t('import.doneRefused', { count: taken })}</FormMessage>
        )}
        {invalid > 0 && (
          <FormMessage kind="warning">{t('import.doneInvalid', { count: invalid })}</FormMessage>
        )}
        {busy.length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('import.colRow')}</Table.Th>
                <Table.Th>{t('staff.colName')}</Table.Th>
                <Table.Th>{t('import.colResult')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {busy.map((row) => (
                <Table.Tr key={row.line}>
                  <Table.Td>{row.line}</Table.Td>
                  <Table.Td>{row.name}</Table.Td>
                  <Table.Td>
                    <Text c="red">{t('import.busy')}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {rest > 0 && status === 'failed' && (
          <FormMessage kind="error">{t('import.failedPart')}</FormMessage>
        )}
        <Text>{t('import.doneSignIn')}</Text>
        <Group>
          {rest > 0 && (
            <ActionButton meaning="main" busy={status === 'busy'} onClick={() => void send()}>
              {t('import.addRest', { count: rest })}
            </ActionButton>
          )}
          <ActionButton meaning={rest > 0 ? 'other' : 'main'} to="/staff">
            {t('staff.back')}
          </ActionButton>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <PageHeader title={t(rows ? 'import.previewTitle' : 'import.title')} />
        {!rows && <Text c="dimmed">{t('import.intro')}</Text>}
      </div>
      {status === 'failed' && <FormMessage kind="error">{t('import.failed')}</FormMessage>}
      {rows ? (
        <Stack gap="md">
          <Text>
            {t('import.summary', {
              held: held.length,
              total: rows.length,
              refused: rows.length - held.length,
            })}
          </Text>
          <Table.ScrollContainer minWidth={720}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('import.colRow')}</Table.Th>
                  <Table.Th>{t('staff.colName')}</Table.Th>
                  <Table.Th>{t('staff.colCode')}</Table.Th>
                  <Table.Th>{t('staff.colDepartment')}</Table.Th>
                  <Table.Th>{t('staff.colPosition')}</Table.Th>
                  <Table.Th>{t('import.colResult')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.line}>
                    <Table.Td>{row.line}</Table.Td>
                    <Table.Td>{row.name}</Table.Td>
                    <Table.Td>{row.code || (row.request ? t('import.numbered') : '')}</Table.Td>
                    <Table.Td>{row.department}</Table.Td>
                    <Table.Td>{row.position}</Table.Td>
                    <Table.Td>
                      {row.request ? (
                        <Text c="green">{t('import.willAdd')}</Text>
                      ) : (
                        row.problems.map((found) => (
                          <Text key={reasonOf(found, t, language)} c="red">
                            {reasonOf(found, t, language)}
                          </Text>
                        ))
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Group>
            <ActionButton
              meaning="main"
              disabled={held.length === 0}
              busy={status === 'busy'}
              onClick={() => void send()}
            >
              {t('import.add', { count: held.length })}
            </ActionButton>
            <ActionButton meaning="other" disabled={status === 'busy'} onClick={chooseAgain}>
              {t('import.another')}
            </ActionButton>
          </Group>
        </Stack>
      ) : (
        <Paper withBorder p="md">
          <Stack gap="lg">
            <Stack gap="xs" align="flex-start">
              <ActionButton meaning="other" onClick={() => void template()}>
                {t('import.template')}
              </ActionButton>
              <Text {...TYPE.caption}>{t('import.templateHint')}</Text>
            </Stack>
            <TextInput
              type="file"
              accept=".xlsx"
              label={t('import.file')}
              description={t('import.fileHint')}
              onChange={(event) => {
                setFile(event.currentTarget.files?.[0] ?? null);
                setProblem(null);
              }}
            />
            {file && <Text>{t('import.chosen', { name: file.name })}</Text>}
            {problem && (
              <FormMessage kind="error">
                {t(FILE_WORDS[problem], {
                  name: headingOf(columnsOf(setup)[0], language),
                })}
              </FormMessage>
            )}
            <ActionButton
              meaning="main"
              disabled={!file}
              busy={status === 'busy'}
              onClick={() => void read(file!)}
            >
              {t('import.read')}
            </ActionButton>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
