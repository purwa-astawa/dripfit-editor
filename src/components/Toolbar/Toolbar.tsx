import { useState } from 'react';
import {
  MousePointer2,
  MapPin,
  Hexagon,
  SlidersHorizontal,
  Download,
  Check,
  X,
  Eye,
  EyeOff,
  LogOut,
} from 'lucide-react';
import { useEditorStore, type Tool } from '../../store/editorStore';
import { ConfigureModal } from '../ConfigureModal/ConfigureModal';
import { ExportModal } from '../ExportModal/ExportModal';
import { PreviewCardSettings } from './PreviewCardSettings';
import { lock, getEmail, DEV_BYPASS } from '../../lib/auth';

const TOOLS: { id: Tool; label: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'place-point', label: 'POI', icon: MapPin },
  { id: 'draw-region', label: 'Region', icon: Hexagon },
];

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const image = useEditorStore((s) => s.image);
  const draftRegionPoints = useEditorStore((s) => s.draftRegionPoints);
  const commitDraftRegion = useEditorStore((s) => s.commitDraftRegion);
  const clearDraftRegion = useEditorStore((s) => s.clearDraftRegion);
  const configureOpen = useEditorStore((s) => s.configureOpen);
  const setConfigureOpen = useEditorStore((s) => s.setConfigureOpen);
  const beaconPreview = useEditorStore((s) => s.beaconPreview);
  const setBeaconPreview = useEditorStore((s) => s.setBeaconPreview);

  const [exportOpen, setExportOpen] = useState(false);

  // Licensed session (skipped in dev bypass). Signing out clears the unlock flag
  // and reloads, which re-renders the LicenseGate.
  const email = getEmail();
  const signOut = () => {
    lock();
    window.location.reload();
  };

  const inRegion = tool === 'draw-region';
  const canFinish = draftRegionPoints.length >= 3;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
      <img src="/logo.png" alt="DripFit Lab by GARUSIN" className="mr-2 h-10 w-auto" />

      {/* Tool toggles */}
      <div
        data-tour="tools"
        className="flex overflow-hidden rounded-md border border-slate-300"
      >
        {TOOLS.map(({ id, label, icon: Icon }) => {
          const active = tool === id;
          return (
            <button
              key={id}
              type="button"
              data-tour={`tool-${id}`}
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

      {/* Global preview settings for the selected-product card. */}
      <PreviewCardSettings />

      {/* Preview beacons: hides the editing shapes and shows only the beacons,
          as the Visualizer would render them. */}
      <button
        type="button"
        disabled={!image}
        onClick={() => setBeaconPreview(!beaconPreview)}
        aria-pressed={beaconPreview}
        title="Preview beacons (hides editing shapes)"
        className={[
          'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition',
          'disabled:cursor-not-allowed disabled:opacity-40',
          beaconPreview
            ? 'border-blue-600 bg-blue-600 text-white'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100',
        ].join(' ')}
      >
        {beaconPreview ? <Eye size={15} /> : <EyeOff size={15} />}
        Preview
      </button>

      {inRegion && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">
            {draftRegionPoints.length} pt
            {draftRegionPoints.length === 1 ? '' : 's'} · dbl-click or Enter to
            finish
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
        <button
          type="button"
          data-tour="configure"
          onClick={() => setConfigureOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          <SlidersHorizontal size={15} />
          Configure
        </button>
        <button
          type="button"
          disabled={!image}
          onClick={() => setExportOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
        >
          <Download size={15} />
          Export
        </button>
        {!DEV_BYPASS && (
          <button
            type="button"
            onClick={signOut}
            title={email ? `Signed in as ${email} — sign out` : 'Sign out'}
            aria-label="Sign out"
            className="flex items-center rounded-md border border-slate-300 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>

      <ConfigureModal open={configureOpen} onClose={() => setConfigureOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
