import { AlertTriangle, Trash2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { regionWarning } from '../../lib/geometry';
import { ProductPicker } from '../ProductPicker/ProductPicker';

export function CalloutEditPanel() {
  const callout = useEditorStore((s) =>
    s.callouts.find((c) => c.id === s.selectedCalloutId),
  );
  const updateCallout = useEditorStore((s) => s.updateCallout);
  const setCalloutProducts = useEditorStore((s) => s.setCalloutProducts);
  const deleteCallout = useEditorStore((s) => s.deleteCallout);

  if (!callout) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
        Select a callout to edit its label and products.
      </div>
    );
  }

  const warning =
    callout.shape.type === 'region' ? regionWarning(callout.shape) : null;

  const shapeSummary =
    callout.shape.type === 'circle'
      ? `Point · center (${callout.shape.cx.toFixed(3)}, ${callout.shape.cy.toFixed(
          3,
        )}) · r ${callout.shape.r.toFixed(3)}`
      : `Region · ${callout.shape.points.length} vertices`;

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

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Shape</span>
          <p className="rounded-md bg-slate-50 px-2 py-1.5 font-mono text-xs text-slate-600">
            {shapeSummary}
          </p>
          <p className="text-xs text-slate-400">
            Adjust the shape by dragging it on the canvas.
          </p>
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
