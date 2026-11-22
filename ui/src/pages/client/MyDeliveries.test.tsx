import { photoAddressRequestOf } from '@credo/shared';
import {
  DEMO_DELIVERIES,
  DEMO_DELIVERY_PHOTOS,
  DEMO_TODAY,
  DEMO_WALK_PROOF,
} from '@credo/shared/demo';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openApp } from '../../../tests/open';
import { ApiError } from '../../api';

import { DICTIONARIES } from '../../i18n';

const words = DICTIONARIES.en;
/** A word at the start of a label, the star of a required field allowed after it. */
const starting = (word: string) => new RegExp(`^${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
const TUNG = 'EMP-0005';
const money = (amount: number) =>
  words.orders.money.replace('{{amount}}', new Intl.NumberFormat('en').format(amount));
const menu = () => within(screen.getAllByRole('navigation', { name: words.nav.menu })[0]);
const heading = (name: string | RegExp, level = 2) => screen.findByRole('heading', { level, name });

const todays = DEMO_DELIVERIES.filter((one) => one.day === DEMO_TODAY && one.driver.code === TUNG);
const waiting = todays.find((one) => one.state === 'waiting')!;
const delivered = todays.find((one) => one.state === 'delivered')!;
const cancelled = todays.find((one) => one.state === 'cancelled')!;
const collect = (total: number) => words.orders.collect.replace('{{total}}', money(total));
const at = (request: { day: string; id: string }) => `/my-deliveries/${request.day}/${request.id}`;

/** The picture the camera gives: the data set's drawn one, as a file. */
const picture = () => {
  const bytes = Uint8Array.from(atob(DEMO_WALK_PROOF.split(',')[1]), (c) => c.charCodeAt(0));
  return new File([bytes], 'photo.png', { type: 'image/png' });
};
const cameraField = () => screen.findByLabelText<HTMLInputElement>(words.myDeliveries.photoField);
const take = async () => {
  await userEvent.upload(await cameraField(), picture());
  return await screen.findByRole('img', { name: words.myDeliveries.photoAlt });
};
const opened = () => screen.findByRole('button', { name: words.myDeliveries.deliver });

afterEach(() => vi.restoreAllMocks());

describe('the driver’s landing', () => {
  it('A driver is a person of the staff whom the root allows to deliver: on a phone they land on My deliveries, the first page of their menu; the root, and anyone not allowed to deliver, has no such page', async () => {
    const drawn = openApp('/', { as: TUNG });

    expect(await heading(words.nav.myDeliveries)).toBeTruthy();
    expect(
      menu()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([words.nav.myDeliveries]);
    await waitFor(() => expect(drawn.api.myDeliveries).toHaveBeenCalledExactlyOnceWith(DEMO_TODAY));
    drawn.unmount();

    // the root lands on orders and is refused the driver's pages by their addresses
    for (const path of ['/my-deliveries', at(waiting)]) {
      const root = openApp(path);
      expect(
        await screen.findByRole('heading', { level: 2, name: words.forbidden.title }),
        path,
      ).toBeTruthy();
      expect(root.api.myDeliveries, path).not.toHaveBeenCalled();
      expect(menu().queryByRole('link', { name: words.nav.myDeliveries }), path).toBeNull();
      root.unmount();
    }
    // the office holds no right to deliver: no such page in its menu, and none by its address
    const office = openApp('/my-deliveries', { as: 'EMP-0001' });
    expect(
      await screen.findByRole('heading', { level: 2, name: words.forbidden.title }),
    ).toBeTruthy();
    expect(menu().queryByRole('link', { name: words.nav.myDeliveries })).toBeNull();
    office.unmount();
    // a driver whom the root stopped allowing to deliver is allowed nothing
    openApp('/my-deliveries', { as: TUNG, noDrivers: true });
    expect(await heading(words.nothing.title)).toBeTruthy();
  });
});

describe('My deliveries', () => {
  it('My deliveries lists the driver’s own requests for the phone’s today, those waiting first and then those delivered, each with its number, customer, address and total to collect; one the office cancelled is not listed, and another driver’s never is', async () => {
    openApp('/my-deliveries', { as: TUNG });

    const cards = await screen.findAllByRole('link', { name: /^GH-/ });
    expect(cards.map((card) => card.getAttribute('href'))).toEqual(
      [waiting, delivered].map((one) => at(one)),
    );
    const [first, second] = cards;
    expect(first.textContent).toBe(
      `${waiting.number}${words.orders.state.waiting}${waiting.customer.name}${waiting.customer.extra['address'] as string}${collect(waiting.total)}`,
    );
    expect(second.textContent).toContain(words.orders.state.delivered);
    expect(screen.queryByText(cancelled.number)).toBeNull();
    expect(
      screen.queryByText(DEMO_DELIVERIES.find((one) => one.driver.code === 'EMP-0006')!.number),
    ).toBeNull();
  });

  it('says it is empty on a day with none, reads a customer with no address as a blank line, and tries again after a failure', async () => {
    openApp('/my-deliveries', {
      as: TUNG,
      override: (spied) => spied.myDeliveries.mockResolvedValue([]),
    });
    expect(await screen.findByText(words.myDeliveries.none)).toBeTruthy();
    document.body.innerHTML = '';

    openApp('/my-deliveries', {
      as: TUNG,
      override: (spied) =>
        spied.myDeliveries.mockResolvedValue([
          { ...waiting, customer: { ...waiting.customer, extra: {} } },
        ]),
    });
    expect(await screen.findByRole('link', { name: /^GH-/ })).toBeTruthy();
    document.body.innerHTML = '';

    openApp('/my-deliveries', {
      as: TUNG,
      override: (spied, original) => {
        spied.myDeliveries.mockRejectedValueOnce(new ApiError(503));
        spied.myDeliveries.mockImplementation((day) => original.myDeliveries(day));
      },
    });
    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
    await userEvent.click(screen.getByRole('button', { name: words.common.retry }));
    expect(await screen.findAllByRole('link', { name: /^GH-/ })).toHaveLength(2);
  });
});

describe('a request opened on the phone', () => {
  it('A request opened on the phone shows the customer’s name, phone (a tap calls it) and address, each product with its unit and quantity, the total to collect, and one button, Delivered', async () => {
    openApp(at(waiting), { as: TUNG });

    expect(
      await heading(words.orders.requestTitle.replace('{{number}}', waiting.number)),
    ).toBeTruthy();
    expect(screen.getByText(waiting.customer.name)).toBeTruthy();
    const phone = waiting.customer.extra['phone'] as string;
    expect(
      screen
        .getByRole('link', { name: words.myDeliveries.call.replace('{{phone}}', phone) })
        .getAttribute('href'),
    ).toBe(`tel:${phone.replace(/\s/g, '')}`);
    expect(
      screen.getByText(
        words.orders.address.replace('{{address}}', waiting.customer.extra['address'] as string),
      ),
    ).toBeTruthy();
    const lines = within(screen.getByRole('table'))
      .getAllByRole('row')
      .map((row) => [...row.querySelectorAll('th, td')].map((cell) => cell.textContent));
    expect(lines.slice(1, -1).map((row) => [row[0], row[1], row[3]])).toEqual(
      waiting.lines.map((line) => [
        `${line.code} · ${line.name}`,
        line.unit,
        new Intl.NumberFormat('en').format(line.quantity),
      ]),
    );
    expect(screen.getByText(collect(waiting.total))).toBeTruthy();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toContain(
      words.myDeliveries.deliver,
    );
    expect(screen.queryByRole('button', { name: words.myDeliveries.send })).toBeNull();
  });

  it('reads a customer with no phone and no address, and says it could not load a request that is not there', async () => {
    openApp(at(waiting), {
      as: TUNG,
      override: (spied) =>
        spied.getDelivery.mockResolvedValue({
          request: { ...waiting, customer: { ...waiting.customer, extra: {} } },
          version: 'g1',
        }),
    });
    expect(
      await heading(words.orders.requestTitle.replace('{{number}}', waiting.number)),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', {
        name: starting(words.myDeliveries.call.replace('{{phone}}', '')),
      }),
    ).toBeNull();
    expect(
      screen.queryByText(starting(words.orders.address.replace('{{address}}', ''))),
    ).toBeNull();
    document.body.innerHTML = '';

    openApp(`/my-deliveries/${DEMO_TODAY}/00000000-0000-4000-8000-000000000999`, { as: TUNG });
    expect((await screen.findByRole('alert')).textContent).toContain(words.common.loadFailed);
  });
});

describe('Delivered', () => {
  it('Delivered opens the phone’s camera; the photo is shown before it is sent, to send or to take again; the phone makes it smaller first; without a photo nothing is delivered', async () => {
    const drawn = openApp(at(waiting), { as: TUNG });
    const clicked = vi.spyOn(HTMLInputElement.prototype, 'click');
    const camera = await cameraField();
    expect(camera.getAttribute('capture')).toBe('environment');
    expect(camera.getAttribute('accept')).toBe('image/*');

    await userEvent.click(await opened());
    expect(clicked).toHaveBeenCalledTimes(1);
    clicked.mockClear();
    // nothing is chosen yet: nothing is sent, and there is no Send
    expect(screen.queryByRole('button', { name: words.myDeliveries.send })).toBeNull();
    expect(drawn.api.deliver).not.toHaveBeenCalled();

    // the picture is shown, with Send and a way to take another
    const preview = await take();
    expect(preview.getAttribute('src')).toBe(DEMO_WALK_PROOF);
    expect(
      screen.getByRole('heading', { level: 3, name: words.myDeliveries.photoTitle }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.myDeliveries.deliver })).toBeNull();
    expect(drawn.api.deliver).not.toHaveBeenCalled();
    clicked.mockClear();
    await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.again }));
    expect(clicked).toHaveBeenCalledTimes(1);
  });

  it('A picture the phone cannot use asks for another photo and sends nothing; a chosen file with none given is ignored', async () => {
    const drawn = openApp(at(waiting), {
      as: TUNG,
      language: 'en',
    });
    const camera = await cameraField();
    fireEvent.change(camera, { target: { files: [] } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: words.myDeliveries.send })).toBeNull();
    // a stand-in that cannot read the picture, as the browser's can fail on a file it does not read
    document.body.innerHTML = '';
    const failing = openApp(at(waiting), {
      as: TUNG,
      shrink: () => Promise.reject(new Error('no')),
    });
    await userEvent.upload(await cameraField(), picture());
    expect((await screen.findByRole('alert')).textContent).toBe(words.myDeliveries.unusable);
    expect(screen.queryByRole('button', { name: words.myDeliveries.send })).toBeNull();
    expect(failing.api.deliver).not.toHaveBeenCalled();
    expect(drawn.api.deliver).not.toHaveBeenCalled();
  });

  it('Delivered is the whole request, marked once: once sent, the phone reads Delivered with the photo, and the order is Fulfilled', async () => {
    const drawn = openApp(at(waiting), { as: TUNG });
    await take();

    await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

    // the photo first: an address is asked for, the picture goes to it, then the request is marked
    expect(drawn.api.askPhotoAddress).toHaveBeenCalledExactlyOnceWith(
      waiting.day,
      waiting.id,
      photoAddressRequestOf(DEMO_WALK_PROOF),
    );
    expect(drawn.api.putPhoto).toHaveBeenCalledExactlyOnceWith(
      `https://photos.invalid/upload/${waiting.id}`,
      DEMO_WALK_PROOF,
    );
    expect(drawn.api.deliver).toHaveBeenCalledExactlyOnceWith(waiting.day, waiting.id, {
      version: 'g1',
    });
    expect((await screen.findByRole('status')).textContent).toBe(words.myDeliveries.done);
    expect(screen.getByText(words.orders.state.delivered)).toBeTruthy();
    // the photo is read back from the request's own route, and nothing is left to press
    const proof = await screen.findByRole('img', {
      name: words.orders.proofAlt,
    });
    expect(proof.getAttribute('src')).toBe(DEMO_WALK_PROOF);
    expect(drawn.api.getDeliveryPhoto).toHaveBeenCalledWith(waiting.day, waiting.id);
    expect(screen.queryByRole('button', { name: words.myDeliveries.send })).toBeNull();
    expect(screen.queryByLabelText(words.myDeliveries.photoField)).toBeNull();
    // the list now holds it among the delivered
    await userEvent.click(screen.getByRole('link', { name: words.myDeliveries.back }));
    const cards = await screen.findAllByRole('link', { name: /^GH-/ });
    expect(cards.every((card) => card.textContent?.includes(words.orders.state.delivered))).toBe(
      true,
    );
  });

  it('A request already delivered opens with its photo and no button', async () => {
    openApp(at(delivered), { as: TUNG });

    const proof = await screen.findByRole('img', {
      name: words.orders.proofAlt,
    });
    expect(proof.getAttribute('src')).toBe(DEMO_DELIVERY_PHOTOS[delivered.id]);
    expect(screen.queryByRole('button', { name: words.myDeliveries.deliver })).toBeNull();
  });
});

describe('Delivered, when it goes wrong', () => {
  it('A request the office cancelled before Delivered was sent tells the driver so, and nothing is delivered', async () => {
    const drawn = openApp(at(waiting), { as: TUNG, cue: 'deliver:409' });
    await take();

    await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.myDeliveries.cancelled);
    expect(screen.getByText(words.orders.state.cancelled)).toBeTruthy();
    expect(screen.queryByRole('button', { name: words.myDeliveries.send })).toBeNull();
    expect(screen.queryByRole('button', { name: words.myDeliveries.deliver })).toBeNull();
    expect(drawn.api.getDeliveryPhoto).not.toHaveBeenCalled();
  });

  it('A send that fails says so, keeps the photo on the phone, and sends it again on a tap', async () => {
    const drawn = openApp(at(waiting), { as: TUNG, cue: 'deliver:503' });
    await take();

    await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

    expect((await screen.findByRole('alert')).textContent).toBe(words.myDeliveries.sendFailed);
    expect(screen.getByRole('img', { name: words.myDeliveries.photoAlt })).toBeTruthy();
    expect(screen.getByText(words.orders.state.waiting)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

    await waitFor(() => expect(drawn.api.deliver).toHaveBeenCalledTimes(2));
    expect(drawn.api.deliver).toHaveBeenLastCalledWith(waiting.day, waiting.id, {
      version: 'g1',
    });
    expect((await screen.findByRole('status')).textContent).toBe(words.myDeliveries.done);
  });

  it('A photo that cannot be sent (no answer, or the store refused it) stays on the phone, says it was not sent, leaves the request waiting and marks nothing delivered, and Send again asks for a new address', async () => {
    for (const cue of ['putPhoto:silent', 'putPhoto:503']) {
      const drawn = openApp(at(waiting), { as: TUNG, cue });
      await take();

      await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

      expect((await screen.findByRole('alert')).textContent, cue).toBe(
        words.myDeliveries.sendFailed,
      );
      expect(screen.getByRole('img', { name: words.myDeliveries.photoAlt })).toBeTruthy();
      expect(screen.getByText(words.orders.state.waiting)).toBeTruthy();
      expect(drawn.api.deliver).not.toHaveBeenCalled();

      await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

      expect((await screen.findByRole('status')).textContent).toBe(words.myDeliveries.done);
      expect(drawn.api.askPhotoAddress).toHaveBeenCalledTimes(2);
      expect(drawn.api.putPhoto).toHaveBeenCalledTimes(2);
      expect(drawn.api.deliver).toHaveBeenCalledExactlyOnceWith(waiting.day, waiting.id, {
        version: 'g1',
      });
      document.body.innerHTML = '';
    }
  });

  it('A request that is no longer waiting gets no address: the page reads it again and nothing is sent', async () => {
    const drawn = openApp(at(waiting), {
      as: TUNG,
      override: (spied) =>
        spied.askPhotoAddress.mockResolvedValue({ kind: 'conflict', current: null }),
    });
    await take();

    await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

    await waitFor(() => expect(drawn.api.getDelivery).toHaveBeenCalledTimes(2));
    expect(drawn.api.putPhoto).not.toHaveBeenCalled();
    expect(drawn.api.deliver).not.toHaveBeenCalled();
  });

  it('A refusal with no newer request has the page read it again, the photo no longer needed', async () => {
    const drawn = openApp(at(waiting), {
      as: TUNG,
      override: (spied) => spied.deliver.mockResolvedValue({ kind: 'conflict', current: null }),
    });
    await take();

    await userEvent.click(screen.getByRole('button', { name: words.myDeliveries.send }));

    await waitFor(() => expect(drawn.api.getDelivery).toHaveBeenCalledTimes(2));
    expect(await opened()).toBeTruthy();
    expect(screen.queryByRole('img', { name: words.myDeliveries.photoAlt })).toBeNull();
  });
});
