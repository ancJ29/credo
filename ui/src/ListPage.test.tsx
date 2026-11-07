import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_CUSTOMERS, DEMO_PRODUCTS } from '@credo/shared/demo';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { openApp } from '../tests/open';
import { ApiError } from './api';

/** What an input holds. */
const valueOf = (input: HTMLElement) => (input as HTMLInputElement).value;

/** A note's text, as the page reads it: empty unless it is a string. */
const textOf = (value: unknown) => (typeof value === 'string' ? value : '');

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
    expect(valueOf(card('Note').getByRole('textbox'))).toBe(first.extra['note']);
    expect(
      card('Basic information').getByRole('textbox', { name: 'Code' }).hasAttribute('readonly'),
    ).toBe(true);
    expect(drawn.api.getCustomer).toHaveBeenCalledOnce();
    expect(drawn.api.listCustomers).not.toHaveBeenCalled();
    drawn.unmount();

    openApp(`/customers/${first.id}`, { language: 'vi' });
    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Thông tin cơ bản', 'Liên hệ', 'Địa chỉ', 'Ghi chú']);
  });

  it('A customer with no note has an empty Note card to write one into for whoever may edit, and no Note card for someone who may only see', async () => {
    const quiet = DEMO_CUSTOMERS[1];
    const office = openApp(`/customers/${quiet.id}`);

    expect(await screen.findByRole('heading', { level: 2, name: quiet.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Contacts', 'Address', 'Note']);
    expect(valueOf(screen.getByRole('textbox', { name: 'Note' }))).toBe('');
    office.unmount();

    openApp(`/customers/${quiet.id}`, {
      override: (spied) => {
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        });
      },
    });
    expect(await screen.findByRole('heading', { level: 2, name: quiet.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Contacts', 'Address']);
  });

  it('Whoever may only see orders sees the values and no Save button', async () => {
    const noted = DEMO_CUSTOMERS[0];
    openApp(`/customers/${noted.id}`, {
      override: (spied) => {
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        });
      },
    });

    expect(await screen.findByRole('heading', { level: 2, name: noted.name })).toBeTruthy();
    expect(valueOf(screen.getByRole('textbox', { name: 'Name' }))).toBe(noted.name);
    expect(valueOf(screen.getByRole('textbox', { name: 'Note' }))).toBe(noted.extra['note']);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    for (const box of screen.getAllByRole('textbox'))
      expect(box.hasAttribute('readonly')).toBe(true);
  });

  it('A save sends the name, phone, address and note over the version read; an emptied field removes its own key and a key the page does not show survives; the new name shows, with a saved notice', async () => {
    const one = DEMO_CUSTOMERS[0];
    const drawn = openApp(`/customers/${one.id}`, {
      override: (spied, original) => {
        spied.getCustomer.mockImplementationOnce(async (id) => {
          const read = await original.getCustomer(id);
          return (
            read && {
              ...read,
              customer: { ...read.customer, extra: { ...read.customer.extra, tier: 'gold' } },
            }
          );
        });
      },
    });
    await screen.findByRole('heading', { level: 2, name: one.name });

    await userEvent.clear(screen.getByRole('textbox', { name: 'Phone' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Address' }), ' 12');
    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), ' Gọi trước.');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), '  Tên mới ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Saved.');
    const kept = Object.fromEntries(
      Object.entries({ ...one.extra, tier: 'gold' }).filter(([key]) => key !== 'phone'),
    );
    kept['address'] = `${textOf(one.extra['address'])} 12`;
    kept['note'] = `${textOf(one.extra['note'])} Gọi trước.`;
    expect(drawn.api.saveCustomer).toHaveBeenCalledExactlyOnceWith(one.id, {
      version: 'c1',
      name: 'Tên mới',
      extra: kept,
    });
    expect(await screen.findByRole('heading', { level: 2, name: 'Tên mới' })).toBeTruthy();
    expect(valueOf(screen.getByRole('textbox', { name: 'Phone' }))).toBe('');
  });

  it('An emptied address and note remove their own keys, and the phone and the name stay', async () => {
    const one = DEMO_CUSTOMERS[0];
    const drawn = openApp(`/customers/${one.id}`);
    await screen.findByRole('heading', { level: 2, name: one.name });

    await userEvent.clear(screen.getByRole('textbox', { name: 'Address' }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Note' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Saved.');
    const { address: _address, note: _note, ...kept } = one.extra;
    expect(drawn.api.saveCustomer).toHaveBeenCalledExactlyOnceWith(one.id, {
      version: 'c1',
      name: one.name,
      extra: kept,
    });
  });

  it('An empty name is refused on the page and no call is made', async () => {
    const one = DEMO_CUSTOMERS[0];
    const drawn = openApp(`/customers/${one.id}`);
    await screen.findByRole('heading', { level: 2, name: one.name });

    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Please write the customer’s name.')).toBeTruthy();
    expect(drawn.api.saveCustomer).not.toHaveBeenCalled();
  });

  it('Someone else saving first shows the notice and its reload, and keeps what was typed; the reload shows the newer customer', async () => {
    const one = DEMO_CUSTOMERS[0];
    const drawn = openApp(`/customers/${one.id}`, { cue: 'saveCustomer:409' });
    await screen.findByRole('heading', { level: 2, name: one.name });

    await userEvent.type(screen.getByRole('textbox', { name: 'Phone' }), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Someone saved newer details first.');
    expect(valueOf(screen.getByRole('textbox', { name: 'Phone' }))).toBe(
      `${textOf(one.extra['phone'])}9`,
    );
    await userEvent.click(within(notice).getByRole('button', { name: 'Show the newer details' }));
    await screen.findByRole('heading', { level: 2, name: one.name });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(valueOf(screen.getByRole('textbox', { name: 'Phone' }))).toBe(one.extra['phone']);
    expect(drawn.api.getCustomer).toHaveBeenCalledTimes(2);
  });

  it('A save that fails says so and keeps what was typed; one the BFF refuses as no longer allowed says that', async () => {
    const one = DEMO_CUSTOMERS[0];
    for (const [status, words] of [
      [503, 'The customer was not saved. What you typed'],
      [403, 'you may no longer change customers'],
    ] as const) {
      const drawn = openApp(`/customers/${one.id}`, {
        override: (spied) => {
          spied.saveCustomer.mockRejectedValueOnce(new ApiError(status));
        },
      });
      await screen.findByRole('heading', { level: 2, name: one.name });
      await userEvent.type(screen.getByRole('textbox', { name: 'Phone' }), '9');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect((await screen.findByRole('alert')).textContent).toContain(words);
      expect(valueOf(screen.getByRole('textbox', { name: 'Phone' }))).toBe(
        `${textOf(one.extra['phone'])}9`,
      );
      drawn.unmount();
    }
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
        spied.getCustomer.mockRejectedValueOnce(new ApiError(503));
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
  });

  it('The product’s name in the list is a link that opens that product’s page, and the page’s link goes back to the list', async () => {
    const first = DEMO_PRODUCTS[0];
    openApp('/products');

    await userEvent.click(await screen.findByRole('link', { name: first.name }));

    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: 'Back to the products' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Products' })).toBeTruthy();
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('The product’s page shows the code, name, unit, price, stock and note, each in its own card, the price as the language writes a number and the stock as a switch, in English and in Vietnamese', async () => {
    const noted = DEMO_PRODUCTS.find((one) => textOf(one.extra['note']) !== '')!;
    const card = (title: string) =>
      within(screen.getByRole('heading', { level: 3, name: title }).closest('section')!);
    const drawn = openApp(`/products/${noted.id}`);

    expect(await screen.findByRole('heading', { level: 2, name: noted.name })).toBeTruthy();
    expect(screen.getByText(noted.code)).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Unit and price', 'Stock', 'Note']);
    const basic = card('Basic information');
    expect(valueOf(basic.getByRole('textbox', { name: 'Code' }))).toBe(noted.code);
    expect(valueOf(basic.getByRole('textbox', { name: 'Name' }))).toBe(noted.name);
    const unit = card('Unit and price');
    expect(valueOf(unit.getByRole('textbox', { name: 'Unit' }))).toBe(noted.unit);
    expect(valueOf(unit.getByRole('textbox', { name: /^Price \(VND\)/ }))).toBe(
      new Intl.NumberFormat('en').format(noted.price),
    );
    expect(card('Stock').getByRole<HTMLInputElement>('switch', { name: 'Stocked' }).checked).toBe(
      noted.stocked,
    );
    expect(valueOf(card('Note').getByRole('textbox'))).toBe(noted.extra['note']);
    expect(basic.getByRole('textbox', { name: 'Code' }).hasAttribute('readonly')).toBe(true);
    expect(drawn.api.getProduct).toHaveBeenCalledOnce();
    expect(drawn.api.listProducts).not.toHaveBeenCalled();
    drawn.unmount();

    openApp(`/products/${noted.id}`, { language: 'vi' });
    expect(await screen.findByRole('heading', { level: 2, name: noted.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Thông tin cơ bản', 'Đơn vị và giá', 'Tồn kho', 'Ghi chú']);
    expect(
      valueOf(
        within(
          screen.getByRole('heading', { level: 3, name: 'Đơn vị và giá' }).closest('section')!,
        ).getByRole('textbox', { name: /^Giá \(đồng\)/ }),
      ),
    ).toBe(new Intl.NumberFormat('vi').format(noted.price));
  });

  it('A whole price saves as whole đồng, with the thousands mark read as the language writes it: 120.000 in Vietnamese is 120000; the price’s words describe the box', async () => {
    const one = DEMO_PRODUCTS[0];
    const drawn = openApp(`/products/${one.id}`, { language: 'vi' });
    await screen.findByRole('heading', { level: 2, name: one.name });

    const box = screen.getByRole('textbox', { name: /^Giá \(đồng\)/ });
    expect(box.getAttribute('aria-describedby')).toBeTruthy();
    await userEvent.clear(box);
    await userEvent.type(box, '120.000');
    expect(valueOf(box)).toBe('120.000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Đã lưu.');
    expect(drawn.api.saveProduct).toHaveBeenCalledExactlyOnceWith(
      one.id,
      expect.objectContaining({ price: 120000 }),
    );
  });

  it('A price that is empty, zero, negative or not whole is refused on the page with one word and makes no call; what was typed stays in the box, never cut, clamped or rounded', async () => {
    const one = DEMO_PRODUCTS[0];
    const drawn = openApp(`/products/${one.id}`);
    await screen.findByRole('heading', { level: 2, name: one.name });
    const box = () => screen.getByRole('textbox', { name: /^Price \(VND\)/ });
    const word = 'Write a whole number of đồng above zero.';

    // letters: the box yields nothing, so the price is empty, and empty is refused
    await userEvent.clear(box());
    await userEvent.type(box(), 'abc');
    expect(valueOf(box())).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(word)).toBeTruthy();
    // zero, a typed minus, a pasted minus, a pasted decimal and a size past the top each stay
    // as they were written
    for (const [how, text, shown] of [
      ['type', '0', '0'],
      ['type', '-5', '-5'],
      ['paste', '-5', '-5'],
      ['paste', '95000.5', '95,000.5'],
      ['paste', '1000000000001', '1,000,000,000,001'],
    ] as const) {
      await userEvent.clear(box());
      await userEvent.click(box());
      await (how === 'type' ? userEvent.type(box(), text) : userEvent.paste(text));
      expect(valueOf(box())).toBe(shown);
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByText(word)).toBeTruthy();
    }
    expect(drawn.api.saveProduct).not.toHaveBeenCalled();
  });

  it('An empty or over-long unit and an empty name are refused on the page and no call is made', async () => {
    const one = DEMO_PRODUCTS[0];
    const drawn = openApp(`/products/${one.id}`);
    await screen.findByRole('heading', { level: 2, name: one.name });

    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), '   ');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Unit' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Unit' }), 'x'.repeat(21));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Please write the product’s name, at most 200 characters.'),
    ).toBeTruthy();
    expect(screen.getByText('Please write the unit, at most 20 characters.')).toBeTruthy();
    expect(drawn.api.saveProduct).not.toHaveBeenCalled();
  });

  it('The stock switch saves true and false; the new values show with a saved notice, and the box shows the saved price', async () => {
    const one = DEMO_PRODUCTS.find((p) => p.stocked)!;
    const drawn = openApp(`/products/${one.id}`);
    await screen.findByRole('heading', { level: 2, name: one.name });
    const stock = () => screen.getByRole<HTMLInputElement>('switch', { name: 'Stocked' });
    expect(stock().checked).toBe(true);

    await userEvent.click(stock());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Saved.');
    expect(drawn.api.saveProduct).toHaveBeenLastCalledWith(
      one.id,
      expect.objectContaining({ version: 'p1', stocked: false, price: one.price }),
    );
    expect(stock().checked).toBe(false);

    await userEvent.click(stock());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(drawn.api.saveProduct).toHaveBeenCalledTimes(2));
    expect(drawn.api.saveProduct).toHaveBeenLastCalledWith(
      one.id,
      expect.objectContaining({ version: 'p2', stocked: true }),
    );
  });

  it('Whoever may only see orders sees every value, no Save button and a switch that cannot move', async () => {
    const noted = DEMO_PRODUCTS.find((one) => textOf(one.extra['note']) !== '')!;
    openApp(`/products/${noted.id}`, {
      override: (spied) => {
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        });
      },
    });

    expect(await screen.findByRole('heading', { level: 2, name: noted.name })).toBeTruthy();
    expect(valueOf(screen.getByRole('textbox', { name: 'Name' }))).toBe(noted.name);
    expect(valueOf(screen.getByRole('textbox', { name: 'Unit' }))).toBe(noted.unit);
    expect(valueOf(screen.getByRole('textbox', { name: /^Price \(VND\)/ }))).toBe(
      new Intl.NumberFormat('en').format(noted.price),
    );
    expect(valueOf(screen.getByRole('textbox', { name: 'Note' }))).toBe(noted.extra['note']);
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.getByRole<HTMLInputElement>('switch', { name: 'Stocked' }).disabled).toBe(true);
    for (const box of screen.getAllByRole('textbox'))
      expect(box.hasAttribute('readonly')).toBe(true);
  });

  it('An emptied note removes its key and a key the page does not show survives a save; a note left as it was keeps its key, even one that is not text', async () => {
    const noted = DEMO_PRODUCTS.find((one) => textOf(one.extra['note']) !== '')!;
    const quiet = DEMO_PRODUCTS.find((one) => textOf(one.extra['note']) === '')!;
    const hidden: Record<string, unknown> = { ...noted.extra, tier: 'gold' };
    const first = openApp(`/products/${noted.id}`, {
      override: (spied, original) => {
        spied.getProduct.mockImplementationOnce(async (id) => {
          const read = await original.getProduct(id);
          return read && { ...read, product: { ...read.product, extra: hidden } };
        });
      },
    });
    await screen.findByRole('heading', { level: 2, name: noted.name });
    await userEvent.clear(screen.getByRole('textbox', { name: 'Note' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Saved.');
    const { note: _note, ...kept } = hidden;
    expect(first.api.saveProduct).toHaveBeenCalledExactlyOnceWith(
      noted.id,
      expect.objectContaining({ extra: kept }),
    );
    first.unmount();

    const second = openApp(`/products/${quiet.id}`, {
      override: (spied, original) => {
        spied.getProduct.mockImplementationOnce(async (id) => {
          const read = await original.getProduct(id);
          return read && { ...read, product: { ...read.product, extra: { note: 5 } } };
        });
      },
    });
    await screen.findByRole('heading', { level: 2, name: quiet.name });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Saved.');
    expect(second.api.saveProduct).toHaveBeenCalledExactlyOnceWith(
      quiet.id,
      expect.objectContaining({ extra: { note: 5 } }),
    );
  });

  it('A note typed into the empty card is saved as the product’s note, trimmed', async () => {
    const quiet = DEMO_PRODUCTS.find((one) => textOf(one.extra['note']) === '')!;
    const drawn = openApp(`/products/${quiet.id}`);
    await screen.findByRole('heading', { level: 2, name: quiet.name });

    await userEvent.type(screen.getByRole('textbox', { name: 'Note' }), '  Giao trong ngày. ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Saved.');
    expect(drawn.api.saveProduct).toHaveBeenCalledExactlyOnceWith(
      quiet.id,
      expect.objectContaining({ extra: { ...quiet.extra, note: 'Giao trong ngày.' } }),
    );
  });

  it('A note that would push the details past 8 KB is refused on the page with a word of its own, and no call is made', async () => {
    const quiet = DEMO_PRODUCTS.find((one) => textOf(one.extra['note']) === '')!;
    const drawn = openApp(`/products/${quiet.id}`);
    await screen.findByRole('heading', { level: 2, name: quiet.name });

    await userEvent.click(screen.getByRole('textbox', { name: 'Note' }));
    await userEvent.paste('x'.repeat(9000));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('This note is too long to save. Please shorten it.'),
    ).toBeTruthy();
    expect(drawn.api.saveProduct).not.toHaveBeenCalled();
  });

  it('Someone else saving first shows the notice and its reload, and keeps what was typed; the reload shows the newer product', async () => {
    const one = DEMO_PRODUCTS[0];
    const drawn = openApp(`/products/${one.id}`, { cue: 'saveProduct:409' });
    await screen.findByRole('heading', { level: 2, name: one.name });

    await userEvent.type(screen.getByRole('textbox', { name: 'Unit' }), 'z');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Someone saved newer details first.');
    expect(valueOf(screen.getByRole('textbox', { name: 'Unit' }))).toBe(`${one.unit}z`);
    await userEvent.click(within(notice).getByRole('button', { name: 'Show the newer details' }));
    await screen.findByRole('heading', { level: 2, name: one.name });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(valueOf(screen.getByRole('textbox', { name: 'Unit' }))).toBe(one.unit);
    expect(drawn.api.getProduct).toHaveBeenCalledTimes(2);
  });

  it('A save that fails says so, one the BFF refuses as no longer allowed says that, and one it refuses as invalid says that; each keeps what was typed', async () => {
    const one = DEMO_PRODUCTS[0];
    for (const [status, words] of [
      [503, 'The product was not saved. What you typed'],
      [403, 'you may no longer change products'],
      [400, 'the system refused what you typed'],
    ] as const) {
      const drawn = openApp(`/products/${one.id}`, {
        override: (spied) => {
          spied.saveProduct.mockRejectedValueOnce(new ApiError(status));
        },
      });
      await screen.findByRole('heading', { level: 2, name: one.name });
      await userEvent.type(screen.getByRole('textbox', { name: 'Unit' }), 'z');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect((await screen.findByRole('alert')).textContent).toContain(words);
      expect(valueOf(screen.getByRole('textbox', { name: 'Unit' }))).toBe(`${one.unit}z`);
      drawn.unmount();
    }
  });

  it('An unknown product address says the product is not there, with the way back, and shows no product’s details', async () => {
    openApp('/products/00000000-0000-4000-8000-0000000000ff');

    expect(
      await screen.findByText(
        'This product is not in the list. It may have been taken out, or the address is wrong.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the products' })).toBeTruthy();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('A product with no note has an empty Note card to write one into for whoever may edit, two columns, and no Note card for someone who may only see, one column at the full width', async () => {
    const quiet = DEMO_PRODUCTS.find((one) => textOf(one.extra['note']) === '')!;
    const office = openApp(`/products/${quiet.id}`);

    expect(await screen.findByRole('heading', { level: 2, name: quiet.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Unit and price', 'Stock', 'Note']);
    expect(valueOf(screen.getByRole('textbox', { name: 'Note' }))).toBe('');
    expect(office.container.querySelectorAll('.mantine-Grid-col')).toHaveLength(2);
    office.unmount();

    const reader = openApp(`/products/${quiet.id}`, {
      override: (spied) => {
        spied.me.mockResolvedValue({
          user: { name: 'Xem', root: false, permissions: { 'orders.canView': true } },
        });
      },
    });
    expect(await screen.findByRole('heading', { level: 2, name: quiet.name })).toBeTruthy();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(['Basic information', 'Unit and price', 'Stock']);
    const grid = reader.container.querySelector('.mantine-Grid-inner')!;
    expect(grid.querySelectorAll('.mantine-Grid-col')).toHaveLength(1);
    // one span of 12 writes no media query: the same at every width
    expect(grid.querySelector(':scope > style')?.textContent).not.toContain('@media');
  });

  it('The product’s cards are still the shared DetailCard, none a bordered paper of its own', () => {
    const source = readFileSync(join(import.meta.dirname, 'ProductPage.tsx'), 'utf8');
    expect(source.match(/withBorder/g)).toBeNull();
  });

  it('The product’s page says so, and offers another try, when the product cannot be read', async () => {
    const first = DEMO_PRODUCTS[0];
    openApp(`/products/${first.id}`, {
      override: (spied) => {
        spied.getProduct.mockRejectedValueOnce(new ApiError(503));
      },
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 2, name: first.name })).toBeTruthy();
  });
});
