import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { regionWarning } from '../../lib/geometry';
import { BEACON_POSITIONS, BEACON_SIZES } from '../../lib/schema';
import { ProductPicker } from '../ProductPicker/ProductPicker';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CalloutEditPanel() {
  const callout = useEditorStore((s) =>
    s.callouts.find((c) => c.id === s.selectedCalloutId),
  );
  const updateCallout = useEditorStore((s) => s.updateCallout);
  const updateCalloutBeacon = useEditorStore((s) => s.updateCalloutBeacon);
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
  const beacon = callout.beacon;
  const warning = shape.type === 'region' ? regionWarning(shape) : null;

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

        {warning && (
          <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
            <AlertTriangle size={13} /> {warning}
          </p>
        )}

        {/* Beacon — the animated indicator shown in the visualiser. Position is
            region-only (circles anchor at their centre, lines at the non-bullet
            end); size & color apply to every callout type. */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-slate-500">Beacon</span>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Size</span>
            <div className="flex gap-1">
              {BEACON_SIZES.map((sz) => {
                const active = beacon.size === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => updateCalloutBeacon(callout.id, { size: sz })}
                    aria-pressed={active}
                    className={[
                      'flex-1 rounded border px-2 py-1 text-xs',
                      active
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    {capitalize(sz)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Color</span>
            <input
              type="color"
              value={beacon.color}
              onChange={(e) =>
                updateCalloutBeacon(callout.id, { color: e.target.value })
              }
              aria-label="Beacon color"
              className="h-8 w-16 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
            />
          </div>

          {shape.type === 'line' && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Bullet end</span>
              <div className="flex gap-1">
                {(['start', 'end'] as const).map((end) => {
                  const active = shape.bulletEnd === end;
                  return (
                    <button
                      key={end}
                      type="button"
                      onClick={() =>
                        updateCalloutShape(callout.id, {
                          ...shape,
                          bulletEnd: end,
                        })
                      }
                      aria-pressed={active}
                      className={[
                        'flex-1 rounded border px-2 py-1 text-xs',
                        active
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      {capitalize(end)}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-slate-400">
                The beacon sits at the opposite end.
              </span>
            </div>
          )}

          {shape.type === 'region' && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Position</span>
              <div className="grid w-fit grid-cols-3 gap-1">
                {BEACON_POSITIONS.map((pos) => {
                  const active = beacon.position === pos;
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        updateCalloutBeacon(callout.id, { position: pos })
                      }
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
            </div>
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
