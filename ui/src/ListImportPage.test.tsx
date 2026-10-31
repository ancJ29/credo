import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from '@credo/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';
import { DICTIONARIES } from './i18n';
import { demoImportFile } from './importDemo';
import { readFirstSheet, writeWorkbook } from './importFile';
import { type Cells, headingOf, type ListKind, LISTS } from './listSheet';

/** The file field's input. */
const field = () => screen.getByLabelText<HTMLInputElement>(/^Excel file/);

/** A file of a list in English: the list's headings, then these rows by column key. */
async function listFile(kind: ListKind, rows: Cells[], name = `${kind}.xlsx`) {
  const columns = LISTS[kind].columns;
  const blob = await writeWorkbook([
    {
      name: 'List',
      rows: [
        columns.map((key) => headingOf(key, 'en')),
        ...rows.map((row) => columns.map((key) => row[key] ?? '')),
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

/** An added customer as the BFF would answer, for a stubbed call. */
const customer = (name: string) => ({
  id: '00000000-0000-4000-8000-000000000999',
  code: 'X-1',
  name,
  extra: {},
});

describe('the import page for the customers', () => {
  it('For each list the app gives a template in Vietnamese or English, handed over by the page', async () => {
    for (const [kind, language] of [
      ['customers', 'en'],
      ['products', 'vi'],
    ] as const) {
      saved.length = 0;
      const drawn = openApp(`/${kind}/import`, { language });
      const words = DICTIONARIES[language];
      await userEvent.click(await screen.findByRole('button', { name: words.import.template }));

      await waitFor(() => expect(saved).toHaveLength(1));
      expect(saved[0]?.name).toBe(`${kind}-${language}.xlsx`);
      const table = await readFirstSheet(saved[0].blob);
      expect(table[0]).toEqual(LISTS[kind].columns.map((key) => headingOf(key, language)));
      expect(table).toHaveLength(3);
      drawn.unmount();
    }
  });

  it('Before anything is saved, the root sees each row read and the reason for any refused; Add adds only the rows that hold, and the list then shows them', async () => {
    const { api } = openApp('/customers/import');
    await chooseAndRead(await demoImportFile('en', 'customers'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Check the rows' })).toBeTruthy();
    expect(screen.getByText(/3 of 5 rows will be added\. 2 will not/)).toBeTruthy();
    expect(api.importCustomers).not.toHaveBeenCalled();
    const text = screen.getByRole('table').textContent ?? '';
    expect(text).toContain('The code “KH-002” is already in the list, which stays as it was.');
    expect(text).toContain('The name is empty or longer than 200 characters.');
    expect(text).toContain('0909 330 007');

    await userEvent.click(screen.getByRole('button', { name: 'Add the customers (3)' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Customers added' })).toBeTruthy();
    expect(screen.getByText('3 customers were added.')).toBeTruthy();
    expect(screen.queryByText(/rows were not added/)).toBeNull();
    expect(vi.mocked(api.importCustomers).mock.calls[0]?.[0].map((row) => row.code)).toEqual([
      'KH-007',
      'KH-008',
      'KH-009',
    ]);
    await userEvent.click(screen.getByRole('link', { name: 'Back to the customers' }));
    expect(await screen.findByText('KH-009')).toBeTruthy();
    expect(screen.getByText('Công ty TNHH Gia Khang')).toBeTruthy();
  });

  it('A row the system could not answer for is listed by its row and name, “not added, try again”, and the rest goes on; the same file sent again is refused row by row as already in the list', async () => {
    const { api } = openApp('/customers/import', {
      override: (spied, original) => {
        spied.importCustomers.mockImplementationOnce(async (rows) => {
          // the second row is never written: the system was busy on it
          const reply = await original.importCustomers(rows.filter((_, at) => at !== 1));
          const busy = { kind: 'refused' as const, reason: 'busy' as const };
          return { results: [reply.results[0], busy, ...reply.results.slice(1)] };
        });
      },
    });
    await chooseAndRead(await demoImportFile('en', 'customers'));
    await userEvent.click(await screen.findByRole('button', { name: 'Add the customers (3)' }));

    expect(await screen.findByText('2 customers were added.')).toBeTruthy();
    const busy = within(screen.getByRole('table'));
    expect(busy.getByText('Công ty TNHH Gia Khang')).toBeTruthy();
    expect(busy.getByText('3')).toBeTruthy();
    expect(busy.getByText('Not added: the system was busy. Try this row again.')).toBeTruthy();
    expect(busy.getAllByRole('row')).toHaveLength(2);

    // the same file, sent again from a page opened afresh, finds its codes in the list
    await userEvent.click(screen.getByRole('link', { name: 'Back to the customers' }));
    await screen.findByText('KH-009');
    await userEvent.click(screen.getByRole('link', { name: 'Import from Excel' }));
    await chooseAndRead(await demoImportFile('en', 'customers'));
    expect(await screen.findByText(/1 of 5 rows will be added\. 4 will not/)).toBeTruthy();
    const text = screen.getByRole('table').textContent ?? '';
    expect(text).toContain('The code “KH-007” is already in the list');
    expect(text).toContain('The code “KH-009” is already in the list');
    expect(api.importCustomers).toHaveBeenCalledTimes(1);
  });

  it('says a code that was taken meanwhile apart from a row refused as invalid, and counts them apart', async () => {
    openApp('/customers/import', {
      override: (spied) => {
        spied.importCustomers.mockImplementation((rows) =>
          Promise.resolve({
            results: rows.map((row, at) =>
              at === 0
                ? { kind: 'refused' as const, reason: 'invalid' as const }
                : at === 1
                  ? { kind: 'refused' as const, reason: 'taken' as const }
                  : { kind: 'added' as const, record: customer(row.name) },
            ),
          }),
        );
      },
    });
    await chooseAndRead(await demoImportFile('en', 'customers'));
    await userEvent.click(await screen.findByRole('button', { name: 'Add the customers (3)' }));

    expect(await screen.findByText('1 customers were added.')).toBeTruthy();
    expect(
      screen.getByText('1 rows were not added: their codes were taken meanwhile.'),
    ).toBeTruthy();
    expect(screen.getByText('1 rows were not added: what they hold was refused.')).toBeTruthy();
  });

  it('sends a file’s rows a call’s worth at a time; when a later call fails, keeps the results of the calls answered, and sends only the rows not answered when the root adds the rest', async () => {
    let calls = 0;
    const { api } = openApp('/customers/import', {
      override: (spied) => {
        spied.importCustomers.mockImplementation((rows) => {
          if (++calls === 2) return Promise.reject(new ApiError(503));
          return Promise.resolve({
            results: rows.map((row) => ({ kind: 'added' as const, record: customer(row.name) })),
          });
        });
      },
    });
    const many = Array.from({ length: 150 }, (_, at) => ({ code: `K-${at}`, name: `Khách ${at}` }));
    await chooseAndRead(await listFile('customers', many));
    await userEvent.click(await screen.findByRole('button', { name: 'Add the customers (150)' }));

    expect(await screen.findByText('100 customers were added.')).toBeTruthy();
    expect(screen.getByText(/will not be sent again/).textContent).toMatch(
      /refuses the codes already there/,
    );
    expect(screen.queryByRole('button', { name: /^Add the customers/ })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Add the rest (50)' }));

    expect(await screen.findByText('150 customers were added.')).toBeTruthy();
    expect(screen.queryByText(/will not be sent again/)).toBeNull();
    const sent = vi.mocked(api.importCustomers).mock.calls.map((call) => call[0]);
    expect(sent.map((rows) => rows.length)).toEqual([100, 50, 50]);
    expect(sent[2]?.[0]?.code).toBe('K-100');
  });

  it('A save that fails says the rows may not all have been added, and offers the file again', async () => {
    openApp('/customers/import', {
      override: (spied) => {
        spied.importCustomers.mockRejectedValue(new ApiError(503));
      },
    });
    await chooseAndRead(await demoImportFile('en', 'customers'));
    await userEvent.click(await screen.findByRole('button', { name: 'Add the customers (3)' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/may not all have been added/);
    expect(screen.getByRole('button', { name: 'Add the customers (3)' })).toBeTruthy();
  });

  it('Choose another file starts the page over, and is disabled while a send runs', async () => {
    let answer: () => void = () => {};
    openApp('/customers/import', {
      override: (spied, original) => {
        spied.importCustomers.mockImplementation(
          (rows) =>
            new Promise((resolve) => {
              answer = () => void original.importCustomers(rows).then(resolve);
            }),
        );
      },
    });
    await chooseAndRead(await demoImportFile('en', 'customers'));
    await userEvent.click(await screen.findByRole('button', { name: 'Add the customers (3)' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Choose another file' }).hasAttribute('disabled'),
      ).toBe(true),
    );
    // a disabled button takes no click; the click is sent so that an enabled one would be pressed
    fireEvent.click(screen.getByRole('button', { name: 'Choose another file' }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(6);
    answer();
    await screen.findByText('3 customers were added.');
  });

  it('A file the root chooses again starts the page over', async () => {
    openApp('/customers/import');
    await chooseAndRead(await demoImportFile('en', 'customers'));
    await userEvent.click(await screen.findByRole('button', { name: 'Choose another file' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Add customers from Excel' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Read the file' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(screen.queryByText(/^Chosen:/)).toBeNull();
  });

  it('A file taken back out of the field leaves nothing chosen', async () => {
    openApp('/customers/import');
    await userEvent.upload(await waitFor(field), await demoImportFile('en', 'customers'));
    expect(screen.getByText('Chosen: customers.xlsx')).toBeTruthy();

    await userEvent.upload(field(), []);

    expect(screen.queryByText(/^Chosen:/)).toBeNull();
  });

  it('A file over 2 MB or 500 rows, or without its code or name column, is refused before any row is read, saying what to fix', async () => {
    openApp('/customers/import');
    const alertText = async () => (await screen.findByRole('alert')).textContent;

    await chooseAndRead(new File([new Uint8Array(IMPORT_MAX_BYTES + 1)], 'big.xlsx'));
    expect(await alertText()).toMatch(/over 2 MB/);

    await chooseAndRead(new File(['not a workbook'], 'text.xlsx'));
    await waitFor(async () => expect(await alertText()).toMatch(/could not be read as an Excel/));

    await chooseAndRead(await demoImportFile('en', 'customers-no-code'));
    await waitFor(async () =>
      expect(await alertText()).toBe(
        'This file has no “Code” column, which every row needs. Add a column headed “Code”, as the template has, and choose the file again.',
      ),
    );

    const noName = await writeWorkbook([{ name: 'List', rows: [['Code'], ['KH-1']] }]);
    await chooseAndRead(new File([noName], 'no-name.xlsx'));
    await waitFor(async () => expect(await alertText()).toContain('has no “Name” column'));

    await chooseAndRead(await listFile('customers', []));
    await waitFor(async () => expect(await alertText()).toMatch(/no rows to add/));

    const crowd = Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, at) => ({
      code: `K-${at}`,
      name: 'Tên',
    }));
    await chooseAndRead(await listFile('customers', crowd));
    await waitFor(async () => expect(await alertText()).toMatch(/more than 500 rows/));
  });

  it('A page whose data cannot be read offers another try', async () => {
    openApp('/customers/import', {
      override: (spied) => {
        spied.listCustomers.mockRejectedValueOnce(new ApiError(503));
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: 'Download the template' })).toBeTruthy();
  });
});

describe('the import page for the products', () => {
  it('Before anything is saved, the root sees each product row read, a price refused with what was typed, and Add adds the products that hold, whose prices the list then shows', async () => {
    const { api } = openApp('/products/import');
    await chooseAndRead(await demoImportFile('en', 'products'));

    expect(await screen.findByRole('heading', { level: 2, name: 'Check the rows' })).toBeTruthy();
    expect(screen.getByText(/3 of 5 rows will be added\. 2 will not/)).toBeTruthy();
    const text = screen.getByRole('table').textContent ?? '';
    expect(text).toContain('“thương lượng” is not a price');
    expect(text).toContain('The code “VT-002” is already in the list');
    expect(text).toContain('88.000');

    await userEvent.click(screen.getByRole('button', { name: 'Add the products (3)' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Products added' })).toBeTruthy();
    expect(vi.mocked(api.importProducts).mock.calls[0]?.[0].map((row) => row.price)).toEqual([
      88000, 180000, 72000,
    ]);
    await userEvent.click(screen.getByRole('link', { name: 'Back to the products' }));
    expect(await screen.findByText('VT-009')).toBeTruthy();
    expect(screen.getByText('72,000')).toBeTruthy();
  });

  it('says a unit that is empty or too long, and a row whose cells fit but fail the add, in words', async () => {
    openApp('/products/import');
    await chooseAndRead(
      await listFile('products', [
        { code: 'SP-1', name: 'Không đơn vị', price: '5000' },
        { code: 'SP-2', name: 'Ghi chú dài', unit: 'bao', price: '5000', note: 'x'.repeat(9000) },
        { code: '', name: 'Không mã', unit: 'bao', price: '5000' },
        { code: 'a b', name: 'Mã sai', unit: 'bao', price: '5000' },
        { code: 'SP-5', name: 'Một', unit: 'bao', price: '5000' },
        { code: 'sp-5', name: 'Hai', unit: 'bao', price: '5000' },
      ]),
    );

    const text = (await screen.findByRole('table')).textContent ?? '';
    for (const reason of [
      'The unit is empty or longer than 20 characters.',
      'The details of this row together are too long to save.',
      'The code is empty.',
      'The code “a b” is not 2 to 20 letters A to Z, digits or hyphens.',
      'The code “SP-5” is given by an earlier row of this file.',
    ]) {
      expect(text).toContain(reason);
    }
  });

  it('shows each product row’s stocked cell as it reads, an empty cell as Yes, and names the column of a word that is neither', async () => {
    const { api } = openApp('/products/import');
    await chooseAndRead(
      await listFile('products', [
        { code: 'SP-1', name: 'Để trống', unit: 'bao', price: '5000' },
        { code: 'SP-2', name: 'Không quản lý', unit: 'chuyến', price: '5000', stocked: 'Không' },
        { code: 'SP-3', name: 'Lạ', unit: 'bao', price: '5000', stocked: 'có thể' },
      ]),
    );

    const rows = (await screen.findAllByRole('row')).map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent),
    );
    expect(rows[1]?.slice(1, 6)).toEqual(['SP-1', 'Để trống', 'bao', '5000', 'Yes']);
    expect(rows[2]?.[5]).toBe('No');
    expect(rows[3]?.[5]).toBe('có thể');
    expect(rows[3]?.[6]).toContain('The “Stocked” column holds “có thể”');
    await userEvent.click(screen.getByRole('button', { name: 'Add the products (2)' }));
    await screen.findByText('2 products were added.');
    expect(vi.mocked(api.importProducts).mock.calls[0]?.[0].map((row) => row.stocked)).toEqual([
      true,
      false,
    ]);
  });

  it('shows the same page in Vietnamese', async () => {
    openApp('/products/import', { language: 'vi' });
    await userEvent.upload(await waitFor(field2), await demoImportFile('vi', 'products'));
    await userEvent.click(screen.getByRole('button', { name: 'Đọc tệp' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Kiểm tra các dòng' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thêm sản phẩm (3)' })).toBeTruthy();
    expect(screen.getByText(/“thương lượng” không phải là giá/)).toBeTruthy();
  });
});

const field2 = () => screen.getByLabelText<HTMLInputElement>(/^Tệp Excel/);

describe('the walk spec’s steps for the lists, replayed on the real router', () => {
  it('walk each list and language through the template, the file, the preview, the add and the file without the code column, by the whole labels the spec uses', async () => {
    const whole = (text: string) => new RegExp(`^${text.replace(/[(){}.*+?^$|[\]\\]/g, '\\$&')}$`);
    for (const language of ['vi', 'en'] as const) {
      const words = DICTIONARIES[language];
      for (const [kind, count] of [
        ['customers', '3'],
        ['products', '3'],
      ] as const) {
        const first = openApp(`/${kind}/import`, { language });
        const picked = await demoImportFile(language, kind);
        await userEvent.upload(await screen.findByLabelText(whole(words.import.file)), picked);
        expect(
          await screen.findByText(words.import.chosen.replace('{{name}}', picked.name)),
        ).toBeTruthy();
        await userEvent.click(screen.getByRole('button', { name: whole(words.import.read) }));
        await screen.findByRole('heading', { level: 2, name: words.import.previewTitle });
        expect(screen.getAllByText(whole(words.import.willAdd))).toHaveLength(3);
        await userEvent.click(
          screen.getByRole('button', {
            name: whole(words.lists[kind].add.replace('{{count}}', count)),
          }),
        );
        await screen.findByRole('heading', { level: 2, name: words.lists[kind].doneTitle });
        first.unmount();
      }

      const second = openApp('/customers/import', { language });
      const lacking = await demoImportFile(language, 'customers-no-code');
      await userEvent.upload(await screen.findByLabelText(whole(words.import.file)), lacking);
      await userEvent.click(screen.getByRole('button', { name: whole(words.import.read) }));
      expect((await screen.findByRole('alert')).textContent).toBe(
        words.lists.noColumn.replaceAll('{{name}}', words.lists.columns.code),
      );
      second.unmount();
    }
  });
});
