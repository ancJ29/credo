import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';
import { MAP_PATH, mapSidebar } from './map';

// The sidebar is drawn from the docs map: the map first, then its branches in order.
const sidebars: SidebarsConfig = mapSidebar(
  readFileSync(resolve(__dirname, '..', MAP_PATH), 'utf8'),
  (path) => existsSync(resolve(__dirname, '..', path)),
);

export default sidebars;
