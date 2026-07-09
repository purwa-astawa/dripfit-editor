import { useCallback, useEffect, useState } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Stage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import useImage from 'use-image';
import { useEditorStore } from '../../store/editorStore';
import { useElementSize } from '../../lib/useElementSize';
import {
  computeRenderBox,
  pixelToRatio,
  ratioRadiusToPixel,
  ratioToPixel,
} from '../../lib/geometry';
import { BEACON_SIZE_PX, DEFAULT_LINE_WIDTH } from '../../lib/schema';
import { PointCallout } from './PointCallout';
import { RegionCallout } from './RegionCallout';
import { LineCallout } from './LineCallout';
import { KonvaBeacon } from './KonvaBeacon';
import { PreviewLayer } from '../Preview/PreviewLayer';

export function Canvas() {
  const image = useEditorStore((s) => s.image);
  const callouts = useEditorStore((s) => s.callouts);
  const tool = useEditorStore((s) => s.tool);
  const selectedCalloutId = useEditorStore((s) => s.selectedCalloutId);
  const draftRegionPoints = useEditorStore((s) => s.draftRegionPoints);
  const draftLineStart = useEditorStore((s) => s.draftLineStart);
  const beaconPreview = useEditorStore((s) => s.beaconPreview);

  const addPointCallout = useEditorStore((s) => s.addPointCallout);
  const addRegionPoint = useEditorStore((s) => s.addRegionPoint);
  const commitDraftRegion = useEditorStore((s) => s.commitDraftRegion);
  const startLine = useEditorStore((s) => s.startLine);
  const commitLine = useEditorStore((s) => s.commitLine);
  const clearDraftLine = useEditorStore((s) => s.clearDraftLine);
  const updateCalloutShape = useEditorStore((s) => s.updateCalloutShape);
  const selectCallout = useEditorStore((s) => s.selectCallout);

  const [containerRef, size] = useElementSize<HTMLDivElement>();
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // Preview interaction state (ephemeral — not part of the config): which callout's
  // product deck is open, and the product picked per callout (replaces its
  // beacon with that product's card). Cleared when leaving preview mode.
  const [openCalloutId, setOpenCalloutId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!beaconPreview) {
      setOpenCalloutId(null);
      setSelection({});
    }
  }, [beaconPreview]);
  const openDeck = useCallback((id: string) => setOpenCalloutId(id), []);
  const selectProduct = useCallback((calloutId: string, productId: string) => {
    setSelection((s) => ({ ...s, [calloutId]: productId }));
    setOpenCalloutId(null);
  }, []);
  const clearSelection = useCallback((calloutId: string) => {
    setSelection((s) => {
      if (!(calloutId in s)) return s;
      const next = { ...s };
      delete next[calloutId];
      return next;
    });
  }, []);

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
    if (beaconPreview) return; // preview mode: callouts handle their own clicks
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

    if (tool === 'draw-line') {
      if (!isEmptyTarget(e)) {
        // Clicking a shape mid-draw cancels the pending start.
        if (draftLineStart) clearDraftLine();
        return;
      }
      const r = pixelToRatio(pos.x, pos.y, box);
      // First click sets the pending start; second click commits the line.
      if (draftLineStart) {
        commitLine(r.x, r.y);
        setCursor(null);
      } else {
        startLine(r.x, r.y);
      }
      return;
    }

    // select mode: clicking empty space clears the selection.
    if (isEmptyTarget(e)) selectCallout(null);
  };

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (beaconPreview || (tool !== 'draw-region' && tool !== 'draw-line')) return;
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
    tool === 'place-point' || tool === 'draw-region' || tool === 'draw-line'
      ? 'crosshair'
      : 'default';

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {size.width > 0 && size.height > 0 && (
        <>
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

            {/* Editing shapes — hidden while previewing beacons so the canvas
                shows only what the Visualizer would render. */}
            {!beaconPreview &&
              callouts.map((c) => {
                const isSelected =
                  c.id === selectedCalloutId && tool === 'select';
                if (c.shape.type === 'circle') {
                  return (
                    <PointCallout
                      key={c.id}
                      id={c.id}
                      label={c.label}
                      shape={c.shape}
                      box={box}
                      selected={isSelected}
                      onSelect={selectCallout}
                      onChange={updateCalloutShape}
                    />
                  );
                }
                if (c.shape.type === 'line') {
                  return (
                    <LineCallout
                      key={c.id}
                      id={c.id}
                      label={c.label}
                      shape={c.shape}
                      box={box}
                      selected={isSelected}
                      draggableWhole={isSelected}
                      bulletColor={c.beacon.color}
                      onSelect={selectCallout}
                      onChange={updateCalloutShape}
                    />
                  );
                }
                return (
                  <RegionCallout
                    key={c.id}
                    id={c.id}
                    label={c.label}
                    shape={c.shape}
                    box={box}
                    selected={isSelected}
                    draggableWhole={isSelected}
                    onSelect={selectCallout}
                    onChange={updateCalloutShape}
                  />
                );
              })}

            {/* Preview mode: each callout is a transparent (invisible) but
                clickable hit area that opens its product deck. */}
            {beaconPreview &&
              callouts.map((c) => {
                const openThis = () => openDeck(c.id);
                const hover = (e: KonvaEventObject<MouseEvent>) => {
                  const s = e.target.getStage();
                  if (s) s.container().style.cursor = 'pointer';
                };
                const unhover = (e: KonvaEventObject<MouseEvent>) => {
                  const s = e.target.getStage();
                  if (s) s.container().style.cursor = '';
                };
                if (c.shape.type === 'circle') {
                  const ctr = ratioToPixel({ x: c.shape.cx, y: c.shape.cy }, box);
                  // Cover at least the beacon glow so the whole indicator clicks.
                  const r = Math.max(
                    ratioRadiusToPixel(c.shape.r, box),
                    BEACON_SIZE_PX[c.beacon.size] / 2,
                  );
                  return (
                    <Circle
                      key={c.id}
                      x={ctr.x}
                      y={ctr.y}
                      radius={r}
                      fill="#000000"
                      opacity={0}
                      onClick={openThis}
                      onTap={openThis}
                      onMouseEnter={hover}
                      onMouseLeave={unhover}
                    />
                  );
                }
                if (c.shape.type === 'line') {
                  // Both ends clickable: an invisible hit line along the segment
                  // (the beacon end is also covered by its KonvaBeacon) plus an
                  // invisible hit circle over the bullet end.
                  const a = ratioToPixel(c.shape.start, box);
                  const b = ratioToPixel(c.shape.end, box);
                  const bullet = c.shape.bulletEnd === 'start' ? a : b;
                  const bulletR = Math.max(
                    8,
                    BEACON_SIZE_PX[c.beacon.size] / 2,
                  );
                  return (
                    <Group key={c.id}>
                      <Line
                        points={[a.x, a.y, b.x, b.y]}
                        stroke="#000000"
                        strokeWidth={1}
                        hitStrokeWidth={16}
                        opacity={0}
                        onClick={openThis}
                        onTap={openThis}
                        onMouseEnter={hover}
                        onMouseLeave={unhover}
                      />
                      <Circle
                        x={bullet.x}
                        y={bullet.y}
                        radius={bulletR}
                        fill="#000000"
                        opacity={0}
                        onClick={openThis}
                        onTap={openThis}
                        onMouseEnter={hover}
                        onMouseLeave={unhover}
                      />
                    </Group>
                  );
                }
                const pts = c.shape.points
                  .map((p) => ratioToPixel(p, box))
                  .flatMap((p) => [p.x, p.y]);
                return (
                  <Line
                    key={c.id}
                    points={pts}
                    closed
                    fill="#000000"
                    opacity={0}
                    onClick={openThis}
                    onTap={openThis}
                    onMouseEnter={hover}
                    onMouseLeave={unhover}
                  />
                );
              })}

            {/* Beacon indicators, at each callout's resolved beacon coordinate.
                A callout with a selected product shows its card (in PreviewLayer)
                instead, so skip the beacon for those. */}
            {beaconPreview &&
              callouts.map((c) => {
                const isSelected = !!selection[c.id];
                const p = ratioToPixel(c.beacon, box);
                // The beacon is replaced by the selected-product card, so drop it
                // once a product is picked.
                const beacon = isSelected ? null : (
                  <KonvaBeacon
                    x={p.x}
                    y={p.y}
                    size={BEACON_SIZE_PX[c.beacon.size]}
                    color={c.beacon.color}
                    onActivate={() => openDeck(c.id)}
                  />
                );
                // A pointer line also shows its connecting segment + bullet (the
                // editing LineCallout is hidden in preview). These stay visible
                // even after a product is selected so the card still reads as
                // pointing at the bullet. Clicks are handled by the hit areas.
                if (c.shape.type === 'line') {
                  const bullet =
                    c.shape.bulletEnd === 'start' ? c.shape.start : c.shape.end;
                  const bp = ratioToPixel(bullet, box);
                  const sp = ratioToPixel(c.shape.start, box);
                  const ep = ratioToPixel(c.shape.end, box);
                  return (
                    <Group key={`beacon-${c.id}`}>
                      {/* Visible connecting segment (beacon end ↔ bullet end). */}
                      <Line
                        points={[sp.x, sp.y, ep.x, ep.y]}
                        stroke={c.beacon.color}
                        strokeWidth={DEFAULT_LINE_WIDTH}
                        lineCap="round"
                        listening={false}
                      />
                      {beacon}
                      <Circle
                        x={bp.x}
                        y={bp.y}
                        // Match the bullet size the Visualizer/liquid render.
                        radius={
                          Math.max(10, BEACON_SIZE_PX[c.beacon.size] * 0.35) / 2
                        }
                        fill={c.beacon.color}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        listening={false}
                      />
                    </Group>
                  );
                }
                if (isSelected) return null;
                return <Group key={`beacon-${c.id}`}>{beacon}</Group>;
              })}

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

            {/* In-progress pointer-line preview (rubber band from start to cursor). */}
            {tool === 'draw-line' && draftLineStart && (() => {
              const s = ratioToPixel(draftLineStart, box);
              const end = cursor ?? s;
              return (
                <>
                  <Line
                    points={[s.x, s.y, end.x, end.y]}
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                    listening={false}
                  />
                  <Circle
                    x={s.x}
                    y={s.y}
                    radius={4}
                    fill="#1d4ed8"
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    listening={false}
                  />
                </>
              );
            })()}
          </Layer>
        </Stage>

        {/* Preview overlay (HTML above the canvas): selected-product cards +
            the swipeable product deck. */}
        {beaconPreview && (
          <PreviewLayer
            box={box}
            openCalloutId={openCalloutId}
            selection={selection}
            onOpenDeck={openDeck}
            onCloseDeck={() => setOpenCalloutId(null)}
            onSelectProduct={selectProduct}
            onClearSelection={clearSelection}
          />
        )}
        </>
      )}
    </div>
  );
}
