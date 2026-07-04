# AI Agent Instructions — DripFit Editor

## Verification policy

- **Do NOT launch, execute, or verify this app in a browser** (no dev server
  driving, Chrome automation, screenshots, or clicking through the UI) **unless
  the user explicitly asks for it** in the current request.
- By default, verify changes statically instead:
  - `npm run build` — runs `tsc -b` (strict typecheck) + production build.
  - `npm run typecheck` — typecheck only.
  - For logic changes, prefer a small headless script bundled with esbuild over
    driving the UI.
- Only start the dev server (`npm run dev`) or use browser tools when the user
  says so (e.g. "run it", "check in the browser", "take a screenshot").

## Before committing

- **Run the code review before every commit.** When the user asks to commit (or
  before you commit on their behalf), first run the `/code-review` skill on the
  working diff, address (or surface) its findings, then commit. Don't skip this
  even for small changes.
- Still commit/push only when the user asks; the review is a prerequisite to the
  commit, not a trigger to commit on its own.

## Shopify Storefront token — "get access token"

When the user says **"get access token"** (or asks to mint/generate a Shopify
Storefront token), run:

```bash
./scripts/get-storefront-token.sh
```

It reads `SHOPIFY_*` from `.env` (git-ignored; see `.env.example`) and prints a
**public** Storefront access token on stdout. Return that token to the user — it
is a public token, safe to paste into the Configure modal's "Storefront API
access token" field and to embed in the exported `map.json`.

- Prefer running it in the background and reply with just the token.
- If the script errors that `SHOPIFY_*` keys are missing, ask the user to add
  them to `.env` — never guess or hard-code credentials.
- Never print or commit `SHOPIFY_CLIENT_SECRET`. Each run mints a new token
  (max 100 per shop), so reuse the printed one rather than re-running.

## Shared knowledge base — keep the map.json contract in sync

The `map.json` shape is the contract shared with the **Visualizer** (a separate
project). It is documented in the shared knowledge base at
`../shared-knowledge/` (i.e. `DripFitLab/shared-knowledge/`), whose
`map-json-contract.md` mirrors `src/lib/schema.ts`.

- **After committing a change that touches the map.json contract** —
  `src/lib/schema.ts` (`MapDocument`, `CalloutProduct`, `parseMapDocument`,
  accepted legacy shapes) or the exported shape from `editorStore.exportJson` —
  update `../shared-knowledge/map-json-contract.md` to match and add a changelog
  entry there. Update the sibling docs (`shopify-integration.md`,
  `editor-notes.md`, `visualizer-notes.md`) if the change affects them.
- This is a **separate post-commit step**: the shared-knowledge lives outside
  this git repo (`DripFitLab/` is not a repo), so it can't be part of the commit.
  Do it right after the commit so the docs never drift from the shipped contract.

## Project

Admin tool that places **callouts** (point or region) on a background image and
exports a `map.json` for the Visualizer widget. Coordinates are stored as ratios
(0–1) of the image's natural size. See `README.md` for full details.

## Vocabulary (keep consistent)

- **callout** — a placed annotation (was previously "marker").
- **region** — a polygon-shaped callout (was previously "polygon"); the shape
  `type` value is `"region"`.
- **point** / **circle** — a circular callout; unchanged.
- **beacon** — an animated indicator the Visualizer shows for a **region**
  callout. Its `beacon` field is one of 9 anchor positions (`topleft`, `top`,
  `topright`, `left`, `center`, `right`, `bottomleft`, `bottom`, `bottomright`);
  default `center`. Circle callouts have no beacon.
- Pure geometry helpers in `src/lib/geometry.ts` intentionally keep the
  mathematical term "polygon" (they wrap the `geometric` library); that is not the
  domain "region" concept and should stay as-is.
