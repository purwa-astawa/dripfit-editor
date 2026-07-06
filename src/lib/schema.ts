// Canonical dripfit-config schema — must match the Visualizer widget exactly.
// All callout coordinates are ratios (0–1) of the poster's natural width/height.
//
// Shape:
//   {
//     posterUrl, storefrontAPIKey, shopDomain, apiVersion,
//     data: { mapId, image: { width, height }, callouts: [...], products: {...} }
//   }
// The storefront widget resolves products live via the Storefront API
// (storefrontAPIKey + shopDomain + apiVersion) and falls back to the baked
// `data.products` snapshot.

import { normalizeHexColor } from './color';

export const DEFAULT_API_VERSION = '2025-01';

export type ShapeType = 'circle' | 'region';

export interface Point {
  x: number;
  y: number;
}

export type CircleShape = { type: 'circle'; cx: number; cy: number; r: number };

export type RegionShape = { type: 'region'; points: Point[] };
export type Shape = CircleShape | RegionShape;

/** Where the visualiser shows a region's beacon (the animated indicator),
 *  relative to the region's bounding box. Circles always use 'center' (the
 *  beacon sits at the circle centre). */
export const BEACON_POSITIONS = [
  'topleft',
  'top',
  'topright',
  'left',
  'center',
  'right',
  'bottomleft',
  'bottom',
  'bottomright',
] as const;
export type BeaconPosition = (typeof BEACON_POSITIONS)[number];
export const DEFAULT_BEACON: BeaconPosition = 'center';

/** Beacon indicator size — a named step, mapped to pixels via BEACON_SIZE_PX. */
export const BEACON_SIZES = ['standard', 'large', 'larger'] as const;
export type BeaconSize = (typeof BEACON_SIZES)[number];
export const DEFAULT_BEACON_SIZE: BeaconSize = 'standard';
export const BEACON_SIZE_PX: Record<BeaconSize, number> = {
  standard: 32,
  large: 48,
  larger: 64,
};

/** Default beacon glow color (gray). */
export const DEFAULT_BEACON_COLOR = '#9ca3af';

/** The beacon: an animated indicator every callout carries. `position` anchors
 *  it on a region's bounding box (always 'center' for circles); `x,y` is its
 *  resolved ratio coordinate so the visualiser can place it directly. `size` and
 *  `color` control its appearance. */
export interface Beacon {
  position: BeaconPosition;
  x: number;
  y: number;
  size: BeaconSize;
  color: string;
}

/** Resolve a beacon anchor's (ratio) coordinate from a region's bounding box. */
export function beaconPoint(
  points: Point[],
  position: BeaconPosition,
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const table: Record<BeaconPosition, [number, number]> = {
    topleft: [minX, minY],
    top: [midX, minY],
    topright: [maxX, minY],
    left: [minX, midY],
    center: [midX, midY],
    right: [maxX, midY],
    bottomleft: [minX, maxY],
    bottom: [midX, maxY],
    bottomright: [maxX, maxY],
  };
  const [x, y] = table[position];
  return { x, y };
}

/** Resolve a beacon's (ratio) coordinate for any shape: the region's bbox anchor,
 *  or the circle's centre (where `position` is ignored). */
export function resolveBeaconPoint(
  shape: Shape,
  position: BeaconPosition,
): { x: number; y: number } {
  if (shape.type === 'circle') return { x: shape.cx, y: shape.cy };
  return beaconPoint(shape.points, position);
}

export interface BeaconOptions {
  position?: BeaconPosition;
  size?: BeaconSize;
  color?: string;
}

/** Build a Beacon for a shape, resolving its coordinate. Circles are forced to
 *  the 'center' anchor. */
export function makeBeacon(shape: Shape, opts: BeaconOptions = {}): Beacon {
  const position =
    shape.type === 'circle' ? DEFAULT_BEACON : opts.position ?? DEFAULT_BEACON;
  const { x, y } = resolveBeaconPoint(shape, position);
  return {
    position,
    x,
    y,
    size: opts.size ?? DEFAULT_BEACON_SIZE,
    color: opts.color ?? DEFAULT_BEACON_COLOR,
  };
}

/** Recompute a beacon's coordinate after its shape or position changed, keeping
 *  size/color. Circles are pinned to 'center'. */
export function syncBeacon(shape: Shape, beacon: Beacon): Beacon {
  const position = shape.type === 'circle' ? DEFAULT_BEACON : beacon.position;
  const { x, y } = resolveBeaconPoint(shape, position);
  return { ...beacon, position, x, y };
}

/** A product attached to a callout. `image` optionally overrides which image to
 *  show *on this callout* (e.g. the product's fitdrip image); when absent the
 *  widget falls back to `data.products[id].featuredImage`. */
export interface CalloutProduct {
  id: string;
  image?: string;
}

export interface Callout {
  id: string;
  label: string;
  shape: Shape;
  beacon: Beacon;
  products: CalloutProduct[];
}

export interface ImageMeta {
  url: string;
  width: number;
  height: number;
}

/** Baked product snapshot used as the offline fallback in `data.products`. */
export interface ProductSnapshot {
  title: string;
  handle?: string;
  featuredImage?: string | null;
}

export interface DripfitConfigData {
  mapId: string;
  image: { width: number; height: number };
  callouts: Callout[];
  products: Record<string, ProductSnapshot>;
}

/** Global "selected product card" display options — one setting for the whole
 *  config, not per-callout. `shape` is the replacing card's image shape;
 *  `details` is whether its title + View-product link always show (`details`) or
 *  hide behind an ⓘ button (`info`). The Visualizer reads these off the config
 *  (attribute overrides win over the config value). */
export interface DisplayOptions {
  shape: 'square' | 'circle';
  details: 'info' | 'details';
}
export const DEFAULT_CARD_SHAPE: DisplayOptions['shape'] = 'square';
export const DEFAULT_CARD_DETAILS: DisplayOptions['details'] = 'info';

export interface DripfitConfig {
  /** Human-readable name for this config. The Visualizer tags each purchased
   *  product with it (e.g. a cart line-item property) for attribution. */
  title: string;
  posterUrl: string;
  storefrontAPIKey: string;
  shopDomain: string;
  apiVersion: string;
  /** Global card display options (Square/Circle + Always-show/Hide-details). */
  display: DisplayOptions;
  data: DripfitConfigData;
}

// --- parsing / validation --------------------------------------------------

/**
 * Defensive validation for loadFromJson. Accepts the current shape and migrates
 * the legacy `{ mapId, image: { url, width, height }, callouts }` shape. Throws
 * on malformed input.
 */
export function parseDripfitConfig(input: unknown): DripfitConfig {
  if (typeof input !== 'object' || input === null) {
    throw new Error('dripfit-config must be an object');
  }
  const obj = input as Record<string, unknown>;

  if (obj.data && typeof obj.data === 'object') {
    return parseCurrentShape(obj);
  }
  if (Array.isArray(obj.callouts) && obj.image) {
    return migrateLegacyShape(obj);
  }
  throw new Error(
    'dripfit-config: unrecognized shape (expected a "data" object, or legacy "image" + "callouts")',
  );
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null
    ? (v as Record<string, unknown>)
    : null;
}

function isBeaconPosition(v: unknown): v is BeaconPosition {
  return (BEACON_POSITIONS as readonly string[]).includes(v as string);
}

function isBeaconSize(v: unknown): v is BeaconSize {
  return (BEACON_SIZES as readonly string[]).includes(v as string);
}

function parseCurrentShape(obj: Record<string, unknown>): DripfitConfig {
  const data = obj.data as Record<string, unknown>;
  const image = data.image as Record<string, unknown> | undefined;
  if (
    !image ||
    typeof image.width !== 'number' ||
    typeof image.height !== 'number'
  ) {
    throw new Error('dripfit-config: data.image must have numeric { width, height }');
  }
  if (!Array.isArray(data.callouts)) {
    throw new Error('dripfit-config: data.callouts must be an array');
  }

  return {
    title: asString(obj.title),
    posterUrl: asString(obj.posterUrl),
    storefrontAPIKey: asString(obj.storefrontAPIKey),
    shopDomain: asString(obj.shopDomain),
    apiVersion: asString(obj.apiVersion) || DEFAULT_API_VERSION,
    display: parseDisplay(obj.display),
    data: {
      mapId: asString(data.mapId),
      image: { width: image.width, height: image.height },
      callouts: data.callouts.map((c, i) => parseCallout(c, i)),
      products: parseProducts(data.products),
    },
  };
}

/** Parse the global display options, defaulting anything absent/unrecognized. */
function parseDisplay(input: unknown): DisplayOptions {
  const r = asRecord(input);
  return {
    shape: r?.shape === 'circle' ? 'circle' : DEFAULT_CARD_SHAPE,
    details: r?.details === 'details' ? 'details' : DEFAULT_CARD_DETAILS,
  };
}

function migrateLegacyShape(obj: Record<string, unknown>): DripfitConfig {
  const image = obj.image as Record<string, unknown> | undefined;
  if (
    !image ||
    typeof image.url !== 'string' ||
    typeof image.width !== 'number' ||
    typeof image.height !== 'number'
  ) {
    throw new Error(
      'dripfit-config (legacy): "image" must have { url, width, height }',
    );
  }
  const callouts = (obj.callouts as unknown[]).map((c, i) => parseCallout(c, i));
  return {
    title: asString(obj.title),
    posterUrl: image.url,
    storefrontAPIKey: '',
    shopDomain: '',
    apiVersion: DEFAULT_API_VERSION,
    display: parseDisplay(obj.display),
    data: {
      mapId: asString(obj.mapId),
      image: { width: image.width, height: image.height },
      callouts,
      products: {},
    },
  };
}

function parseProducts(input: unknown): Record<string, ProductSnapshot> {
  if (typeof input !== 'object' || input === null) return {};
  const out: Record<string, ProductSnapshot> = {};
  for (const [id, raw] of Object.entries(input as Record<string, unknown>)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const p = raw as Record<string, unknown>;
    if (typeof p.title !== 'string') continue;
    out[id] = {
      title: p.title,
      handle: typeof p.handle === 'string' ? p.handle : undefined,
      featuredImage:
        typeof p.featuredImage === 'string' ? p.featuredImage : null,
    };
  }
  return out;
}

function parseCallout(input: unknown, index: number): Callout {
  if (typeof input !== 'object' || input === null) {
    throw new Error(`dripfit-config: callouts[${index}] must be an object`);
  }
  const c = input as Record<string, unknown>;

  if (typeof c.id !== 'string') {
    throw new Error(`dripfit-config: callouts[${index}].id must be a string`);
  }
  if (typeof c.label !== 'string') {
    throw new Error(`dripfit-config: callouts[${index}].label must be a string`);
  }

  const shape = parseShape(c.shape, index);
  return {
    id: c.id,
    label: c.label,
    shape,
    beacon: parseBeacon(c, shape),
    products: parseCalloutProducts(c, index),
  };
}

/** Parse a callout's beacon. Accepts the current top-level `beacon` object and
 *  migrates the legacy region `shape.beacon` (which may be a bare position
 *  string or `{ position }`). The coordinate is always recomputed from the shape
 *  so it stays consistent with the geometry; circles are pinned to 'center'. */
function parseBeacon(c: Record<string, unknown>, shape: Shape): Beacon {
  const raw = c.beacon ?? asRecord(c.shape)?.beacon;

  let position: BeaconPosition = DEFAULT_BEACON;
  let size: BeaconSize = DEFAULT_BEACON_SIZE;
  let color = DEFAULT_BEACON_COLOR;

  if (typeof raw === 'string') {
    if (isBeaconPosition(raw)) position = raw;
  } else {
    const r = asRecord(raw);
    if (r) {
      if (isBeaconPosition(r.position)) position = r.position;
      if (isBeaconSize(r.size)) size = r.size;
      if (typeof r.color === 'string') {
        // Keep color to a valid hex so the color picker can display it and the
        // canvas gradient can render it; fall back to the default otherwise.
        const hex = normalizeHexColor(r.color);
        if (hex) color = hex;
      }
    }
  }
  return makeBeacon(shape, { position, size, color });
}

/** Accept the current `products: [{ id, image? }]` shape and migrate the legacy
 *  `productIds: string[]` shape. */
function parseCalloutProducts(
  c: Record<string, unknown>,
  index: number,
): CalloutProduct[] {
  if (Array.isArray(c.products)) {
    return c.products.map((raw, j) => {
      const p = raw as Record<string, unknown>;
      if (typeof p?.id !== 'string') {
        throw new Error(
          `dripfit-config: callouts[${index}].products[${j}].id must be a string`,
        );
      }
      return typeof p.image === 'string'
        ? { id: p.id, image: p.image }
        : { id: p.id };
    });
  }
  if (Array.isArray(c.productIds) && c.productIds.every((p) => typeof p === 'string')) {
    return (c.productIds as string[]).map((id) => ({ id }));
  }
  throw new Error(
    `dripfit-config: callouts[${index}] must have products[{id}] (or legacy productIds[])`,
  );
}

function parseShape(input: unknown, index: number): Shape {
  if (typeof input !== 'object' || input === null) {
    throw new Error(`dripfit-config: callouts[${index}].shape must be an object`);
  }
  const s = input as Record<string, unknown>;

  if (s.type === 'circle') {
    if (
      typeof s.cx !== 'number' ||
      typeof s.cy !== 'number' ||
      typeof s.r !== 'number'
    ) {
      throw new Error(
        `dripfit-config: callouts[${index}].shape (circle) needs numeric cx, cy, r`,
      );
    }
    return { type: 'circle', cx: s.cx, cy: s.cy, r: s.r };
  }

  if (s.type === 'region') {
    if (!Array.isArray(s.points) || s.points.length < 3) {
      throw new Error(
        `dripfit-config: callouts[${index}].shape (region) needs ≥3 points`,
      );
    }
    const points = s.points.map((p, j) => {
      const pt = p as Record<string, unknown>;
      if (typeof pt?.x !== 'number' || typeof pt?.y !== 'number') {
        throw new Error(
          `dripfit-config: callouts[${index}].shape.points[${j}] must be { x, y }`,
        );
      }
      return { x: pt.x, y: pt.y };
    });
    return { type: 'region', points };
  }

  throw new Error(
    `dripfit-config: callouts[${index}].shape.type must be "circle" or "region"`,
  );
}
