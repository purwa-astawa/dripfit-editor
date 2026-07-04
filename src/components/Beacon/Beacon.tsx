import type { CSSProperties } from 'react';
import { BEACON_RING_STOPS, toRgbTriplet } from '../../lib/color';

// The animated indicator the Visualizer shows for a region callout: concentric
// glowing rings from a single color, fading outward. Size and glow color are
// configurable; the concentric fade is built from opacity variants of one color.
// (Konva canvas rendering uses KonvaBeacon; this is the DOM/CSS variant.)

export interface BeaconProps {
  /** Diameter in pixels. Default 260. */
  size?: number;
  /**
   * Glow color, as a hex string (`#4da6ff`, `#4af`) or an `"r, g, b"` triplet
   * (`"77, 166, 255"`). The concentric rings are opacity variants of this color.
   */
  color?: string;
  /** Gentle breathing pulse animation. Default true. */
  pulse?: boolean;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_SIZE = 260;
const DEFAULT_COLOR = '210, 210, 210';

export function Beacon({
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  pulse = true,
  className,
  style,
}: BeaconProps) {
  const rgb = toRgbTriplet(color);
  const stops = BEACON_RING_STOPS.map(
    ([offset, alpha]) => `rgba(${rgb}, ${alpha}) ${offset * 100}%`,
  ).join(', ');
  const background = `radial-gradient(circle at center, ${stops})`;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        animation: pulse ? 'beacon-pulse 2.4s ease-in-out infinite' : undefined,
        ...style,
      }}
    />
  );
}
