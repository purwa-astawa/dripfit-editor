// Thin wrapper around `geometric` plus ratio <-> pixel conversion helpers.
//
// Coordinate convention (must match the Visualizer widget):
//   * Stored coordinates are ratios (0–1) of the image's NATURAL width/height.
//   * The Konva Stage is rendered at whatever pixel size fits the viewport.
//   * Convert ratio -> stage pixels only for rendering, and stage pixels ->
//     ratio on every drag/placement, using the current rendered image box.

import {
  polygonArea,
  polygonCentroid,
  pointInPolygon,
  lineIntersection,
} from 'geometric';
import type { Point, RegionShape } from './schema';

/** Geometry of the rendered background image inside the Konva stage (pixels). */
export interface RenderBox {
  /** Pixel offset of the image's top-left corner inside the stage. */
  offsetX: number;
  offsetY: number;
  /** Rendered pixel size of the image (after "contain" scaling). */
  width: number;
  height: number;
}

/** Convert a ratio point (0–1) to stage pixel coordinates. */
export function ratioToPixel(p: Point, box: RenderBox): Point {
  return {
    x: box.offsetX + p.x * box.width,
    y: box.offsetY + p.y * box.height,
  };
}

/** Convert stage pixel coordinates to a ratio point, clamped to [0, 1]. */
export function pixelToRatio(x: number, y: number, box: RenderBox): Point {
  return {
    x: clamp01((x - box.offsetX) / box.width),
    y: clamp01((y - box.offsetY) / box.height),
  };
}

/** Convert a ratio radius to a pixel radius using the image's rendered width. */
export function ratioRadiusToPixel(r: number, box: RenderBox): number {
  return r * box.width;
}

/** Convert a pixel radius back to a ratio (relative to rendered width). */
export function pixelRadiusToRatio(r: number, box: RenderBox): number {
  return box.width === 0 ? 0 : r / box.width;
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * Compute the "contain" render box for an image of natural size (imgW, imgH)
 * fitted into a stage of size (stageW, stageH), preserving aspect ratio and
 * centering the result.
 */
export function computeRenderBox(
  imgW: number,
  imgH: number,
  stageW: number,
  stageH: number,
): RenderBox {
  if (imgW <= 0 || imgH <= 0) {
    return { offsetX: 0, offsetY: 0, width: stageW, height: stageH };
  }
  const scale = Math.min(stageW / imgW, stageH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return {
    offsetX: (stageW - width) / 2,
    offsetY: (stageH - height) / 2,
    width,
    height,
  };
}

// --- geometric wrappers (operate on [x, y] tuples) ------------------------

type Tuple = [number, number];

function toTuples(points: Point[]): Tuple[] {
  return points.map((p) => [p.x, p.y]);
}

/** Centroid of a polygon, returned as a ratio Point. Falls back to average. */
export function centroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const c = polygonCentroid(toTuples(points));
  if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
    return { x: Number(c[0]), y: Number(c[1]) };
  }
  // Degenerate polygon (e.g. collinear) — average the vertices instead.
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Absolute area of a polygon (ratio units squared). */
export function area(points: Point[]): number {
  if (points.length < 3) return 0;
  return Math.abs(polygonArea(toTuples(points)));
}

/** True if the ratio point lies inside the polygon. */
export function contains(polygon: Point[], point: Point): boolean {
  if (polygon.length < 3) return false;
  return pointInPolygon([point.x, point.y], toTuples(polygon));
}

/**
 * True if the polygon's edges cross each other (a self-intersecting / invalid
 * shape). Non-adjacent edge pairs are tested for intersection. Used to warn,
 * not to block, per spec.
 */
export function isSelfIntersecting(points: Point[]): boolean {
  const n = points.length;
  if (n < 4) return false;

  const edge = (i: number): [Tuple, Tuple] => [
    [points[i].x, points[i].y],
    [points[(i + 1) % n].x, points[(i + 1) % n].y],
  ];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges (they legitimately share a vertex).
      if (j === i) continue;
      if (j === (i + 1) % n) continue;
      if (i === (j + 1) % n) continue;
      // lineIntersection returns the intersection point (segment-bounded) or
      // null when the two edges don't cross.
      if (lineIntersection(edge(i), edge(j)) !== null) {
        return true;
      }
    }
  }
  return false;
}

/** Convenience: validate a region shape, returning a human-readable warning. */
export function regionWarning(shape: RegionShape): string | null {
  if (shape.points.length < 3) return 'Region needs at least 3 points';
  if (isSelfIntersecting(shape.points)) return 'Region edges self-intersect';
  return null;
}
