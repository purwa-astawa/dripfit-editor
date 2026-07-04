import { ImagePlus } from 'lucide-react';
import { useEditorStore } from './store/editorStore';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Canvas } from './components/Canvas/Canvas';
import { CalloutList } from './components/CalloutList/CalloutList';
import { CalloutEditPanel } from './components/CalloutEditPanel/CalloutEditPanel';

export default function App() {
  const image = useEditorStore((s) => s.image);

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900">
      <Toolbar />

      <div className="flex min-h-0 flex-1">
        {/* Canvas area */}
        <main className="min-w-0 flex-1 p-3">
          <div className="h-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-inner">
            {image ? (
              <Canvas />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
                <ImagePlus size={40} strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    No background image
                  </p>
                  <p className="text-sm">
                    Upload an image from the toolbar to start mapping.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right sidebar */}
        <aside className="flex w-80 flex-none flex-col border-l border-slate-200 bg-white">
          <div className="flex-none border-b border-slate-200" style={{ maxHeight: '45%' }}>
            <div className="max-h-[45vh] overflow-hidden">
              <CalloutList />
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <CalloutEditPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
