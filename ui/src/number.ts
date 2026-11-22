/** A number as the language writes it, the same everywhere: `1.250.000` in Vietnamese, `1,250,000`
 * in English. The language's own code is the locale, as the screens wrote it before. */
export function numberOf(value: number, language: string) {
  return new Intl.NumberFormat(language).format(value);
}

/** A price in đồng without its unit, as a table's cell writes it: a number of the language, so a
 * price and a quantity group their thousands alike. `useMoney` adds the unit. */
export function priceOf(amount: number, language: string) {
  return numberOf(amount, language);
}

/** The thousands mark and the decimal mark the language writes a number with. */
export function marksOf(language: string) {
  const parts = new Intl.NumberFormat(language).formatToParts(1000.5);
  const mark = (type: string) =>
    parts
      .filter((part) => part.type === type)
      .map((part) => part.value)
      .join('');
  return { group: mark('group'), decimal: mark('decimal') };
}
