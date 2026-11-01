import { DEMO_CODE, DEMO_EMPLOYEES, DEMO_OPERATOR_ID } from '@credo/shared/demo';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { drawApp } from '../tests/render';
import { ApiError } from './api';
import { PasskeyNotGiven } from './passkeys';
import { App, sceneParts } from './scene';

describe('a scene’s parts', () => {
  it('put the app on the demo company, signed in as the root and speaking the language asked', async () => {
    const { api, device } = sceneParts({ language: 'vi' });

    expect(device.clientCode()).toBe(DEMO_CODE);
    expect(device.language()).toBe('vi');
    expect(device.authId()).toBe('fake.session');
    expect((await api.me()).user).toMatchObject({ name: 'root', root: true });
  });

  it('sign a data-set person in by their code, as that person and no other', async () => {
    const { api, device } = sceneParts({ as: 'EMP-0001', language: 'en' });

    expect(device.language()).toBe('en');
    expect(device.authId()).toBe(`fake.session.${DEMO_EMPLOYEES[0]?.id}`);
    expect((await api.me()).user).toMatchObject({ name: 'Nguyễn Thị Lan', root: false });
  });

  it('sign the operator in, with a handle kept apart from the root’s, when asked', async () => {
    const operator = sceneParts({ operator: true, language: 'en' });
    expect(operator.device.operatorAuthId()).toBe('fake.operator');
    expect(await operator.api.operatorMe()).toEqual({
      operator: { id: DEMO_OPERATOR_ID, name: 'operator' },
    });

    expect(sceneParts({ language: 'en' }).device.operatorAuthId()).toBeNull();
  });

  it('hand a chosen picture back as it is, as a data URL: the stand-in for what makes a photo small', async () => {
    const { shrink } = sceneParts({ language: 'en' });
    const bytes = [137, 80, 78, 71, 13, 10, 26, 10];
    const file = new File([new Uint8Array(bytes)], 'photo.png', { type: 'image/png' });

    expect(await shrink(file)).toBe(`data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`);
  });

  it('refuse a code the data set does not hold, naming it', () => {
    expect(() => sceneParts({ as: 'EMP-9999', language: 'en' })).toThrow(
      'no EMP-9999 in the data set',
    );
  });

  it('carry the device’s passkeys, faked, with the authenticator’s cue', async () => {
    const { passkeys } = sceneParts({ cue: 'passkey:notGiven', language: 'en' });

    await expect(passkeys.authenticate({ challenge: 'c' })).rejects.toBeInstanceOf(PasskeyNotGiven);
    await expect(passkeys.authenticate({ challenge: 'c' })).resolves.toMatchObject({
      type: 'public-key',
    });
  });

  it('carry a cue, which makes the call it names answer its status once', async () => {
    const { api } = sceneParts({ cue: 'getConfig:503', language: 'en' });

    await expect(api.getConfig()).rejects.toBeInstanceOf(ApiError);
    expect((await api.getConfig()).config.name).toBe('Minh Phát');
  });

  it('make each call a fake of its own, so one scene’s changes are another’s no more', async () => {
    const first = sceneParts({ language: 'en' }).api;
    const second = sceneParts({ language: 'en' }).api;
    const id = DEMO_EMPLOYEES[5]?.id ?? '';
    const read = await first.getEmployee(id);
    await first.archiveEmployee(id, read.version);

    expect((await second.getEmployee(id)).employee.archived).toBe(false);
  });

  it('hand over the whole app', () => {
    expect(typeof App).toBe('function');
  });

  it('draw the app with the look it is given: its colour scheme fixed, on the element asked', async () => {
    const holder = document.createElement('div');
    document.documentElement.removeAttribute('data-mantine-color-scheme');
    const { api, device, passkeys, build } = sceneParts({ language: 'en' });

    drawApp(
      <App
        api={api}
        device={device}
        passkeys={passkeys}
        build={build}
        look={{ scheme: 'dark', root: () => holder }}
        test
      />,
      '/staff',
    );

    expect(await screen.findByRole('heading', { level: 2, name: 'Staff' })).toBeTruthy();
    expect(holder.getAttribute('data-mantine-color-scheme')).toBe('dark');
    // the page's own element is left alone, both while the app boots and once it is drawn
    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBeNull();
  });
});
