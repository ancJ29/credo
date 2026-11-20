// The one script of the walks page: the page, and the password box in front of it. `capture.ts`
// bundles it, with the hash the build put in `window.SITE_GATE_HASH`; only imports and one call.
import './page';
import { startGate } from './gate';

startGate(window.SITE_GATE_HASH);
