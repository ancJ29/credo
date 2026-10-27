import { describe, expect, it } from 'vitest';
import * as mock from './index';

describe('the mock’s export', () => {
  it('hands the walks page the screens, the frame that draws one and the stage it draws in', () => {
    expect(Object.keys(mock).sort()).toEqual(['Frame', 'SCREENS', 'Stage']);
  });
});
