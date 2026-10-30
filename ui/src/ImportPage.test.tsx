import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '@credo/shared';
import { DEMO_STAFF_SETUP } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { DICTIONARIES } from './i18n';
import { demoImportFile } from './importDemo';
import { readFirstSheet, writeWorkbook } from './importFile';
import { columnsOf, headingOf } from './importSheet';

/** The file field's input. */
const field = () => screen.getByLabelText<HTMLInputElement>(/^Excel file/);

/** A file of staff in English: the company's headings, then these rows by column key. */
async function staffFile(rows: Record<string, string>[], name = 'staff.xlsx') {
  const columns = columnsOf(DEMO_STAFF_SETUP);
  const blob = await writeWorkbook([
    {
      name: 'Staff',
      rows: [
        columns.map((column) => headingOf(column, 'en')),
        ...rows.map((row) => columns.map((column) => row[column.key] ?? '')),
      ],
    },
  ]);
  return new File([blob], name);
}

/** Chooses the file and presses “Read the file”. */
async function chooseAndRead(file: File) {
  await userEvent.upload(await waitFor(field), file);
  await userEvent.click(screen.getByRole('button', { name: 'Read the file' }));
}

const saved: { blob: Blob; name: string }[] = [];

beforeEach(() => {
  saved.length = 0;
  // jsdom has no object URLs and does not follow a link: the template is caught as it is handed over
  URL.createObjectURL = vi.fn((blob: Blob) => {
    saved.push({ blob, name: '' });
    return 'blob:template';
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const last = saved.at(-1);
    if (last) last.name = this.download;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the import page', () => {
  it('The app gives a template in Vietnamese or English with the columns the form shows, the company’s own fields included, and sample rows with its real departments and positions', async () => {
    for (const language of ['en', 'vi'] as const) {
      saved.length = 0;
      const drawn = openApp('/staff/import', { language });
      const button = await screen.findByRole('button', {
        name: language === 'en' ? 'Download the template' : 'Tải tệp mẫu',
      });
      await userEvent.click(button);

      expect(saved).toHaveLength(1);
      expect(saved[0]?.name).toBe(`staff-${language}.xlsx`);
      const table = await readFirstSheet(saved[0].blob);
      expect(table[0]).toEqual(columnsOf(DEMO_STAFF_SETUP).map((c) => headingOf(c, language)));
      expect(table).toHaveLength(3);
      expect(table[1]).toContain('Kho');
      drawn.unmount();
    }
  });

  it('Before anything is saved, the root sees each row read and the reason for any refused, and only then sends the rows that hold, each added without a sign-in', async () => {
    const { api } = openApp('/staff/import');
    await chooseAndRead(await demoImportFile('en', 'import'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Check the rows' })).toBeTruthy();
    expect(screen.getByText(/3 of 8 rows will be added\. 5 will not/)).toBeTruthy();
    expect(api.importEmployees).not.toHaveBeenCalled();
    const text = screen.getByRole('table').textContent ?? '';
    for (const reason of [
      'The code “EMP-0002” already belongs to someone in the company.',
      'The name is empty or longer than 200 characters.',
      'The company has no department “Kế toán”.',
      'The code “EMP-0100” is given by an earlier row of this file.',
      '“Dependants” does not fit',
    ]) {
      expect(text).toContain(reason);
    }
    expect(text).toContain('Numbered when added');

    await userEvent.click(screen.getByRole('button', { name: 'Add the people (3)' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'People added' })).toBeTruthy();
    expect(screen.getByText('3 people were added.')).toBeTruthy();
    expect(screen.queryByText(/rows were not added/)).toBeNull();
    expect(api.importEmployees).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.importEmployees).mock.calls[0]?.[0].map((row) => row.name)).toEqual([
      'Mai Linh',
      'Ngô Thu Hà',
      'Lý Quang Minh',
    ]);
    expect((await api.listEmployees()).map((person) => person.name)).toContain('Mai Linh');
  });

  it('says why a code that is no code, or a position the company lacks, will not be added', async () => {
    openApp('/staff/import');
    await chooseAndRead(
      await staffFile([
        { name: 'Một', code: 'a b' },
        { name: 'Hai', position: 'Sếp' },
      ]),
    );

    const text = (await screen.findByRole('table')).textContent ?? '';
    expect(text).toContain('The code “a b” is not 2 to 20 letters A to Z, digits or hyphens.');
    expect(text).toContain('The company has no position “Sếp”.');
    expect(
      screen.getByRole('button', { name: 'Add the people (0)' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('A file taken back out of the field leaves nothing chosen', async () => {
    openApp('/staff/import');
    await userEvent.upload(await waitFor(field), await demoImportFile('en', 'import'));
    expect(screen.getByText('Chosen: import.xlsx')).toBeTruthy();

    await userEvent.upload(field(), []);

    expect(screen.queryByText(/^Chosen:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Read the file' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('sends a file’s rows a call’s worth at a time, and says how many were added and how many were refused meanwhile', async () => {
    const { api } = openApp('/staff/import', {
      override: (spied) => {
        spied.importEmployees.mockImplementation((rows) =>
          Promise.resolve({
            results: rows.map((row, at) =>
              at === 0 && rows.length === 100
                ? { kind: 'refused' as const, reason: 'taken' as const }
                : { kind: 'added' as const, employee: employee(row.name) },
            ),
          }),
        );
      },
    });
    const many = Array.from({ length: 150 }, (_, at) => ({ name: `Người ${at}` }));
    await chooseAndRead(await staffFile(many));
    await userEvent.click(await screen.findByRole('button', { name: 'Add the people (150)' }));

    expect(await screen.findByText('149 people were added.')).toBeTruthy();
    expect(
      screen.getByText('1 rows were not added: their codes were taken meanwhile.'),
    ).toBeTruthy();
    expect(vi.mocked(api.importEmployees).mock.calls.map((call) => call[0].length)).toEqual([
      100, 50,
    ]);
  });

  it('A save that fails says the people may not all have been added, and offers the file again', async () => {
    openApp('/staff/import', {
      override: (spied) => {
        spied.importEmployees.mockRejectedValue(new ApiError(503));
      },
    });
    await chooseAndRead(await demoImportFile('en', 'import'));
    await userEvent.click(await screen.findByRole('button', { name: 'Add the people (3)' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/may not all have been added/);
    expect(screen.getByRole('button', { name: 'Add the people (3)' })).toBeTruthy();
  });

  it('A file the root chooses again starts the page over', async () => {
    openApp('/staff/import');
    await chooseAndRead(await demoImportFile('en', 'import'));
    await userEvent.click(await screen.findByRole('button', { name: 'Choose another file' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Add staff from Excel' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read the file' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.queryByText(/^Chosen:/)).toBeNull();
  });

  it('A file over 2 MB or 500 rows is refused before reading, and one that is not an Excel file or has no name column or no row says what to fix', async () => {
    openApp('/staff/import');
    const alertText = async () => (await screen.findByRole('alert')).textContent;

    expect(IMPORT_MAX_BYTES).toBe(2 * 1024 * 1024);
    await chooseAndRead(new File([new Uint8Array(IMPORT_MAX_BYTES + 1)], 'big.xlsx'));
    expect(await alertText()).toMatch(/over 2 MB/);

    await chooseAndRead(new File(['not a workbook'], 'text.xlsx'));
    await waitFor(async () => expect(await alertText()).toMatch(/could not be read as an Excel/));

    await chooseAndRead(await demoImportFile('en', 'import-no-name'));
    await waitFor(async () => expect(await alertText()).toContain('has no “Name” column'));

    const headingsOnly = await staffFile([]);
    await chooseAndRead(headingsOnly);
    await waitFor(async () => expect(await alertText()).toMatch(/no rows to add/));

    const crowd = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, at) => ({ name: `Người ${at}` }));
    await chooseAndRead(await staffFile(crowd));
    await waitFor(async () => expect(await alertText()).toMatch(/more than 500 rows/));
  });

  it('A page whose data cannot be read offers another try', async () => {
    openApp('/staff/import', {
      override: (spied) => {
        spied.listEmployees.mockRejectedValueOnce(new ApiError(503));
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Download the template' })).toBeTruthy();
  });

  it('Only the root imports: someone allowed every staff right is shown the page that says they may not open it, and nothing is asked', async () => {
    const { api } = openApp('/staff/import', { as: 'EMP-0001' });

    expect(
      await screen.findByRole('heading', { level: 2, name: 'You cannot open this page' }),
    ).toBeTruthy();
    expect(api.getStaffSetup).not.toHaveBeenCalled();
    expect(within(document.body).queryByText('Add staff from Excel')).toBeNull();
  });
});

describe('the walk spec’s steps for the import, replayed on the real router', () => {
  it('walk each language through the template, the file, the preview, the add and the file without the name column, by the whole labels the spec uses', async () => {
    for (const language of ['vi', 'en'] as const) {
      const words = DICTIONARIES[language];
      const whole = (text: string) =>
        new RegExp(`^${text.replace(/[(){}.*+?^$|[\]\\]/g, '\\$&')}$`);
      const chosenText = (name: string) => words.import.chosen.replace('{{name}}', name);

      // 19. the template handed over, the file chosen
      const first = openApp('/staff/import', { language });
      // the title stands while the data is read: the button comes with it
      await userEvent.click(
        await screen.findByRole('button', { name: whole(words.import.template) }),
      );
      expect(saved.at(-1)?.name).toBe(`staff-${language}.xlsx`);
      const picked = await demoImportFile(language, 'import');
      await userEvent.upload(screen.getByLabelText(whole(words.import.file)), picked);
      expect(await screen.findByText(chosenText(picked.name))).toBeTruthy();

      // 20. the rows read
      await userEvent.click(screen.getByRole('button', { name: whole(words.import.read) }));
      await screen.findByRole('heading', { level: 2, name: words.import.previewTitle });
      expect(screen.getAllByText(whole(words.import.willAdd))).toHaveLength(3);

      // 21. the people added
      await userEvent.click(
        screen.getByRole('button', { name: whole(words.import.add.replace('{{count}}', '3')) }),
      );
      await screen.findByRole('heading', { level: 2, name: words.import.doneTitle });
      expect(screen.getByText(words.import.doneAdded.replace('{{count}}', '3'))).toBeTruthy();
      first.unmount();

      // 22. the file without the name column
      const second = openApp('/staff/import', { language });
      const lacking = await demoImportFile(language, 'import-no-name');
      await userEvent.upload(await screen.findByLabelText(whole(words.import.file)), lacking);
      await userEvent.click(screen.getByRole('button', { name: whole(words.import.read) }));
      expect((await screen.findByRole('alert')).textContent).toBe(
        words.import.noName.replaceAll('{{name}}', words.addPerson.name),
      );
      second.unmount();
    }
  });
});

/** An added person as the BFF would answer, for a stubbed call. */
function employee(name: string) {
  return {
    id: `00000000-0000-4000-8000-${String(Math.abs(hash(name))).padStart(12, '0')}`,
    code: `X-${hash(name)}`,
    name,
    department: null,
    position: null,
    permissions: {},
    archived: false,
    extra: {},
  };
}

function hash(text: string) {
  return [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 1_000_000, 7);
}
