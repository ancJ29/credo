// The name of the device a passkey was added on, read from the browser's header: a system and a
// browser, "iPhone · Safari", or none where either is not known. Kept on a company's passkey alone.

/** The part of a header read: a longer one holds no more to name a device by. */
const READ = 512;

/** The systems, the first that the header holds winning: an iPhone's header also says "Mac OS X". */
const SYSTEMS: readonly [RegExp, string][] = [
  [/iPhone/, 'iPhone'],
  [/iPad/, 'iPad'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Macintosh/, 'Mac'],
  [/Linux/, 'Linux'],
];

/** The browsers, the first that the header holds winning: Edge's and Chrome's headers also say
 * "Safari", and Chrome's on an iPhone says "CriOS". */
const BROWSERS: readonly [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

/** The device a header names ("iPhone · Safari", "Windows · Chrome"), or null for none: no header,
 * or a system or browser the lists do not hold. */
export function deviceNameOf(userAgent: string | undefined): string | null {
  const header = (userAgent ?? '').slice(0, READ);
  const system = SYSTEMS.find(([pattern]) => pattern.test(header));
  const browser = BROWSERS.find(([pattern]) => pattern.test(header));
  return system && browser ? `${system[1]} · ${browser[1]}` : null;
}
