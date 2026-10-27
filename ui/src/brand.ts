import type { TenantConfig } from '@credo/shared';

/** What every screen shows of the company, sign-in included. */
export type Brand = Pick<TenantConfig, 'name' | 'logo'>;
