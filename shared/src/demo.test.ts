import { describe, expect, it } from 'vitest';
import { tenantConfigSchema } from './config';
import { DEMO_CONFIG } from './demo';

describe('the demo data set', () => {
  it('The demo company is a company’s settings the BFF would take, logo included', () => {
    expect(tenantConfigSchema.parse(DEMO_CONFIG)).toEqual(DEMO_CONFIG);
  });
});
