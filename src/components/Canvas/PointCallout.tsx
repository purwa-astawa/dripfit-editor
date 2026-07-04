import { Circle, Group, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { CircleShape } from '../../lib/schema';
import {
  pixelRadiusToRatio,
  pixelToRatio,
  ratioRadiusToPixel,
  ratioToPixel,
  type RenderBox,
} from '../../lib/geometry';

interface Props {
  id: string;
  label: string;
  shape: CircleShape;
  box: RenderBox;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, shape: CircleShape) => void;
}

const MIN_RADIUS_RATIO = 0.005;

export function PointCallout({
  id,
  label,
  shape,
  box,
  selected,
  onSelect,
  onChange,
}: Props) {
  const center = ratioToPixel({ x: shape.cx, y: shape.cy }, box);
  const radiusPx = Math.max(4, ratioRadiusToPixel(shape.r, box));

  const handleDrag = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const ratio = pixelToRatio(node.x(), node.y(), box);
    onChange(id, { ...shape, cx: ratio.x, cy: ratio.y });
  };

  const handleRadiusDrag = (e: KonvaEventObject<DragEvent>) => {
    const handle = e.target;
    // Keep the handle on the horizontal axis; distance from center = radius.
    handle.y(center.y);
    const dx = Math.abs(handle.x() - center.x);
    const r = Math.max(MIN_RADIUS_RATIO, pixelRadiusToRatio(dx, box));
    onChange(id, { ...shape, r });
  };

  return (
    <Group>
      <Circle
        x={center.x}
        y={center.y}
        radius={radiusPx}
        fill={selected ? 'rgba(37,99,235,0.35)' : 'rgba(37,99,235,0.2)'}
        stroke={selected ? '#2563eb' : '#3b82f6'}
        strokeWidth={selected ? 2 : 1.5}
        draggable
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
        onDragStart={() => onSelect(id)}
        onDragMove={handleDrag}
        onDragEnd={handleDrag}
        onMouseEnter={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = 'move';
        }}
        onMouseLeave={(e) => {
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = '';
        }}
      />
      {/* Center dot for precise placement feedback. */}
      <Circle x={center.x} y={center.y} radius={2.5} fill="#1d4ed8" listening={false} />

      {selected && (
        <>
          {/* Radius handle. */}
          <Circle
            x={center.x + radiusPx}
            y={center.y}
            radius={5}
            fill="#ffffff"
            stroke="#2563eb"
            strokeWidth={1.5}
            draggable
            onDragMove={handleRadiusDrag}
            onDragEnd={handleRadiusDrag}
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'ew-resize';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = '';
            }}
          />
          <Text
            x={center.x + 8}
            y={center.y - radiusPx - 18}
            text={label}
            fontSize={12}
            fill="#1e293b"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}
