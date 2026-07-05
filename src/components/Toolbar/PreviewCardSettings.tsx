import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  useEditorStore,
  type ProductCardMode,
  type ProductCardShape,
} from '../../store/editorStore';

/** A labeled row of segmented option buttons. */
function OptionRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex gap-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={[
                'flex-1 rounded border px-2 py-1 text-xs',
                active
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Toolbar dropdown for the global "selected product card" preview settings:
 * image shape (square/circle) and details display (always show / hide).
 */
export function PreviewCardSettings() {
  const shape = useEditorStore((s) => s.productCardShape);
  const setShape = useEditorStore((s) => s.setProductCardShape);
  const mode = useEditorStore((s) => s.productCardMode);
  const setMode = useEditorStore((s) => s.setProductCardMode);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the panel on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
      >
        Selected product card
        <ChevronDown
          size={14}
          className={open ? 'rotate-180 transition' : 'transition'}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[11000] mt-1 flex w-56 flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <OptionRow
            label="Shape"
            value={shape}
            onChange={(v) => setShape(v as ProductCardShape)}
            options={[
              { value: 'square', label: 'Square' },
              { value: 'circle', label: 'Circle' },
            ]}
          />
          <OptionRow
            label="Details"
            value={mode}
            onChange={(v) => setMode(v as ProductCardMode)}
            options={[
              { value: 'details', label: 'Always show' },
              { value: 'info', label: 'Hide details' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
