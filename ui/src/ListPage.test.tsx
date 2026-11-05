import { DEMO_CUSTOMERS, DEMO_PRODUCTS } from '@credo/shared/demo';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';

/** What an input holds. */
const valueOf = (input: HTMLElement) => (input as HTMLInputElement).value;

/** The text of each row of the table, cell by cell. */
const cells = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));

describe('the customers and the products', () => {
  it('The root opens Customers and Products from the menu; each lists all of the company’s in code order: a customer’s code, name, phone and address; a product’s code, name, unit and price in đồng', async () => {
    const drawn = openApp('/staff');
    const menu = within((await screen.findAllByRole('navigation', { name: 'Menu' }))[0]);

    await userEvent.click(menu.getByRole('link', { name: 'Customers' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Customers' })).toBeTruthy();
    const customers = await screen.findAllByRole('row');
    expect(customers).toHaveLength(DEMO_CUSTOMERS.length + 1);
    expect(cells()[0]).toEqual(['Code', 'Name', 'Phone', 'Address']);
    expect(cells().slice(1)).toEqual(
      DEMO_CUSTOMERS.map((one) => [one.code, one.name, one.extra['phone'], one.extra['address']]),
    );
    expect(
      cells()
        .slice(1)
        .map((row) => row[0]),
    ).toEqual([...DEMO_CUSTOMERS.map((one) => one.code)].sort());

    await userEvent.click(menu.getByRole('link', { name: 'Products' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Products' })).toBeTruthy();
    await screen.findByText('VT-006');
    expect(cells()[0]).toEqual(['Code', 'Name', 'Unit', 'Price (VND)', 'Stocked']);
    expect(cells().slice(1)).toEqual(
      DEMO_PRODUCTS.map((one) => [
        one.code,
        one.name,
        one.unit,
        new Intl.NumberFormat('en').format(one.price),
        one.stocked ? 'Yes' : 'No',
      ]),
    );
    expect(cells().find((row) => row[0] === 'VT-001')?.[3]).toBe('95,000');
    // the delivery fee, by the trip, is the one not stocked
    expect(cells().filter((row) => row[4] === 'No')).toEqual([
      ['DV-001', 'Phí giao hàng theo chuyến', 'chuyến', '150,000', 'No'],
    ]);
    drawn.unmount();
  });

  it('shows the list in Vietnamese with the price written as Vietnamese writes it, and a link to the import', async () => {
    openApp('/products', { language: 'vi' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Sản phẩm' })).toBeTruthy();
    await screen.findByText('VT-001');
    expect(cells()[0]).toEqual(['Mã', 'Tên', 'Đơn vị tính', 'Giá (đồng)', 'Quản lý tồn kho']);
    expect(
      cells()
        .find((row) => row[0] === 'VT-001')
        ?.slice(3),
    ).toEqual(['95.000', 'Có']);
    expect(cells().find((row) => row[0] === 'DV-001')?.[4]).toBe('Không');
    expect(screen.getByRole('link', { name: 'Nhập từ Excel' }).getAttribute('href')).toBe(
      '/products/import',
    );
  });

  it('A customer’s phone and address are empty in the list when the record keeps none', async () => {
    openApp('/customers', {
      override: (spied) => {
        spied.listCustomers.mockResolvedValue([
          {
            id: '00000000-0000-4000-8000-000000000001',
            code: 'KH-9',
            name: 'Chỉ có tên',
            extra: { phone: 5 },
          },
        ]);
      },
    });

    await screen.findByText('Chỉ có tên');
    expect(cells()[1]).toEqual(['KH-9', 'Chỉ có tên', '', '']);
  });

  it('says there is nothing yet while a list is empty, and offers another try when it cannot be read', async () => {
    const empty = openApp('/customers', {
      override: (spied) => {
        spied.listCustomers.mockResolvedValue([]);
      },
    });
    expect(
      await screen.findByText('No customers yet. Import them from an Excel file.'),
    ).toBeTruthy();
    empty.unmount();

    openApp('/products', {
      override: (spied) => {
        spied.listProducts.mockRejectedValueOnce(new ApiError(503));
      },
    });
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('VT-001')).toBeTruthy();
  });

  it('Whoever may see orders sees the two lists in the menu and opens them; only the root imports, and someone who may not see orders has neither', async () => {
    const office = openApp('/customers', { as: 'EMP-0001' });

    expect(await screen.findByRole('heading', { level: 2, name: 'Customers' })).toBeTruthy();
    await screen.findByText('KH-001');
    expect(office.api.listCustomers).toHaveBeenCalledOnce();
    const menu = within(screen.getAllByRole('navigation', { name: 'Menu' })[0]);
    expect(menu.getByText('Customers')).toBeTruthy();
    expect(menu.getByText('Products')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Import from Excel' })).toBeNull();
    office.unmount();

    const imports = openApp('/products/import', { as: 'EMP-0001' });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'You cannot open this page' }),
    ).toBeTruthy();
    imports.unmount();

    const warehouse = openApp('/customers', { as: 'EMP-0004' });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'You cannot open this page' }),
    ).toBeTruthy();
    expect(warehouse.api.listCustomers).not.toHaveBeenCalled();
    expect(
      within(screen.getAllByRole('navigation', { name: 'Menu' })[0]).queryByText('Customers'),
    ).toBeNull();
  });

  it('The customer’s name in the list is a link that opens that customer’s page, and the page’s link goes back to the list', async () => {
    const first = DEMO_CUSTOMERS[0];
    openApp('/customers');

    await userEvent.click(await screen.findByRole('link', { name: first.name }));

    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Back to the customers' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Customers' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('The customer’s page shows the code and name, the phone, the address and the note, each in its own card, in English and in Vietnamese', async () => {
    const first = DEMO_CUSTOMERS[0];
    const card = (title: string) =>
      within(screen.getByRole('heading', { level: 3, name: title }).closest('section')!);
    const drawn = openApp(`/customers/${first.id}`);

    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
    expect(screen.getByText(first.code)).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Contacts', 'Address', 'Note']);
    const basic = card('Basic information');
    expect(valueOf(basic.getByRole('textbox', { name: 'Code' }))).toBe(first.code);
    expect(valueOf(basic.getByRole('textbox', { name: 'Name' }))).toBe(first.name);
    expect(valueOf(card('Contacts').getByRole('textbox', { name: 'Phone' }))).toBe(
      first.extra['phone'],
    );
    expect(valueOf(card('Address').getByRole('textbox'))).toBe(first.extra['address']);
    expect(card('Note').getByText(first.extra['note'] as string)).toBeTruthy();
    expect(
      card('Basic information').getByRole('textbox', { name: 'Code' }).hasAttribute('readonly'),
    ).toBe(true);
    expect(drawn.api.listCustomers).toHaveBeenCalledOnce();
    drawn.unmount();

    openApp(`/customers/${first.id}`, { language: 'vi' });
    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Thông tin cơ bản', 'Liên hệ', 'Địa chỉ', 'Ghi chú']);
  });

  it('A customer with no note has no Note card', async () => {
    const quiet = DEMO_CUSTOMERS[1];
    openApp(`/customers/${quiet.id}`);

    expect(await screen.findByRole('heading', { level: 2, name: quiet.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Contacts', 'Address']);
  });

  it('An unknown customer address says the customer is not there, with the way back, and shows no customer’s details', async () => {
    openApp('/customers/00000000-0000-4000-8000-0000000000ff');

    expect(
      await screen.findByText(
        'This customer is not in the list. It may have been taken out, or the address is wrong.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the customers' })).toBeTruthy();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('The customer’s page says so, and offers another try, when the list cannot be read', async () => {
    const first = DEMO_CUSTOMERS[0];
    openApp(`/customers/${first.id}`, {
      override: (spied) => {
        spied.listCustomers.mockRejectedValueOnce(new ApiError(503));
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
  });
});
