import { DEMO_CODE, DEMO_QR_SECRET } from '@credo/shared/demo';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openApp, person } from '../../../tests/open';
import { ApiError } from '../../api';
import { DICTIONARIES } from '../../i18n';
import { readQr } from '../../qrRead';

vi.mock('../../qrRead', () => ({ readQr: vi.fn() }));

const words = DICTIONARIES.en;
const bao = person('EMP-0004');
const LINK = `https://demo.example.test/login?client-code=${DEMO_CODE}&qr=${bao.id}.${DEMO_QR_SECRET}`;
const READ = { timeout: 3000 };
const stop = vi.fn();
const getUserMedia = vi.fn();

/** The camera, the canvas and the picture reader as a browser gives them; jsdom has none. */
beforeEach(() => {
  vi.mocked(readQr).mockReset();
  stop.mockReset();
  getUserMedia
    .mockReset()
    .mockImplementation(() => Promise.resolve({ getTracks: () => [{ stop }] }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        drawImage: vi.fn(),
        getImageData: () => ({ data: new Uint8ClampedArray(16), width: 2, height: 2 }),
      }) as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(() => Promise.resolve({ width: 2, height: 2, close: vi.fn() })),
  );
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 2,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 2,
  });
});
afterEach(() => vi.restoreAllMocks());

const scan = () => openApp('/login/qr', { out: true });
const picture = () => new File(['x'], 'code.png', { type: 'image/png' });
const fileInput = () => document.querySelector<HTMLInputElement>('input[type=file]')!;

describe('the walk spec’s phone scan screens 3 to 6, replayed on the real router', () => {
  it('WK6: the page opens on its two choices, a pasted code signs in with the tick, a used one is refused, and no camera is told', async () => {
    const choice = openApp('/login/qr', { out: true });
    expect(await screen.findByRole('heading', { level: 2, name: words.qrScan.title })).toBeTruthy();
    choice.unmount();

    const signed = openApp('/login/qr', { out: true });
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.byHand }));
    await userEvent.type(
      screen.getByRole('textbox', { name: words.qrScan.paste }),
      `${bao.id}.${DEMO_QR_SECRET}`,
    );
    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    expect((await screen.findByRole('status')).textContent).toBe(words.qrScan.signedIn);
    signed.unmount();

    const used = openApp('/login/qr', { out: true });
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.byHand }));
    await userEvent.type(
      screen.getByRole('textbox', { name: words.qrScan.paste }),
      `${bao.id}.used-before-qr-code`,
    );
    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.qrSignIn.refusedText);
    used.unmount();

    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    openApp('/login/qr', { out: true });
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.qrScan.noCamera);
  });
});

describe('the QR scan page', () => {
  it('3: opens on its two choices and a code the camera reads signs the person in with a green tick, then their first page', async () => {
    vi.mocked(readQr).mockResolvedValue(LINK);
    const { api } = scan();
    expect(await screen.findByRole('heading', { level: 2, name: words.qrScan.title })).toBeTruthy();
    expect(screen.getByRole('button', { name: words.qrScan.byHand })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: words.qrScan.scan }));
    expect(await screen.findByText(words.qrScan.scanning)).toBeTruthy();
    expect(await screen.findByText(words.qrScan.signedIn, undefined, READ)).toBeTruthy();
    expect(api.signInQr).toHaveBeenCalledExactlyOnceWith(bao.id, DEMO_QR_SECRET);
    expect(stop).toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { level: 2, name: words.staff.title }, READ),
    ).toBeTruthy();
  });

  it('3: a picture with a code signs in as the camera does, and a picture without one says so', async () => {
    vi.mocked(readQr).mockResolvedValueOnce(null).mockResolvedValue(LINK);
    const { api } = scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    await screen.findByText(words.qrScan.scanning);

    fireEvent.change(fileInput(), { target: { files: [picture()] } });
    expect((await screen.findByRole('alert')).textContent).toBe(words.qrScan.noCode);
    expect(api.signInQr).not.toHaveBeenCalled();

    fireEvent.change(fileInput(), { target: { files: [picture()] } });
    expect(await screen.findByText(words.qrScan.signedIn)).toBeTruthy();
    expect(api.signInQr).toHaveBeenCalledExactlyOnceWith(bao.id, DEMO_QR_SECRET);
  });

  it('5: takes a pasted link or its code part, and refuses any other text with no call', async () => {
    const { api } = scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.byHand }));
    const box = await screen.findByRole('textbox', { name: words.qrScan.paste });
    const press = screen.getByRole('button', { name: words.auth.submit });

    await userEvent.type(box, 'hello there');
    await userEvent.click(press);
    expect((await screen.findByRole('alert')).textContent).toBe(words.qrScan.notACode);
    expect(api.signInQr).not.toHaveBeenCalled();

    // a link with no code in it is no code either
    await userEvent.clear(box);
    await userEvent.type(box, 'https://demo.example.test/login?client-code=demo');
    await userEvent.click(press);
    expect((await screen.findByRole('alert')).textContent).toBe(words.qrScan.notACode);
    expect(api.signInQr).not.toHaveBeenCalled();

    await userEvent.clear(box);
    await userEvent.type(box, `${bao.id}.${DEMO_QR_SECRET}`);
    await userEvent.click(press);
    expect(await screen.findByText(words.qrScan.signedIn)).toBeTruthy();
    expect(api.signInQr).toHaveBeenCalledExactlyOnceWith(bao.id, DEMO_QR_SECRET);
  });

  it('5: a pasted whole link signs in too', async () => {
    const { api } = scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.byHand }));
    await userEvent.type(await screen.findByRole('textbox', { name: words.qrScan.paste }), LINK);
    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    expect(await screen.findByText(words.qrScan.signedIn)).toBeTruthy();
    expect(api.signInQr).toHaveBeenCalledExactlyOnceWith(bao.id, DEMO_QR_SECRET);
  });

  it('6: a camera that is refused or absent is told, the picture and the paste stay', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('denied'));
    scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    expect(await screen.findByText(words.qrScan.noCamera)).toBeTruthy();
    expect(fileInput()).toBeTruthy();
    expect(screen.getByRole('textbox', { name: words.qrScan.paste })).toBeTruthy();
  });

  it('6: no camera on the device is told the same, with no call to ask for one', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    expect(await screen.findByText(words.qrScan.noCamera)).toBeTruthy();
  });

  it('6: the camera stops when the page is left', async () => {
    const { unmount } = scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    await screen.findByText(words.qrScan.scanning);
    expect(stop).not.toHaveBeenCalled();
    unmount();
    expect(stop).toHaveBeenCalled();
  });

  it('6: a camera that opens after the page was left is stopped as it opens', async () => {
    let open: (stream: unknown) => void = () => undefined;
    getUserMedia.mockImplementationOnce(() => new Promise((resolve) => (open = resolve)));
    const { unmount } = scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    unmount();
    open({ getTracks: () => [{ stop }] });
    await waitFor(() => expect(stop).toHaveBeenCalled());
  });

  it('6: a frame with no size is skipped, and a canvas the browser does not give reads nothing', async () => {
    const size = vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(0);
    const { unmount } = scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    await screen.findByText(words.qrScan.scanning);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(readQr).not.toHaveBeenCalled();
    size.mockReturnValue(2);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(readQr).not.toHaveBeenCalled();
    unmount();
  });

  it('3: a code the camera sees again while it signs in is asked once', async () => {
    vi.mocked(readQr).mockResolvedValue(LINK);
    let finish: () => void = () => undefined;
    const { api } = openApp('/login/qr', {
      out: true,
      override: (spied, original) =>
        spied.signInQr.mockImplementation(async (id, secret) => {
          await new Promise<void>((resolve) => (finish = resolve));
          return original.signInQr(id, secret);
        }),
    });
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    await waitFor(() => expect(api.signInQr).toHaveBeenCalled(), READ);
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(api.signInQr).toHaveBeenCalledOnce();
    finish();
    expect(await screen.findByText(words.qrScan.signedIn)).toBeTruthy();
  });

  it('7: a refused code is told in the landing’s words with the way back to the password; any other failure says try again and keeps the page', async () => {
    const refused = openApp('/login/qr', {
      out: true,
      override: (spied) => spied.signInQr.mockRejectedValueOnce(new ApiError(401)),
    });
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.byHand }));
    await userEvent.type(await screen.findByRole('textbox', { name: words.qrScan.paste }), LINK);
    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    expect(await screen.findByText(words.qrSignIn.refusedText)).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: words.qrSignIn.password }));
    expect(await screen.findByRole('heading', { level: 2, name: words.auth.title })).toBeTruthy();
    refused.unmount();

    openApp('/login/qr', {
      out: true,
      override: (spied) => spied.signInQr.mockRejectedValueOnce(new ApiError(503)),
    });
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.byHand }));
    const box = await screen.findByRole('textbox', { name: words.qrScan.paste });
    await userEvent.type(box, LINK);
    await userEvent.click(screen.getByRole('button', { name: words.auth.submit }));
    expect((await screen.findByRole('alert')).textContent).toBe(words.common.unavailable);
    expect((box as HTMLInputElement).value).toBe(LINK);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: words.auth.submit })).toBeTruthy(),
    );
  });

  it('6: a picture the browser cannot draw is no code', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null);
    scan();
    await userEvent.click(await screen.findByRole('button', { name: words.qrScan.scan }));
    await screen.findByText(words.qrScan.scanning);
    fireEvent.change(fileInput(), { target: { files: [picture()] } });
    expect((await screen.findByRole('alert')).textContent).toBe(words.qrScan.noCode);
    expect(readQr).not.toHaveBeenCalled();
  });
});
