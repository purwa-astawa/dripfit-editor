import { Circle, Group, Line, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { RegionShape, Point } from '../../lib/schema';
import {
  centroid,
  clamp01,
  isSelfIntersecting,
  pixelToRatio,
  ratioToPixel,
  type RenderBox,
} from '../../lib/geometry';

interface Props {
  id: string;
  label: string;
  shape: RegionShape;
  box: RenderBox;
  selected: boolean;
  draggableWhole: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, shape: RegionShape) => void;
}

export function RegionCallout({
  id,
  label,
  shape,
  box,
  selected,
  draggableWhole,
  onSelect,
  onChange,
}: Props) {
  const pixels = shape.points.map((p) => ratioToPixel(p, box));
  const flat = pixels.flatMap((p) => [p.x, p.y]);
  const invalid = isSelfIntersecting(shape.points);
  const center = ratioToPixel(centroid(shape.points), box);

  const stroke = invalid ? '#dc2626' : selected ? '#2563eb' : '#3b82f6';

  const handleVertexDrag =
    (index: number) => (e: KonvaEventObject<DragEvent>) => {
      const node = e.target;
      const ratio = pixelToRatio(node.x(), node.y(), box);
      const points = shape.points.map((p, i) => (i === index ? ratio : p));
      onChange(id, { ...shape, points });
    };

  const handleGroupDragEnd = (e: KonvaEventObject<DragEvent>) => {
    // Konva drag events bubble: a vertex-circle drag also fires this handler
    // with e.target set to the circle. Only handle drags of the group itself,
    // otherwise we'd treat a vertex's absolute position as a group offset.
    if (e.target !== e.currentTarget) return;
    const group = e.target;
    const dx = group.x();
    const dy = group.y();
    if (dx === 0 && dy === 0) return;
    const ratioDx = box.width === 0 ? 0 : dx / box.width;
    const ratioDy = box.height === 0 ? 0 : dy / box.height;
    const points: Point[] = shape.points.map((p) => ({
      x: clamp01(p.x + ratioDx),
      y: clamp01(p.y + ratioDy),
    }));
    // Reset the group transform now that the offset is baked into the points.
    group.position({ x: 0, y: 0 });
    onChange(id, { ...shape, points });
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
      <Line
        points={flat}
        closed
        fill={
          selected ? 'rgba(37,99,235,0.18)' : 'rgba(59,130,246,0.12)'
        }
        stroke={stroke}
        strokeWidth={selected ? 2 : 1.5}
        onClick={() => onSelect(id)}
        onTap={() => onSelect(id)}
      />

      {selected && (
        <Text
          x={center.x + 6}
          y={center.y - 6}
          text={label}
          fontSize={12}
          fill="#1e293b"
          listening={false}
        />
      )}

      {selected &&
        pixels.map((p, i) => (
          <Circle
            key={i}
            x={p.x}
            y={p.y}
            radius={6}
            fill="#ffffff"
            stroke={stroke}
            strokeWidth={1.5}
            draggable
            onDragMove={handleVertexDrag(i)}
            onDragEnd={handleVertexDrag(i)}
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
        ))}
    </Group>
  );
}
