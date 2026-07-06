import { Circle, Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { LineShape, Point } from '../../lib/schema';
import { DEFAULT_LINE_WIDTH, MIN_LINE_LENGTH } from '../../lib/schema';
import {
  clamp01,
  pixelToRatio,
  ratioToPixel,
  type RenderBox,
} from '../../lib/geometry';

interface Props {
  id: string;
  label: string;
  shape: LineShape;
  box: RenderBox;
  selected: boolean;
  draggableWhole: boolean;
  /** Bullet fill — the callout's beacon color, so both ends read as one unit. */
  bulletColor: string;
  onSelect: (id: string) => void;
  onChange: (id: string, shape: LineShape) => void;
}

/** Keep `moved` at least MIN_LINE_LENGTH from `other` so the line never collapses
 *  to a zero-length, un-clickable point. Pushes `moved` outward along the
 *  other→moved direction when it gets too close. */
function clampSeparation(moved: Point, other: Point): Point {
  let dx = moved.x - other.x;
  let dy = moved.y - other.y;
  const d = Math.hypot(dx, dy);
  if (d >= MIN_LINE_LENGTH) return moved;
  // Degenerate (coincident) — nudge along +x so there's a defined direction.
  if (d === 0) {
    dx = 1;
    dy = 0;
  }
  const scale = MIN_LINE_LENGTH / (d || 1);
  return {
    x: clamp01(other.x + dx * scale),
    y: clamp01(other.y + dy * scale),
  };
}

export function LineCallout({
  id,
  label,
  shape,
  box,
  selected,
  draggableWhole,
  bulletColor,
  onSelect,
  onChange,
}: Props) {
  const startPx = ratioToPixel(shape.start, box);
  const endPx = ratioToPixel(shape.end, box);
  const bulletPx = shape.bulletEnd === 'start' ? startPx : endPx;
  const midPx = { x: (startPx.x + endPx.x) / 2, y: (startPx.y + endPx.y) / 2 };

  const stroke = selected ? '#2563eb' : '#3b82f6';

  const handleEndpointDrag =
    (which: 'start' | 'end') => (e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const raw = pixelToRatio(node.x(), node.y(), box);
      const other = which === 'start' ? shape.end : shape.start;
      const next = clampSeparation(raw, other);
      onChange(id, { ...shape, [which]: next });
    };

  const handleGroupDragEnd = (e: KonvaEventObject<DragEvent>) => {
    // Drag events bubble: an endpoint-handle drag also fires this handler with
    // e.target set to the handle. Only treat drags of the group itself as a move.
    if (e.target !== e.currentTarget) return;
    const group = e.target;
    const dx = group.x();
    const dy = group.y();
    if (dx === 0 && dy === 0) return;
    const ratioDx = box.width === 0 ? 0 : dx / box.width;
    const ratioDy = box.height === 0 ? 0 : dy / box.height;
    // Translate the line rigidly: clamp the *shared* delta to what keeps BOTH
    // endpoints in [0,1], so dragging into an edge stops the whole line rather
    // than clamping one endpoint and shearing the segment.
    const minX = Math.min(shape.start.x, shape.end.x);
    const maxX = Math.max(shape.start.x, shape.end.x);
    const minY = Math.min(shape.start.y, shape.end.y);
    const maxY = Math.max(shape.start.y, shape.end.y);
    const clampedDx = Math.max(-minX, Math.min(1 - maxX, ratioDx));
    const clampedDy = Math.max(-minY, Math.min(1 - maxY, ratioDy));
    const shift = (p: Point): Point => ({
      x: p.x + clampedDx,
      y: p.y + clampedDy,
    });
    group.position({ x: 0, y: 0 });
    onChange(id, { ...shape, start: shift(shape.start), end: shift(shape.end) });
  };

  return (
    <Group
      draggable={draggableWhole}
      onDragEnd={handleGroupDragEnd}
      onMouseEnter={(e) => {
        if (!draggableWhole) return;
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'move';
      }}
      onMouseLeave={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = '';
      }}
    >
      {/* Visible segment; a wide hitStrokeWidth makes the thin line clickable. */}
      <Line
        points={[startPx.x, startPx.y, endPx.x, endPx.y]}
        stroke={stroke}
        strokeWidth={selected ? DEFAULT_LINE_WIDTH + 1 : DEFAULT_LINE_WIDTH}
        hitStrokeWidth={16}
        lineCap="round"
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
      />

      {/* Bullet/dot at the non-beacon end (beacon renders separately in preview). */}
      <Circle
        x={bulletPx.x}
        y={bulletPx.y}
        radius={5}
        fill={bulletColor}
        stroke="#ffffff"
        strokeWidth={1.5}
        listening={false}
      />

      {selected && (
        <Text
          x={midPx.x + 6}
          y={midPx.y - 18}
          text={label}
          fontSize={12}
          fill="#1e293b"
          listening={false}
        />
      )}

      {selected &&
        (['start', 'end'] as const).map((which) => {
          const p = which === 'start' ? startPx : endPx;
          return (
            <Circle
              key={which}
              x={p.x}
              y={p.y}
              radius={6}
              fill="#ffffff"
              stroke={stroke}
              strokeWidth={1.5}
              draggable
              onDragMove={handleEndpointDrag(which)}
              onDragEnd={handleEndpointDrag(which)}
              onMouseEnter={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
                e.cancelBubble = true;
              }}
              onMouseLeave={(e) => {
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = '';
              }}
            />
          );
        })}
    </Group>
  );
}
