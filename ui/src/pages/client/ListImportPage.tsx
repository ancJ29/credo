import { IMPORT_CALL_ROWS, IMPORT_MAX_BYTES, type Language } from '@credo/shared';
import { Button, Group, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { type TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { readFirstSheet, writeWorkbook } from '../../importFile';
import {
  headingOf,
  LISTS,
  type ListKind,
  type Problem,
  type ReadRow,
  readList,
  templateSheets,
} from '../../listSheet';
import { Loaded } from '../../frame/Loaded';
import { type PageProps, refusal, useLoad } from '../../page';
import { saveAs } from '../../saveAs';
import { TYPE } from '../../design-system/tokens';
import { ActionButton } from '../../components/atoms/ActionButton';
import { FormMessage } from '../../components/molecules/FormMessage';

/** Why a file was not read, or read to nothing. */
type FileProblem = 'too-big' | 'unreadable' | 'too-many' | 'no-code' | 'no-name' | 'no-rows';

const FILE_WORDS = {
  'too-big': 'import.tooBig',
  unreadable: 'import.unreadable',
  'too-many': 'import.tooMany',
  'no-code': 'lists.noColumn',
  'no-name': 'lists.noColumn',
  'no-rows': 'import.noRows',
} as const;

/** A row's reason, in words. */
function reasonOf(problem: Problem, t: TFunction) {
  switch (problem.kind) {
    case 'name':
      return t('lists.refusedName');
    case 'code-missing':
      return t('lists.refusedCodeMissing');
    case 'code-invalid':
      return t('lists.refusedCodeInvalid', { code: problem.code });
    case 'code-taken':
      return t('lists.refusedCodeTaken', { code: problem.code });
    case 'code-twice':
      return t('lists.refusedCodeTwice', { code: problem.code });
    case 'unit':
      return t('lists.refusedUnit');
    case 'price':
      return t('lists.refusedPrice', { typed: problem.typed });
    case 'stocked':
      return t('lists.refusedStocked', { typed: problem.typed });
    case 'row':
      return t('lists.refusedRow');
  }
}

/** What became of a row, as far as this page tells: the record added, or the reason it was not. */
type Outcome = { kind: 'added' } | { kind: 'refused'; reason: 'taken' | 'invalid' | 'busy' };

/**
 * Customers or products from an Excel file, the root's, as the staff import is. The template is
 * made here; the file is chosen, read in this browser alone, and every row is shown with the reason
 * for any that will not be added. Only then are the rows that hold sent, a call's worth at a time.
 * The codes taken are the list's, read once when the page opens.
 */
export function ListImportPage({ kind, ...page }: PageProps & { kind: ListKind }) {
  const { api } = page;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const loaded = useLoad(
    async () => new Set((await LISTS[kind].load(api, language)).map((row) => row.code)),
    page,
    [api, kind, language],
  );
  if (loaded.data) return <ImportForm page={page} kind={kind} taken={loaded.data} />;
  return (
    <Stack gap="lg">
      <Title {...TYPE.pageTitle}>{t(`lists.${kind}.importTitle`)}</Title>
      <Loaded status={loaded.status} onRetry={loaded.reload}>
        {null}
      </Loaded>
    </Stack>
  );
}

/** The page once the codes taken are read. */
function ImportForm({
  page,
  kind,
  taken,
}: {
  page: PageProps;
  kind: ListKind;
  taken: ReadonlySet<string>;
}) {
  const { api } = page;
  const { t, i18n } = useTranslation();
  const language = i18n.language as Language;
  const list = LISTS[kind];
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<FileProblem | null>(null);
  const [rows, setRows] = useState<ReadRow[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'busy' | 'failed'>('idle');
  // The rows answered so far, each with its result: a call that fails does not take back the calls
  // answered before it, and a result is read against its own row, never against the file held now.
  const [answered, setAnswered] = useState<{ row: ReadRow; result: Outcome }[]>([]);
  // Whether a send has ended: the results are shown once it has, not call by call as it runs.
  const [ended, setEnded] = useState(false);

  const held = rows?.filter((row) => row.request !== null) ?? [];

  async function template() {
    saveAs(await writeWorkbook(templateSheets(kind, language)), `${kind}-${language}.xlsx`);
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
    const found = readList(kind, table, taken);
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
        const reply = await list.send(
          api,
          part.map((row) => row.request!),
        );
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
    const refusedTaken = answered.length - added - invalid - busy.length;
    const rest = held.filter((row) => !answered.some((one) => one.row === row)).length;
    return (
      <Stack gap="lg">
        <Title {...TYPE.pageTitle}>{t(`lists.${kind}.doneTitle`)}</Title>
        <FormMessage kind="success">{t(`lists.${kind}.doneAdded`, { count: added })}</FormMessage>
        {refusedTaken > 0 && (
          <FormMessage kind="warning">{t('lists.doneTaken', { count: refusedTaken })}</FormMessage>
        )}
        {invalid > 0 && (
          <FormMessage kind="warning">{t('lists.doneInvalid', { count: invalid })}</FormMessage>
        )}
        {busy.length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('import.colRow')}</Table.Th>
                <Table.Th>{headingOf('name', language)}</Table.Th>
                <Table.Th>{t('import.colResult')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {busy.map((row) => (
                <Table.Tr key={row.line}>
                  <Table.Td>{row.line}</Table.Td>
                  <Table.Td>{row.cells.name}</Table.Td>
                  <Table.Td>
                    <Text c="red">{t('import.busy')}</Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        {rest > 0 && status === 'failed' && (
          <FormMessage kind="error">{t('lists.failedPart')}</FormMessage>
        )}
        <Group>
          {rest > 0 && (
            <ActionButton meaning="main" busy={status === 'busy'} onClick={() => void send()}>
              {t('import.addRest', { count: rest })}
            </ActionButton>
          )}
          <Button component={Link} to={`/${kind}`} variant={rest > 0 ? 'default' : 'filled'}>
            {t(`lists.${kind}.back`)}
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title {...TYPE.pageTitle}>
          {t(rows ? 'import.previewTitle' : `lists.${kind}.importTitle`)}
        </Title>
        {!rows && <Text c="dimmed">{t('lists.intro')}</Text>}
      </div>
      {status === 'failed' && <FormMessage kind="error">{t('lists.failed')}</FormMessage>}
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
                  <Table.Th>{headingOf('code', language)}</Table.Th>
                  <Table.Th>{headingOf('name', language)}</Table.Th>
                  {list.preview.map((key) => (
                    <Table.Th key={key}>{headingOf(key, language)}</Table.Th>
                  ))}
                  <Table.Th>{t('import.colResult')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {rows.map((row) => (
                  <Table.Tr key={row.line}>
                    <Table.Td>{row.line}</Table.Td>
                    <Table.Td>{row.cells.code}</Table.Td>
                    <Table.Td>{row.cells.name}</Table.Td>
                    {list.preview.map((key) => (
                      <Table.Td key={key}>
                        {key === 'stocked' && row.stocked !== null
                          ? t(row.stocked ? 'lists.yes' : 'lists.no')
                          : row.cells[key]}
                      </Table.Td>
                    ))}
                    <Table.Td>
                      {row.request ? (
                        <Text c="green">{t('import.willAdd')}</Text>
                      ) : (
                        row.problems.map((found) => (
                          <Text key={reasonOf(found, t)} c="red">
                            {reasonOf(found, t)}
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
              {t(`lists.${kind}.add`, { count: held.length })}
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
              <Text {...TYPE.caption}>{t('lists.templateHint')}</Text>
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
                  name: headingOf(problem === 'no-code' ? 'code' : 'name', language),
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
