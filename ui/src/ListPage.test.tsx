import { DEMO_CUSTOMERS, DEMO_PRODUCTS } from '@credo/shared/demo';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';

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
});
