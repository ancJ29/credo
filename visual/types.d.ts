// Two packages the build reads whose typings do not resolve here: dom-accessibility-api's
// `exports` map names none, and jsdom ships none (its `@types` package is not in the catalog).
// Only what `src/` calls is declared.

declare module 'dom-accessibility-api' {
  export function computeAccessibleName(element: Element): string;
  export function getRole(element: Element): string | null;
}

declare module 'jsdom' {
  export class JSDOM {
    constructor(
      html?: string,
      options?: {
        url?: string;
        pretendToBeVisual?: boolean;
        runScripts?: 'outside-only' | 'dangerously';
      },
    );
    readonly window: object;
  }
}
