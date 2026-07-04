# DripFit Editor — Image Mapper Generator

Admin-side tool for placing **callouts** (point or region) on a background image,
attaching compatible product IDs to each, and exporting a `map.json` consumed by the
Visualizer storefront widget.

## Stack

React + Vite + TypeScript · Zustand (state) · Tailwind CSS · react-konva + use-image
(canvas) · geometric (polygon math) · lucide-react (icons) · react-joyride
(onboarding tour).

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (hot reload; --host --open)
npm run build      # typecheck (tsc -b) + production build to dist/
npm run preview    # serve the production build
```

## How it works

1. **Load a background image** by pasting a public image URL in the toolbar and
   pressing **Load** (or Enter). The store tracks `imageStatus`
   (`idle` / `loading` / `error`) while the image resolves, and its natural
   `width`/`height` are captured for ratio conversion. (Local file upload is
   temporarily hidden — the handler is kept commented in `Toolbar.tsx`.)

   Common **share links are auto-rewritten** to their direct-image form
   (`src/lib/imageUrl.ts`), since share pages serve HTML, not image bytes:
   - Dropbox `www.dropbox.com/…?dl=0` → `dl.dropboxusercontent.com/…`
   - Google Drive `drive.google.com/file/d/{id}/view` →
     `drive.google.com/thumbnail?id={id}&sz=w2048`
2. **POI** tool — click on the image to drop a circular callout. Drag it to move;
   drag the white handle to resize its radius.
3. **Region** tool — click to add points (a live dashed preview follows the cursor),
   then **double-click, press Enter, or click Finish** to commit (needs ≥ 3 points).
   Select it to drag individual vertices, or drag the body to move the whole region.
4. **Select** a callout to edit its label and attach products (multi-select, backed
   by `public/mock-fashion-products.json` in local dev).
5. **Export JSON** downloads `map.json`; **Import** loads one back (round-trips).

### Onboarding & responsiveness

- A **guided tour** (`react-joyride`, `src/components/Tour/Tour.tsx`) runs in two
  phases: first it points a new user at the image-URL input, then—once an image is
  loaded—it highlights the **POI** and **Region** tools. Each phase shows once and
  is remembered in `localStorage` (`dripfit-tour-intro-seen`,
  `dripfit-tour-tools-seen`). Clear those keys to replay it.
- On **phone-sized screens** a full-screen advisory
  (`src/components/MobileWarning/MobileWarning.tsx`) recommends a tablet/laptop/desktop
  (with a "Continue anyway" escape). A device is treated as a phone when its shorter
  viewport side is < 600px (catches portrait and landscape; tablets/laptops pass).

## Coordinate convention

Every callout coordinate is stored as a **ratio (0–1)** of the image's natural
dimensions — never raw pixels — so the same `map.json` renders identically at any
size in both this editor and the Visualizer widget. The Konva stage is sized to fit
the viewport; ratios are converted to/from stage pixels on every render and drag via
`src/lib/geometry.ts`. Resizing the window changes only the on-screen render, never
the stored ratios.

## Structure

```
src/
  components/
    Canvas/             # Stage, background image, PointCallout, RegionCallout
    Toolbar/            # tool toggles, image-URL input, import/export
    CalloutList/        # sidebar list of callouts
    CalloutEditPanel/   # label + shape summary + product picker for the selection
    ProductPicker/      # searchable multi-select against the catalog
    Tour/               # two-phase react-joyride onboarding tour
    MobileWarning/      # full-screen "use a bigger screen" advisory on phones
  store/editorStore.ts  # single Zustand store (see spec for shape)
  lib/
    geometry.ts         # ratio<->pixel conversion + geometric wrappers (centroid,
                        #   area, point-in-polygon, self-intersection)
    imageUrl.ts         # rewrite Dropbox/Drive share links to direct-image URLs
    schema.ts           # map.json types + defensive parse/validate
    products.ts         # catalog loader (mock now, Storefront API later)
```

## Data model

`map.json` holds `{ mapId, image: { url, width, height }, callouts: [...] }`. A callout
is `{ id, label, shape, productIds }` where `shape` is one of:

- `{ type: 'circle', cx, cy, r }`
- `{ type: 'region', points: [{ x, y }, …] }`  (≥ 3 points)

All coordinates are ratio units (0–1). **Note:** this schema uses the DripFit
vocabulary (`callouts`, `type: 'region'`); the Visualizer widget must read these keys
or it won't parse the exported `map.json`.

## Caveats & notes

- **Share links must be public.** A Google Drive file must be shared
  "Anyone with the link"; a private file's thumbnail won't load.
- **Drive `uc?export=view` doesn't work** for browser `<img>` loads (it redirects
  through a cookie-gated page — returns bytes to `curl` but is rejected in-page), so
  we use the `thumbnail` endpoint, which hotlinks reliably but **caps at ~2048px**.
  For a very large source image the background is a downscaled copy. Ratios stay
  correct (they're relative to the loaded image), but the Visualizer must load the
  **same** URL that's exported, or the displayed image won't match the coordinates.
- **Exported `image.url` is whatever was loaded** — for a remote URL it's the
  normalized direct link; if local file upload is re-enabled it's a transient
  `blob:`/`data:` URL that won't persist. In the full Shopify app, persist the image
  to a stable CDN URL before export.
- **Canvas taint:** remote images load without `crossOrigin`, so they display fine but
  taint the Konva canvas. Only relevant if pixel export (`toDataURL`) is added later —
  today we only export JSON, so it's a non-issue.

## Dev note

`src/main.tsx` exposes the Zustand store on `window.__editorStore` **only when
`import.meta.env.DEV`** (stripped from production builds) for console debugging.
