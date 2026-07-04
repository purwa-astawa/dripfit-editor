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

## Project

Admin tool that places **callouts** (point or region) on a background image and
exports a `map.json` for the Visualizer widget. Coordinates are stored as ratios
(0–1) of the image's natural size. See `README.md` for full details.

## Vocabulary (keep consistent)

- **callout** — a placed annotation (was previously "marker").
- **region** — a polygon-shaped callout (was previously "polygon"); the shape
  `type` value is `"region"`.
- **point** / **circle** — a circular callout; unchanged.
- Pure geometry helpers in `src/lib/geometry.ts` intentionally keep the
  mathematical term "polygon" (they wrap the `geometric` library); that is not the
  domain "region" concept and should stay as-is.
