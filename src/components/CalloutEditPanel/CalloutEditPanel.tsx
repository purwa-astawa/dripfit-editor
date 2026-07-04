import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { regionWarning } from '../../lib/geometry';
import { BEACON_POSITIONS, type BeaconPosition } from '../../lib/schema';
import { ProductPicker } from '../ProductPicker/ProductPicker';

export function CalloutEditPanel() {
  const callout = useEditorStore((s) =>
    s.callouts.find((c) => c.id === s.selectedCalloutId),
  );
  const updateCallout = useEditorStore((s) => s.updateCallout);
  const updateCalloutShape = useEditorStore((s) => s.updateCalloutShape);
  const setCalloutProducts = useEditorStore((s) => s.setCalloutProducts);
  const deleteCallout = useEditorStore((s) => s.deleteCallout);

  if (!callout) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
        Select a callout to edit its label and products.
      </div>
    );
  }

  const shape = callout.shape;
  const warning = shape.type === 'region' ? regionWarning(shape) : null;
  const activeBeacon = shape.type === 'region' ? shape.beacon.position : null;

  const setBeacon = (position: BeaconPosition) => {
    if (shape.type !== 'region') return;
    // updateCalloutShape recomputes the beacon's x,y from the points.
    updateCalloutShape(callout.id, {
      ...shape,
      beacon: { ...shape.beacon, position },
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-800">Edit Callout</h2>
        <button
          type="button"
          onClick={() => deleteCallout(callout.id)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          <Trash2 size={13} /> Delete
        </button>
      </div>

      <div className="flex flex-col gap-4 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Label</span>
          <input
            type="text"
            value={callout.label}
            onChange={(e) =>
              updateCallout(callout.id, { label: e.target.value })
            }
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          {shape.type === 'region' ? (
            <>
              <span className="text-xs font-medium text-slate-500">
                Beacon position
              </span>
              <div className="grid w-fit grid-cols-3 gap-1">
                {BEACON_POSITIONS.map((pos) => {
                  const active = activeBeacon === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setBeacon(pos)}
                      aria-label={pos}
                      aria-pressed={active}
                      title={pos}
                      className={[
                        'flex h-7 w-7 items-center justify-center rounded border',
                        active
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300 bg-white hover:bg-slate-100',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'h-2 w-2 rounded-full',
                          active ? 'bg-white' : 'bg-slate-400',
                        ].join(' ')}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">
                Where the beacon indicator animates in the visualiser. Adjust the
                region by dragging it on the canvas.
              </p>
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-slate-500">Shape</span>
              <p className="rounded-md bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-600">
                {`Point · center (${shape.cx.toFixed(3)}, ${shape.cy.toFixed(
                  3,
                )}) · r ${shape.r.toFixed(3)}`}
              </p>
              <p className="text-xs text-slate-400">
                Adjust the shape by dragging it on the canvas.
              </p>
            </>
          )}
          {warning && (
            <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
              <AlertTriangle size={13} /> {warning}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">
            Products ({callout.products.length})
          </span>
          <ProductPicker
            value={callout.products}
            onChange={(products) => setCalloutProducts(callout.id, products)}
          />
        </div>
      </div>
    </div>
  );
}
