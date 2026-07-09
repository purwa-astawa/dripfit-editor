import { Circle, Hexagon, Spline, Trash2, Tag } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import type { ShapeType } from '../../lib/schema';

const SHAPE_ICON: Record<ShapeType, typeof Circle> = {
  circle: Circle,
  line: Spline,
  region: Hexagon,
};

export function CalloutList() {
  const callouts = useEditorStore((s) => s.callouts);
  const selectedCalloutId = useEditorStore((s) => s.selectedCalloutId);
  const selectCallout = useEditorStore((s) => s.selectCallout);
  const deleteCallout = useEditorStore((s) => s.deleteCallout);
  const setTool = useEditorStore((s) => s.setTool);

  const handleSelect = (id: string) => {
    setTool('select');
    selectCallout(id);
  };

  return (
    <div data-tour="callouts" className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-800">Callouts</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          {callouts.length}
        </span>
      </div>

      {callouts.length === 0 ? (
        <p className="px-3 py-4 text-sm text-slate-400">
          No callouts yet. Use the Anchor, Pointer Line, or Region tool to add one.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {callouts.map((c) => {
            const active = c.id === selectedCalloutId;
            const Icon = SHAPE_ICON[c.shape.type];
            return (
              <li key={c.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelect(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSelect(c.id);
                  }}
                  className={[
                    'flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm',
                    active
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <Icon
                    size={15}
                    fill={active ? 'currentColor' : 'none'}
                    className={active ? 'text-blue-600' : 'text-slate-400'}
                  />
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <Tag size={12} />
                    {c.products.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCallout(c.id);
                    }}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${c.label}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
