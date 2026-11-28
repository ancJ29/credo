# Design sync notes

The design system synced to Claude Design is credo's gallery parts (`ui/src/design-system/`), package shape, no Storybook. Project id is pinned in `config.json`.

## How the build is made

- **There is no package build of the parts, so the sync makes its own:** `bash .design-sync/lib/build.sh` builds `.design-sync/lib/entry.ts` (22 parts from `ui/src/components/`, `CredoProvider`, 11 Mantine parts, 12 Tabler icons) with Vite into `.design-sync/lib/dist/` (gitignored: `index.es.js`, `style.css`, declarations from tsc, `index.d.ts`). `.design-sync/lib/node_modules` is a symlink to `ui/node_modules` (gitignored; recreate with `ln -sfn ../../ui/node_modules .design-sync/lib/node_modules`).
- **Never edit a file under `ui/src/` to make a preview render;** a part that will not render as it ships is a finding here.
- **Converter:** stage the skill's scripts into `.ds-sync/` and `npm i esbuild ts-morph @types/react playwright@1.64.0 --cache <scratch>/npm-cache` there (the home npm cache is root-owned in the sandbox). Then, from the repo root: `node .ds-sync/resync.mjs --config .design-sync/config.json --node-modules ui/node_modules --entry .design-sync/lib/dist/index.es.js --out ./ds-bundle [--remote <saved _ds_sync.json>]`.
- **The browser steps (render check, capture) run in the human's terminal, never in the sandbox:** one script in the credo root's `one-off/`, on the shared test lock, using the browsers in `~/Library/Caches/ms-playwright` (chromium 1248 matches playwright 1.64.0). Never `playwright install`.
- **`extraFonts` is relative to `.design-sync/lib/`:** `../../ui/node_modules/@fontsource-variable/noto-sans/index.css`. The app imports the font in `main.tsx`, not in the parts, so the library never carries it otherwise.
- **`provider`:** `CredoProvider` (Mantine theme + the `--credo-*` variables + the dictionary + a router, kept if one exists) with `language: "en"` for the cards. Without it the parts draw unstyled and say dictionary keys. The `[TOKENS_MISSING]` warning (80 variables) is expected: the theme sets them at runtime.

## Gotchas met

- **A Vite library build inlines CommonJS packages that call `require("react")`** (`use-sync-external-store/shim`); the converter's React is a page global, so the bundle threw at load. `vite.config.ts` aliases it to `react-sync-store.js`. Load `_ds_bundle.js` once in jsdom with `window.React` set before any browser run.
- **The library is built on React 19, a Claude Design canvas runs React 18:** Mantine 9 calls `useEffectEvent`, `use` and `Activity` and renders contexts as their own providers, so every artboard threw "d is not a function". `vite.config.ts` sends every `react` import through `lib/react-compat.js`, which fills those four in on React 18 and is React itself on 19.
- **A second router throws** ("cannot render a Router inside another Router"): `CredoProvider` reuses an existing one.
- **`LogoTile` draws nothing without a logo, by design:** its `NoLogo` preview carries a caption so the cell is not blank.
- **Cards wider than the grid cell are cropped:** `cardMode: column` is set for the parts with fixed-width samples (see `overrides`).

## Known render warns

- `[TOKENS_MISSING]` 80 variables, set at runtime by the theme provider.
- `[RENDER_SKIPPED]` appears only on a run with `--no-render-check` (the sandbox's own validate); the human's run is the real check (46 of 46 clean at the first sync).

## Re-sync risks

- **Parts added to `ui/src/components/`** need a line in `.design-sync/lib/entry.ts` and a preview; the entry is a hand-kept list.
- **The Mantine parts and icons exported are a chosen subset;** a screen using another one needs it added to the entry.
- **Previews hold sample words in English, typed in the file;** the dictionary is not read.
- **Grades are not in git;** the uploaded `_ds_sync.json` is the anchor, so a re-sync fetches it first (`--remote`).
- **Toolchain:** Node 26, pnpm 12, Vite 8, Mantine 9, React 19; the library build is only as reproducible as `pnpm-lock.yaml`.
- **The conventions header (`conventions.md`) names tokens and parts by hand;** re-validate it against a fresh build on every re-sync.
