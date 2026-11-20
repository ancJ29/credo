// The docs site's client module: starts the password box (`visual/site/gate.ts`, one home for both
// pages) with the hash `docusaurus.config.ts` put in every page's head. Docusaurus also loads it
// while rendering the pages' HTML, where there is no window and the box has nothing to draw on.
import { startGate } from '../visual/site/gate';

if (typeof window !== 'undefined') startGate(window.SITE_GATE_HASH);
