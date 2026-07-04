import { useEffect, useRef } from 'react';
import { Circle } from 'react-konva';
import Konva from 'konva';
import { BEACON_RING_STOPS, toRgbTriplet } from '../../lib/color';

// Konva-native version of the region Beacon indicator: a single Circle whose
// radial-gradient fill draws the concentric rings, pulsing via Konva.Animation.
// Renders inside the Stage (unlike the DOM `Beacon`), so it moves/zooms with the
// canvas and lands in the correct z-order.

export interface KonvaBeaconProps {
  /** Center, in stage pixels. */
  x: number;
  y: number;
  /** Diameter in pixels. Default 32. */
  size?: number;
  /** Glow color as hex (`#4da6ff`) or an `"r, g, b"` triplet. */
  color?: string;
  /** Gentle breathing pulse. Default true. */
  pulse?: boolean;
}

const DEFAULT_SIZE = 32;
const DEFAULT_COLOR = '210, 210, 210';
const PULSE_PERIOD_MS = 2400;
const PULSE_AMPLITUDE = 0.06; // peak scale = 1 + amplitude (matches the CSS 1.06)

export function KonvaBeacon({
  x,
  y,
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
  pulse = true,
}: KonvaBeaconProps) {
  const ref = useRef<Konva.Circle>(null);
  const radius = size / 2;
  const rgb = toRgbTriplet(color);

  // Konva color stops: flat [offset, cssColor, offset, cssColor, …]. Duplicated
  // offsets give the crisp ring edges, same as the DOM Beacon's gradient.
  const colorStops = BEACON_RING_STOPS.flatMap(([offset, alpha]) => [
    offset,
    `rgba(${rgb}, ${alpha})`,
  ]);

  // A Circle scales about its own center (its x,y), so the pulse grows
  // symmetrically without shifting the indicator.
  useEffect(() => {
    const node = ref.current;
    if (!node || !pulse) return;
    const anim = new Konva.Animation((frame) => {
      if (!frame) return;
      const t = (frame.time % PULSE_PERIOD_MS) / PULSE_PERIOD_MS; // 0..1
      // cosine ease: 1 at the ends, 1 + amplitude at the midpoint.
      const s = 1 + (PULSE_AMPLITUDE / 2) * (1 - Math.cos(2 * Math.PI * t));
      node.scale({ x: s, y: s });
    }, node.getLayer());
    anim.start();
    return () => {
      anim.stop();
      node.scale({ x: 1, y: 1 });
    };
  }, [pulse]);

  return (
    <Circle
      ref={ref}
      x={x}
      y={y}
      radius={radius}
      listening={false}
      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndRadius={radius}
      fillRadialGradientColorStops={colorStops}
    />
  );
}
