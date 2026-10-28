import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { LIMITS, runSteps, StepError } from './steps';

/** Short waits, so a step that finds nothing fails in a moment. */
const QUICK = { findFor: 120, stillFor: 10, stillAtMost: 100 };
const WORDS = {
  form: { name: 'Name', note: 'Note', department: 'Department', save: 'Save', again: 'Again' },
  archive: { confirm: 'Archive {{name}}', plain: 'Archive' },
  perm: { group: 'Their own permissions', archive: 'Archive a person', allow: 'Allow' },
  missing: { none: 1 },
};

/** A small page of controls, which keeps what a step does in state and shows it. */
function Page({ later = false }: { later?: boolean }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [department, setDepartment] = useState('');
  const [saved, setSaved] = useState('');
  const [allowed, setAllowed] = useState('');
  const [shown, setShown] = useState(!later);
  if (later) setTimeout(() => setShown(true), 60);
  return (
    <div>
      <label>
        Name <span>*</span>
        <input value={name} onChange={(e) => setName(e.currentTarget.value)} />
      </label>
      <label>
        Note
        <textarea value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </label>
      <label>
        Department
        <select value={department} onChange={(e) => setDepartment(e.currentTarget.value)}>
          <option value="">None</option>
          <option value="k">Kho</option>
        </select>
      </label>
      <button onClick={() => setSaved(`${name}|${note}|${department}`)}>Save</button>
      <a href="#x" onClick={() => setSaved('link')}>
        Again
      </a>
      <button onClick={() => setSaved('plain')}>Archive</button>
      <button onClick={() => setSaved('confirm')}>Archive Mai</button>
      <div role="radiogroup" aria-label="Their own permissions: Add a person">
        <label>
          <input type="radio" name="b" onChange={() => setAllowed('add')} />
          Allow
        </label>
      </div>
      <div role="radiogroup" aria-label="Their own permissions: Archive a person">
        <label>
          <input type="radio" name="a" onChange={() => setAllowed('archive')} />
          Allow
        </label>
      </div>
      {shown && <button onClick={() => setSaved('late')}>Late</button>}
      <p data-testid="out">{saved}</p>
      <p data-testid="allowed">{allowed}</p>
    </div>
  );
}

let host: HTMLElement;
const draw = (props: { later?: boolean } = {}) => {
  host = document.body.appendChild(document.createElement('div'));
  const root = createRoot(host);
  act(() => root.render(<Page {...props} />));
  // The steps and the page's own timers run between renders, as in a browser.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  return root;
};
const out = (id = 'out') => host.querySelector(`[data-testid=${id}]`)!.textContent;

afterEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host.remove();
});

describe('a scene’s steps', () => {
  it('type into a field by its words, a required one’s star left out, and into a text area, replacing what is there', async () => {
    draw();

    await runSteps(
      document.body,
      [
        { fill: 'form.name', text: 'Mai Linh' },
        { fill: 'form.note', text: 'Mới vào' },
        { fill: 'form.name', text: 'Mai' },
        { press: 'form.save' },
      ],
      WORDS,
      QUICK,
    );

    expect(out()).toBe('Mai|Mới vào|');
  });

  it('choose the option of a list that reads so, and press a button or a link by its words', async () => {
    draw();

    await runSteps(
      document.body,
      [{ choose: 'form.department', option: 'Kho' }, { press: 'form.save' }],
      WORDS,
      QUICK,
    );
    expect(out()).toBe('||k');

    await runSteps(document.body, [{ press: 'form.again' }], WORDS, QUICK);
    expect(out()).toBe('link');
  });

  it('press the choice of the group named by its label’s words, not the same choice of another', async () => {
    draw();

    await runSteps(document.body, [{ press: 'perm.allow', within: 'perm.archive' }], WORDS, QUICK);

    expect(out('allowed')).toBe('archive');
  });

  it('read a word’s {{name}} from the step, so a button named by a person is found', async () => {
    draw();

    await runSteps(
      document.body,
      [{ press: 'archive.confirm', with: { name: 'Mai' } }],
      WORDS,
      QUICK,
    );
    expect(out()).toBe('confirm');

    // a name the step does not give is left empty, and a plain word has none to fill
    await runSteps(document.body, [{ press: 'archive.plain' }], WORDS, QUICK);
    expect(out()).toBe('plain');
    await expect(
      runSteps(document.body, [{ press: 'archive.confirm' }], WORDS, QUICK),
    ).rejects.toThrow('found no button, link or choice named “Archive ”');
  });

  it('wait for what a step names to show, then do it', async () => {
    draw({ later: true });

    await runSteps(
      document.body,
      [{ press: 'form.late' }],
      { form: { late: 'Late' } },
      {
        ...QUICK,
        findFor: 1000,
      },
    );

    expect(out()).toBe('late');
  });

  it('stop at a step that finds nothing, naming its place and what it was', async () => {
    draw();

    const failed = await runSteps(
      document.body,
      [{ fill: 'form.name', text: 'x' }, { press: 'form.nothing' }],
      { form: { name: 'Name', nothing: 'Nothing here' } },
      QUICK,
    ).catch((error: unknown) => error);

    expect(failed).toBeInstanceOf(StepError);
    expect((failed as Error).message).toBe(
      'step 2 (' +
        JSON.stringify({ press: 'form.nothing' }) +
        '): found no button, link or choice named “Nothing here”',
    );
    await expect(
      runSteps(
        document.body,
        [{ fill: 'form.nothing', text: 'x' }],
        { form: { nothing: 'Zed' } },
        QUICK,
      ),
    ).rejects.toThrow('found no field named “Zed”');
    await expect(
      runSteps(
        document.body,
        [{ choose: 'form.nothing', option: 'x' }],
        { form: { nothing: 'Zed' } },
        QUICK,
      ),
    ).rejects.toThrow('found no list named “Zed”');
  });

  it('stop at words the dictionary does not hold, and at an option a list does not offer', async () => {
    draw();

    await expect(runSteps(document.body, [{ press: 'form.gone' }], WORDS, QUICK)).rejects.toThrow(
      'step 1 ({"press":"form.gone"}): the dictionary holds no words "form.gone"',
    );
    await expect(
      runSteps(document.body, [{ press: 'missing.none' }], WORDS, QUICK),
    ).rejects.toThrow('the dictionary holds no words "missing.none"');
    await expect(
      runSteps(document.body, [{ choose: 'form.department', option: 'Nowhere' }], WORDS, QUICK),
    ).rejects.toThrow('the list holds no option “Nowhere”');
  });

  it('let the page settle before the first step, and give up on a page that never does', async () => {
    const root = draw();
    const began = Date.now();

    // a page that is never still for as long as it is waited on: stillFor never passes
    await runSteps(document.body, [], WORDS, { findFor: 50, stillFor: 1e9, stillAtMost: 60 });

    expect(Date.now() - began).toBeGreaterThanOrEqual(60);
    expect(Date.now() - began).toBeLessThan(5000);
    act(() => root.unmount());
  });

  it('count a change of the page as not still: a button that shows late is met by a page that moved', async () => {
    draw({ later: true });
    const began = Date.now();

    // the late button shows at 60 ms or after and is the page's one change: still for 100 ms
    // after it is no sooner than 100 ms past that
    await runSteps(document.body, [], WORDS, { findFor: 50, stillFor: 100, stillAtMost: 3000 });

    expect(Date.now() - began).toBeGreaterThanOrEqual(150);
  });

  it('hold the waits a build can afford: three seconds for a step, a page still for forty milliseconds', () => {
    expect(LIMITS).toEqual({ findFor: 3000, stillFor: 40, stillAtMost: 3000 });
  });
});
