// Canonical map.json schema — must match the Visualizer widget exactly.
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

export const DEFAULT_API_VERSION = '2025-01';

export type ShapeType = 'circle' | 'region';

export interface Point {
  x: number;
  y: number;
}

export type CircleShape = { type: 'circle'; cx: number; cy: number; r: number };
export type RegionShape = { type: 'region'; points: Point[] };
export type Shape = CircleShape | RegionShape;

export interface Callout {
  id: string;
  label: string;
  shape: Shape;
  productIds: string[];
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
  price?: { amount: string; currencyCode: string } | null;
}

export interface MapData {
  mapId: string;
  image: { width: number; height: number };
  callouts: Callout[];
  products: Record<string, ProductSnapshot>;
}

export interface MapDocument {
  posterUrl: string;
  storefrontAPIKey: string;
  shopDomain: string;
  apiVersion: string;
  data: MapData;
}

// --- parsing / validation --------------------------------------------------

/**
 * Defensive validation for loadFromJson. Accepts the current shape and migrates
 * the legacy `{ mapId, image: { url, width, height }, callouts }` shape. Throws
 * on malformed input.
 */
export function parseMapDocument(input: unknown): MapDocument {
  if (typeof input !== 'object' || input === null) {
    throw new Error('map.json must be an object');
  }
  const obj = input as Record<string, unknown>;

  if (obj.data && typeof obj.data === 'object') {
    return parseCurrentShape(obj);
  }
  if (Array.isArray(obj.callouts) && obj.image) {
    return migrateLegacyShape(obj);
  }
  throw new Error(
    'map.json: unrecognized shape (expected a "data" object, or legacy "image" + "callouts")',
  );
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parseCurrentShape(obj: Record<string, unknown>): MapDocument {
  const data = obj.data as Record<string, unknown>;
  const image = data.image as Record<string, unknown> | undefined;
  if (
    !image ||
    typeof image.width !== 'number' ||
    typeof image.height !== 'number'
  ) {
    throw new Error('map.json: data.image must have numeric { width, height }');
  }
  if (!Array.isArray(data.callouts)) {
    throw new Error('map.json: data.callouts must be an array');
  }

  return {
    posterUrl: asString(obj.posterUrl),
    storefrontAPIKey: asString(obj.storefrontAPIKey),
    shopDomain: asString(obj.shopDomain),
    apiVersion: asString(obj.apiVersion) || DEFAULT_API_VERSION,
    data: {
      mapId: asString(data.mapId),
      image: { width: image.width, height: image.height },
      callouts: data.callouts.map((c, i) => parseCallout(c, i)),
      products: parseProducts(data.products),
    },
  };
}

function migrateLegacyShape(obj: Record<string, unknown>): MapDocument {
  const image = obj.image as Record<string, unknown> | undefined;
  if (
    !image ||
    typeof image.url !== 'string' ||
    typeof image.width !== 'number' ||
    typeof image.height !== 'number'
  ) {
    throw new Error(
      'map.json (legacy): "image" must have { url, width, height }',
    );
  }
  const callouts = (obj.callouts as unknown[]).map((c, i) => parseCallout(c, i));
  return {
    posterUrl: image.url,
    storefrontAPIKey: '',
    shopDomain: '',
    apiVersion: DEFAULT_API_VERSION,
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
      price:
        p.price && typeof p.price === 'object'
          ? (p.price as ProductSnapshot['price'])
          : null,
    };
  }
  return out;
}

function parseCallout(input: unknown, index: number): Callout {
  if (typeof input !== 'object' || input === null) {
    throw new Error(`map.json: callouts[${index}] must be an object`);
  }
  const c = input as Record<string, unknown>;

  if (typeof c.id !== 'string') {
    throw new Error(`map.json: callouts[${index}].id must be a string`);
  }
  if (typeof c.label !== 'string') {
    throw new Error(`map.json: callouts[${index}].label must be a string`);
  }
  if (
    !Array.isArray(c.productIds) ||
    !c.productIds.every((p) => typeof p === 'string')
  ) {
    throw new Error(`map.json: callouts[${index}].productIds must be string[]`);
  }

  return {
    id: c.id,
    label: c.label,
    shape: parseShape(c.shape, index),
    productIds: c.productIds as string[],
  };
}

function parseShape(input: unknown, index: number): Shape {
  if (typeof input !== 'object' || input === null) {
    throw new Error(`map.json: callouts[${index}].shape must be an object`);
  }
  const s = input as Record<string, unknown>;

  if (s.type === 'circle') {
    if (
      typeof s.cx !== 'number' ||
      typeof s.cy !== 'number' ||
      typeof s.r !== 'number'
    ) {
      throw new Error(
        `map.json: callouts[${index}].shape (circle) needs numeric cx, cy, r`,
      );
    }
    return { type: 'circle', cx: s.cx, cy: s.cy, r: s.r };
  }

  if (s.type === 'region') {
    if (!Array.isArray(s.points) || s.points.length < 3) {
      throw new Error(
        `map.json: callouts[${index}].shape (region) needs ≥3 points`,
      );
    }
    const points = s.points.map((p, j) => {
      const pt = p as Record<string, unknown>;
      if (typeof pt?.x !== 'number' || typeof pt?.y !== 'number') {
        throw new Error(
          `map.json: callouts[${index}].shape.points[${j}] must be { x, y }`,
        );
      }
      return { x: pt.x, y: pt.y };
    });
    return { type: 'region', points };
  }

  throw new Error(
    `map.json: callouts[${index}].shape.type must be "circle" or "region"`,
  );
}
