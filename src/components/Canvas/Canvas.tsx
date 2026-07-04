import { useEffect, useState } from 'react';
import { Circle, Image as KonvaImage, Layer, Line, Stage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';
import { useEditorStore } from '../../store/editorStore';
import { useElementSize } from '../../lib/useElementSize';
import {
  computeRenderBox,
  pixelToRatio,
  ratioToPixel,
} from '../../lib/geometry';
import { PointCallout } from './PointCallout';
import { RegionCallout } from './RegionCallout';

export function Canvas() {
  const image = useEditorStore((s) => s.image);
  const callouts = useEditorStore((s) => s.callouts);
  const tool = useEditorStore((s) => s.tool);
  const selectedCalloutId = useEditorStore((s) => s.selectedCalloutId);
  const draftRegionPoints = useEditorStore((s) => s.draftRegionPoints);

  const addPointCallout = useEditorStore((s) => s.addPointCallout);
  const addRegionPoint = useEditorStore((s) => s.addRegionPoint);
  const commitDraftRegion = useEditorStore((s) => s.commitDraftRegion);
  const updateCalloutShape = useEditorStore((s) => s.updateCalloutShape);
  const selectCallout = useEditorStore((s) => s.selectCallout);

  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const [img] = useImage(image?.url ?? '');

  // Pressing Enter while drawing a region commits it (same as double-click /
  // "Finish"). Ignored while typing in a text field so it doesn't hijack forms.
  useEffect(() => {
    if (tool !== 'draw-region') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable)
      ) {
        return;
      }
      if (draftRegionPoints.length >= 3) {
        e.preventDefault();
        commitDraftRegion();
        setCursor(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tool, draftRegionPoints.length, commitDraftRegion]);

  if (!image) return null;

  const box = computeRenderBox(image.width, image.height, size.width, size.height);

  const isEmptyTarget = (e: KonvaEventObject<unknown>) =>
    e.target === e.target.getStage() || e.target.name() === 'background';

  const pointer = (e: KonvaEventObject<unknown>) =>
    e.target.getStage()?.getPointerPosition() ?? null;

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    const pos = pointer(e);
    if (!pos) return;

    if (tool === 'place-point') {
      if (!isEmptyTarget(e)) return;
      const r = pixelToRatio(pos.x, pos.y, box);
      addPointCallout(r.x, r.y);
      return;
    }

    if (tool === 'draw-region') {
      if (!isEmptyTarget(e)) return;
      const r = pixelToRatio(pos.x, pos.y, box);
      addRegionPoint(r.x, r.y);
      return;
    }

    // select mode: clicking empty space clears the selection.
    if (isEmptyTarget(e)) selectCallout(null);
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (tool !== 'draw-region') return;
    const pos = pointer(e);
    setCursor(pos);
  };

  const handleDblClick = () => {
    if (tool === 'draw-region' && draftRegionPoints.length >= 3) {
      commitDraftRegion();
      setCursor(null);
    }
  };

  // Draft region preview (pixel coords).
  const draftPixels = draftRegionPoints.map((p) => ratioToPixel(p, box));
  const previewPoints = [
    ...draftPixels.flatMap((p) => [p.x, p.y]),
    ...(cursor && draftPixels.length > 0 ? [cursor.x, cursor.y] : []),
  ];

  const cursorStyle =
    tool === 'place-point' || tool === 'draw-region' ? 'crosshair' : 'default';

  return (
    <div ref={containerRef} className="h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <Stage
          width={size.width}
          height={size.height}
          onClick={handleClick}
          onTap={handleClick}
          onMouseMove={handleMouseMove}
          onDblClick={handleDblClick}
          style={{ cursor: cursorStyle }}
        >
          {/* Static background layer. */}
          <Layer listening={false}>
            {img && (
              <KonvaImage
                image={img}
                x={box.offsetX}
                y={box.offsetY}
                width={box.width}
                height={box.height}
                name="background"
              />
            )}
          </Layer>

          {/* Background hit target (separate so it can receive clicks). */}
          <Layer>
            <KonvaImage
              image={img}
              x={box.offsetX}
              y={box.offsetY}
              width={box.width}
              height={box.height}
              name="background"
              opacity={0}
            />

            {callouts.map((c) =>
              c.shape.type === 'circle' ? (
                <PointCallout
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  shape={c.shape}
                  box={box}
                  selected={c.id === selectedCalloutId && tool === 'select'}
                  onSelect={selectCallout}
                  onChange={updateCalloutShape}
                />
              ) : (
                <RegionCallout
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  shape={c.shape}
                  box={box}
                  selected={c.id === selectedCalloutId && tool === 'select'}
                  draggableWhole={c.id === selectedCalloutId && tool === 'select'}
                  onSelect={selectCallout}
                  onChange={updateCalloutShape}
                />
              ),
            )}

            {/* In-progress region preview. */}
            {tool === 'draw-region' && draftPixels.length > 0 && (
              <>
                <Line
                  points={previewPoints}
                  stroke="#2563eb"
                  strokeWidth={1.5}
                  dash={[6, 4]}
                  listening={false}
                />
                {draftPixels.map((p, i) => (
                  <Circle
                    key={i}
                    x={p.x}
                    y={p.y}
                    radius={4}
                    fill={i === 0 ? '#1d4ed8' : '#ffffff'}
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    listening={false}
                  />
                ))}
              </>
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
