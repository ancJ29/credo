/** Whether the browser is a computer's: not a phone, not a tablet. An Android tablet leaves out
 * "Mobile" but says "Android", and an iPad on iPadOS 13 and later reports itself as a Mac, which
 * a real Mac gives away by having no touch points. */
export function isComputer({
  userAgent,
  platform,
  maxTouchPoints,
}: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'>) {
  const iPadAsMac = platform === 'MacIntel' && maxTouchPoints > 1;
  return !iPadAsMac && !/Android|iPhone|iPad|iPod|Mobi|Tablet/i.test(userAgent);
}
