import { describe, expect, it, vi } from 'vitest';
import { draw } from '../../../tests/render';
import { DICTIONARIES } from '../../i18n';
import { Notice } from './Notice';

const drawn = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }));
vi.mock('../../components/organisms/PageState', () => ({
  PageState: (props: Record<string, unknown>) => {
    drawn.props.push(props);
    return <p>page state</p>;
  },
}));

describe('Notice', () => {
  it('222 case 9: forbidden and nothing draw through PageState with their title and words', () => {
    drawn.props.length = 0;
    const { rerender } = draw(<Notice kind="forbidden" />);
    expect(drawn.props.at(-1)).toMatchObject({
      state: 'forbidden',
      title: DICTIONARIES.en.forbidden.title,
      children: DICTIONARIES.en.forbidden.text,
    });
    rerender(<Notice kind="nothing" />);
    expect(drawn.props.at(-1)).toMatchObject({
      state: 'nothing',
      title: DICTIONARIES.en.nothing.title,
      children: DICTIONARIES.en.nothing.text,
    });
  });
});
