import { useRef, useState } from 'react';
import {
  MousePointer2,
  MapPin,
  Hexagon,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
  Download,
  Upload,
  Check,
  X,
} from 'lucide-react';
import { useEditorStore, type Tool } from '../../store/editorStore';

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'place-point', label: 'Point', icon: MapPin },
  { id: 'draw-region', label: 'Region', icon: Hexagon },
];

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const image = useEditorStore((s) => s.image);
  const imageStatus = useEditorStore((s) => s.imageStatus);
  const imageError = useEditorStore((s) => s.imageError);
  const loadImageFromUrl = useEditorStore((s) => s.loadImageFromUrl);
  const draftRegionPoints = useEditorStore((s) => s.draftRegionPoints);
  const commitDraftRegion = useEditorStore((s) => s.commitDraftRegion);
  const clearDraftRegion = useEditorStore((s) => s.clearDraftRegion);
  const exportJson = useEditorStore((s) => s.exportJson);
  const loadFromJson = useEditorStore((s) => s.loadFromJson);

  const [urlInput, setUrlInput] = useState('');
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const loading = imageStatus === 'loading';

  const submitUrl = () => {
    if (!urlInput.trim() || loading) return;
    loadImageFromUrl(urlInput);
  };

  // --- File upload (hidden for now — kept for when local uploads return) ---
  // const imageInputRef = useRef<HTMLInputElement>(null);
  // const setImage = useEditorStore((s) => s.setImage);
  // const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = e.target.files?.[0];
  //   e.target.value = ''; // allow re-selecting the same file
  //   if (!file) return;
  //   const url = URL.createObjectURL(file);
  //   const probe = new Image();
  //   probe.onload = () => setImage(url, probe.naturalWidth, probe.naturalHeight);
  //   probe.onerror = () => {
  //     URL.revokeObjectURL(url);
  //     alert('Could not load that image file.');
  //   };
  //   probe.src = url;
  // };

  const handleExport = () => {
    const doc = exportJson();
    const blob = new Blob([JSON.stringify(doc, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadFromJson(JSON.parse(String(reader.result)));
      } catch (err) {
        alert(`Invalid map.json: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  };

  const inRegion = tool === 'draw-region';
  const canFinish = draftRegionPoints.length >= 3;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <span className="mr-2 text-sm font-semibold text-slate-800">
        Image Mapper
      </span>

      {/* Tool toggles */}
      <div className="flex overflow-hidden rounded-md border border-slate-300">
        {TOOLS.map(({ id, label, icon: Icon }) => {
          const active = tool === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!image}
              onClick={() => setTool(id)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 text-sm transition',
                'disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              <Icon size={15} />
              {label}
            </button>
          );
        })}
      </div>

      {inRegion && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">
            {draftRegionPoints.length} pt
            {draftRegionPoints.length === 1 ? '' : 's'} · dbl-click to finish
          </span>
          <button
            type="button"
            disabled={!canFinish}
            onClick={() => commitDraftRegion()}
            className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-40"
          >
            <Check size={13} /> Finish
          </button>
          <button
            type="button"
            disabled={draftRegionPoints.length === 0}
            onClick={clearDraftRegion}
            className="flex items-center gap-1 rounded bg-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-300 disabled:opacity-40"
          >
            <X size={13} /> Cancel
          </button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Public image URL input */}
        <div className="flex items-center">
          <div className="relative">
            <LinkIcon
              size={14}
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitUrl();
              }}
              placeholder="Public image URL…"
              disabled={loading}
              className="w-64 rounded-l-md border border-slate-300 py-1.5 pl-7 pr-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
            />
          </div>
          <button
            type="button"
            onClick={submitUrl}
            disabled={loading || !urlInput.trim()}
            className="flex items-center gap-1.5 rounded-r-md border border-l-0 border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Loading…
              </>
            ) : (
              <>Load</>
            )}
          </button>
        </div>

        {imageStatus === 'error' && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <AlertCircle size={13} /> {imageError}
          </span>
        )}

        <button
          type="button"
          onClick={() => jsonInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          <Upload size={15} />
          Import
        </button>
        <button
          type="button"
          disabled={!image}
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Download size={15} />
          Export JSON
        </button>
      </div>

      <input
        ref={jsonInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImportFile}
      />
    </div>
  );
}
