import type { TenantConfig } from './config';

const logo = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="10" fill="#2f7d6d"/><path d="M13 33V15l11 12 11-12v18" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/></svg>',
)}`;

/** An invented company, never a client's. Fixed, so every walk starts from the same screens. The
 * one data set that seeds both the fake `Api` and the stack's generator. */
export const DEMO_CONFIG: TenantConfig = {
  name: 'Minh Phát',
  logo,
  colour: '#2f7d6d',
  languages: ['vi', 'en'],
  defaultLanguage: 'vi',
};

export const DEMO_CODE = 'demo';
/** The name the demo company's root signs in with: the BFF's own root name. */
export const DEMO_ROOT_NAME = 'root';
export const OPERATOR_NAME = 'operator';
