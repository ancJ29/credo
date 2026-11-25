import { Title } from '@mantine/core';
import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { BrandName } from './BrandName';

const NAME = 'Minh Phát';

/** The name drawn as the first heading, as the header and the card draw it. */
const heading = (formatted: string, colours?: boolean) =>
  draw(
    <Title order={1}>
      <BrandName name={NAME} formatted={formatted} colours={colours} />
    </Title>,
  );

/** What the drawing holds: the markup of the part a person sees. */
const shown = (container: HTMLElement) => container.querySelector('[aria-hidden="true"]')!;

afterEach(() => vi.restoreAllMocks());

describe('BrandName', () => {
  it('3: draws the plain name as bare text where no formatted name is set, or none is left after cleaning', () => {
    for (const formatted of [undefined, '', '   ', '<br>', '<script>x</script>', '<b> </b>']) {
      const { container, unmount } = draw(
        <Title order={1}>
          <BrandName name={NAME} formatted={formatted} />
        </Title>,
      );
      expect(container.querySelector('h1')!.innerHTML).toBe(NAME);
      unmount();
    }
  });

  it('5: a heading holding a formatted name is read, and found, by the plain name', () => {
    const { container } = heading('<b>Minh</b><br><span style="color:#1d3557">Phát</span>');

    expect(screen.getByRole('heading', { level: 1, name: NAME })).toBeDefined();
    expect(shown(container).textContent).toBe('MinhPhát');
    expect(screen.getAllByText(NAME)).toHaveLength(1);
  });

  it('6: keeps a bold part, a span’s one colour and a line break, as elements it builds', () => {
    const { container } = heading(
      'a <b>b</b><strong>s</strong><br><span style="color: #1D3557;">c</span>',
    );

    expect(shown(container).innerHTML).toBe(
      'a <b>b</b><strong>s</strong><br><span style="color: rgb(29, 53, 87);">c</span>',
    );
  });

  it('6: unwraps every other element to its text, to any depth', () => {
    const { container } = heading(
      '<div>one <i>two</i> <a href="https://x.test">three</a><p>four <u>five</u></p></div><span>six</span>',
    );

    expect(shown(container).innerHTML).toBe('one two threefour fivesix');
  });

  it('6: drops script, style, template and comments with their text', () => {
    const { container } = heading(
      'keep<script>alert(1)</script><style>b{}</style><template><b>t</b></template><!-- c -->me',
    );

    expect(shown(container).innerHTML).toBe('keepme');
  });

  it('7: no attribute survives but the span’s colour', () => {
    const { container } = heading(
      [
        '<b onclick="alert(1)" class="x" style="color:red">a</b>',
        '<strong id="i" onmouseover="alert(1)">b</strong>',
        '<br class="y">',
        '<span onclick="alert(1)" class="z" style="color:#112233">c</span>',
      ].join(''),
    );

    expect(shown(container).innerHTML).toBe(
      '<b>a</b><strong>b</strong><br><span style="color: rgb(17, 34, 51);">c</span>',
    );
  });

  it('7: a span with two declarations, a colour by name, a short or long hex, an expression or a url( is unwrapped', () => {
    const { container } = heading(
      [
        '<span style="color:#112233;font-size:99px">a</span>',
        '<span style="color:red">b</span>',
        '<span style="color:#123">c</span>',
        '<span style="color:#1122334">d</span>',
        '<span style="color:url(https://x.test/a)">e</span>',
        '<span style="background:url(https://x.test/a)">f</span>',
        '<span style="color:rgb(1,2,3)">g</span>',
        '<span style="">h</span>',
        '<span>i</span>',
      ].join(''),
    );

    expect(shown(container).innerHTML).toBe('abcdefghi');
  });

  it('7: an img, svg or iframe draws no element, and nothing is run', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { container } = heading(
      [
        '<img src="x" onerror="window.alert(1)">',
        '<svg onload="window.alert(2)"><script>window.alert(3)</script><text>s</text></svg>',
        '<iframe src="https://x.test"></iframe>',
        '<b>ok</b>',
      ].join(''),
    );

    expect(container.querySelector('img, svg, iframe, script')).toBeNull();
    expect(shown(container).innerHTML).toBe('s<b>ok</b>');
    expect(alert).not.toHaveBeenCalled();
  });

  it('12: where the colours give way, the span goes and the bold part and the break stay', () => {
    const { container } = heading('<b>Minh</b><br><span style="color:#1d3557">Phát</span>', false);

    expect(shown(container).innerHTML).toBe('<b>Minh</b><br>Phát');
  });
});
