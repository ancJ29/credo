# credo

The new credo app: the same UI and a similar concept, rebuilt as UI → one BFF → c-storage. Piece
by piece, each walked by the human before the next ([the plan](docs/plans/2026-10-27-app-frame.md)).

## Try the mock

Piece 1's screens, every state, as one page that needs no server. Needs Node 26 and pnpm 12.

```sh
pnpm install
pnpm mock
```

Then open `ui/dist/mock/mock.html` in a browser. The page's filters narrow it to a language, a
theme or a width.
