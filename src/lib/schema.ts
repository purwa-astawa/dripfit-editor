// Canonical map.json schema — must match the Visualizer widget exactly.
// All coordinates are ratios (0–1) of the image's natural width/height.

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

export interface MapDocument {
  mapId: string;
  image: ImageMeta;
  callouts: Callout[];
}

/** Narrow, defensive validation used by loadFromJson. Throws on malformed input. */
export function parseMapDocument(input: unknown): MapDocument {
  if (typeof input !== 'object' || input === null) {
    throw new Error('map.json must be an object');
  }
  const obj = input as Record<string, unknown>;

  if (typeof obj.mapId !== 'string') {
    throw new Error('map.json: "mapId" must be a string');
  }

  const image = obj.image as Record<string, unknown> | undefined;
  if (
    !image ||
    typeof image.url !== 'string' ||
    typeof image.width !== 'number' ||
    typeof image.height !== 'number'
  ) {
    throw new Error('map.json: "image" must have { url, width, height }');
  }

  if (!Array.isArray(obj.callouts)) {
    throw new Error('map.json: "callouts" must be an array');
  }

  const callouts = obj.callouts.map((c, i) => parseCallout(c, i));

  return {
    mapId: obj.mapId,
    image: {
      url: image.url,
      width: image.width,
      height: image.height,
    },
    callouts,
  };
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

  const shape = parseShape(c.shape, index);

  return {
    id: c.id,
    label: c.label,
    shape,
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
