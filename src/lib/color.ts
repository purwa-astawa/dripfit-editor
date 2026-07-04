/** Coerce a hex color (`#4da6ff`, `#4af`) or an `"r, g, b"` triplet to the bare
 *  `"r, g, b"` triplet that `rgba(<triplet>, <alpha>)` needs — used to build the
 *  Beacon's concentric ring opacities from a single color. */
export function toRgbTriplet(color: string): string {
  const c = color.trim();
  if (/^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/.test(c)) return c;

  const hex = c.replace(/^#/, '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : hex;
  if (/^[0-9a-fA-F]{6}$/.test(full)) {
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return c; // last resort — pass through and let CSS decide
}

/** Normalize a `#rgb` / `#rrggbb` (with or without `#`) to a 6-digit lowercase
 *  `#rrggbb`, or null if it isn't a recognizable hex. Used to keep a beacon's
 *  color to what `<input type="color">` can display (and Konva can render). */
export function normalizeHexColor(color: string): string | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return null;
  const h = m[1];
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return `#${full.toLowerCase()}`;
}

/** Ordered `(offset, alpha)` stops for the Beacon's concentric rings. Duplicated
 *  offsets create the crisp ring edges (a hard band, not a smooth fade). */
export const BEACON_RING_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.35, 1],
  [0.35, 0.55],
  [0.58, 0.55],
  [0.58, 0.3],
  [0.78, 0.3],
  [0.78, 0.12],
  [1, 0.12],
];
