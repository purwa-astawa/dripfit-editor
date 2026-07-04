# DripFit Editor — Image Mapper Generator

Admin-side tool for placing point/polygon markers on a background image, attaching
compatible product IDs to each, and exporting a `map.json` consumed by the
Visualizer storefront widget.

## Stack

React + Vite + TypeScript · Zustand (state) · Tailwind CSS · react-konva + use-image
(canvas) · geometric (polygon math) · lucide-react (icons).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck (tsc -b) + production build to dist/
npm run preview    # serve the production build
```

## How it works

1. **Upload an image** from the toolbar. Its natural `width`/`height` are captured
   for ratio conversion.
2. **Place Point** — click on the image to drop a circle marker. Drag it to move;
   drag the white handle to resize its radius.
3. **Draw Polygon** — click to add points (live dashed preview follows the cursor),
   then double-click or press **Finish** to commit (needs ≥ 3 points). Select it to
   drag individual vertices, or drag the body to move the whole shape.
4. **Select** a marker to edit its label and attach products (multi-select, backed
   by `public/mock-fashion-products.json` in local dev).
5. **Export JSON** downloads `map.json`; **Import** loads one back (round-trips).

## Coordinate convention

Every marker coordinate is stored as a **ratio (0–1)** of the image's natural
dimensions — never raw pixels — so the same `map.json` renders identically at any
size in both this editor and the Visualizer widget. The Konva stage is sized to fit
the viewport; ratios are converted to/from stage pixels on every render and drag via
`src/lib/geometry.ts`. Resizing the window changes only the on-screen render, never
the stored ratios.

## Structure

```
src/
  components/
    Canvas/           # Stage, background image, PointMarker, PolygonMarker
    Toolbar/          # tool toggles, image upload, import/export
    MarkerList/       # sidebar list of markers
    MarkerEditPanel/  # label + shape summary + product picker for the selection
    ProductPicker/    # searchable multi-select against the catalog
  store/editorStore.ts  # single Zustand store (see spec for shape)
  lib/
    geometry.ts       # ratio<->pixel conversion + geometric wrappers (centroid,
                      #   area, point-in-polygon, self-intersection)
    schema.ts         # map.json types + defensive parse/validate
    products.ts       # catalog loader (mock now, Storefront API later)
```

## Data model

See the exported `map.json` schema in the project spec. Circles are stored as
`{ type: 'circle', cx, cy, r }`, polygons as `{ type: 'polygon', points: [{x,y}] }`,
all in ratio units.

## Dev note

`src/main.tsx` exposes the Zustand store on `window.__editorStore` **only when
`import.meta.env.DEV`** (stripped from production builds) for console debugging.
