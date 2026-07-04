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
npm run check      # typecheck + ESLint (run this to verify changes)
```

## Shopify products (live vs. mock)

The Product Picker and export pull products from the **live Storefront API** when
a shop domain + **public** Storefront token are set in **Configure**; otherwise
they fall back to the bundled `public/mock-fashion-products.json` (so dev works
with no credentials).

Headless stores can paste a public Storefront token directly. For a
**non-headless** custom / Dev Dashboard app, mint one from the app's client
credentials:

```bash
cp .env.example .env        # then fill the SHOPIFY_* values (git-ignored)
./scripts/get-storefront-token.sh   # prints a public Storefront token
```

Paste the printed token into **Configure → Storefront API access token**. The
`SHOPIFY_CLIENT_SECRET` stays local in `.env` and is never bundled or exported.

## How it works

1. **Configure** (toolbar button) is the single setup panel. It groups:
   - **Background image** — paste a public image URL and press **Load** (or Enter).
     The store tracks `imageStatus` (`idle` / `loading` / `error`) while it resolves,
     and its natural `width`/`height` are captured for ratio conversion. (Local file
     upload is temporarily hidden — the handler is kept commented in `Toolbar.tsx`.)
     Common **share links are auto-rewritten** to their direct-image form
     (`src/lib/imageUrl.ts`), since share pages serve HTML, not image bytes:
     Dropbox `…?dl=0` → `dl.dropboxusercontent.com/…`; Google Drive
     `…/file/d/{id}/view` → `…/thumbnail?id={id}&sz=w2048`.
   - **Storefront connection** — shop domain, Storefront token, API version
     (persisted to `sessionStorage`).
   - **Import map.json** — paste the JSON or pick a file (also accepts the legacy
     shape).

   Pressing **Enter** in the image URL field is a quick "load & go" — it loads and
   closes Configure. Clicking **Load** loads but keeps the modal open so you can keep
   configuring.
2. **POI** tool — click on the image to drop a circular callout. Drag it to move;
   drag the white handle to resize its radius.
3. **Region** tool — click to add points (a live dashed preview follows the cursor),
   then **double-click, press Enter, or click Finish** to commit (needs ≥ 3 points).
   Select it to drag individual vertices, or drag the body to move the whole region.
4. **Select** a callout to edit its label and attach products (multi-select, backed
   by `public/mock-fashion-products.json` in local dev).
5. **Export** (toolbar button) previews the `map.json` and lets you **Copy** it to
   the clipboard or **Download** it.

### Onboarding & responsiveness

- A **guided tour** (`react-joyride`, `src/components/Tour/Tour.tsx`) runs in three
  phases: **intro** points at the **Configure** button; opening Configure runs a
  **configure** walkthrough of its fields (image URL, shop domain, Storefront token,
  import); and once an image is loaded (modal closed) the **tools** phase highlights
  the **POI** and **Region** tools. The tour reads `configureOpen` from the store to
  know when the modal is open, and its tooltips sit at `z-index: 13000` (above the
  `z-[12000]` modals). Each phase shows once and is remembered in `localStorage`
  (`dripfit-tour-intro-seen`, `dripfit-tour-config-seen`, `dripfit-tour-tools-seen`).
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
    ConfigureModal/     # setup group: load image + Shopify settings + import
    ExportModal/        # export the map.json (copy / download, baked snapshot)
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

## Data model (`map.json`)

```jsonc
{
  "posterUrl": "https://…/poster.png",   // the background image
  "storefrontAPIKey": "…",               // public Storefront access token
  "shopDomain": "your-shop.myshopify.com",
  "apiVersion": "2025-01",
  "data": {
    "mapId": "uuid",
    "image": { "width": 2048, "height": 2048 },  // natural dims (url is posterUrl)
    "callouts": [
      { "id": "…", "label": "…",
        "shape": { "type": "region", "points": [{ "x": 0, "y": 0 }] },
        "productIds": ["gid://shopify/Product/1001"] }
    ],
    "products": {                          // baked snapshot (offline fallback)
      "gid://shopify/Product/1001": {
        "title": "…", "handle": "…",
        "featuredImage": "https://…",
        "price": { "amount": "68.00", "currencyCode": "USD" }
      }
    }
  }
}
```

A callout's `shape` is `{ type: 'circle', cx, cy, r }` or
`{ type: 'region', points: [{x,y},…] }` (≥ 3 points). All coordinates are ratio
units (0–1) of the poster's natural size.

- **Product resolution is hybrid:** the storefront Visualizer resolves products
  **live** via the Storefront API (`storefrontAPIKey` + `shopDomain` + `apiVersion`)
  and falls back to the baked `data.products` snapshot. The Storefront token is a
  *public* access token, so embedding it is expected. During authoring the editor's
  product picker still uses `public/mock-fashion-products.json` (real Storefront
  wiring is Phase 2), and `data.products` is baked from that source at export.
- **Import accepts the legacy shape** (`{ mapId, image: { url, … }, callouts }`) and
  migrates it (`image.url` → `posterUrl`), so older exports still load.
- **Vocabulary:** `callouts`, `type: 'region'` — the Visualizer must read these keys.

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
