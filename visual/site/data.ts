// What the build hands the page, as one object in `window.WALKS_DATA`. `capture.ts` makes it;
// `page.ts` reads it. Types only, so nothing of the build reaches the page's script.
import type { Bilingual, Device, DeviceWidth, Part, Person } from '../src/walks';

export type PageScreen = {
  id: string;
  number: number;
  path: 'main' | 'wrong';
  sentence: Bilingual;
  question: Bilingual;
  /** Twelve hex digits over what the screen draws, and the style rules that match it. */
  version: string;
};

export type PageWalk = {
  id: string;
  person: string;
  part: string;
  title: Bilingual;
  screens: PageScreen[];
};

export type PageData = {
  title: string;
  build: { branch: string; commit: string; changed: boolean; committed: string; built: string };
  devices: { id: Device; label: string; width: DeviceWidth }[];
  people: (Person & { width: DeviceWidth })[];
  parts: Part[];
  walks: PageWalk[];
  /** The app's stylesheet, once. */
  css: string;
  /** Mantine's run-time style blocks, each distinct one once; a capture points at it by number. */
  styles: string[];
  /** `walk/screen/language` to the screen's markup. */
  captures: Record<string, string>;
};

declare global {
  interface Window {
    WALKS_DATA: PageData;
  }
}
