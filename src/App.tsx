import { lazy, Suspense } from 'react';
import { ImagePlus, Loader2, AlertCircle } from 'lucide-react';
import { useEditorStore } from './store/editorStore';
import { Toolbar } from './components/Toolbar/Toolbar';
import { CalloutList } from './components/CalloutList/CalloutList';
import { CalloutEditPanel } from './components/CalloutEditPanel/CalloutEditPanel';
import { MobileWarning } from './components/MobileWarning/MobileWarning';
import { HelpButton } from './components/Help/HelpButton';

// Code-split the heavy pieces out of the initial bundle:
// - Canvas pulls in Konva/react-konva/use-image (the largest dependency) and is
//   only needed once a background image is loaded.
// - Tour pulls in react-joyride and is only used for onboarding.
const Canvas = lazy(() =>
  import('./components/Canvas/Canvas').then((m) => ({ default: m.Canvas })),
);
const Tour = lazy(() =>
  import('./components/Tour/Tour').then((m) => ({ default: m.Tour })),
);

export default function App() {
  const image = useEditorStore((s) => s.image);
  const imageStatus = useEditorStore((s) => s.imageStatus);
  const imageError = useEditorStore((s) => s.imageError);

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-900">
      <MobileWarning />
      <Suspense fallback={null}>
        <Tour />
      </Suspense>
      <Toolbar />

      <div className="flex min-h-0 flex-1">
        {/* Canvas area */}
        <main className="min-w-0 flex-1 p-3">
          <div className="h-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-inner">
            {image ? (
              <Suspense
                fallback={
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
                    <Loader2 size={40} strokeWidth={1.5} className="animate-spin" />
                    <p className="text-sm font-medium text-slate-500">
                      Loading canvas…
                    </p>
                  </div>
                }
              >
                <Canvas />
              </Suspense>
            ) : imageStatus === 'loading' ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
                <Loader2 size={40} strokeWidth={1.5} className="animate-spin" />
                <p className="text-sm font-medium text-slate-500">
                  Loading image…
                </p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-400">
                {imageStatus === 'error' ? (
                  <>
                    <AlertCircle size={40} strokeWidth={1.5} className="text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-red-500">
                        {imageError ?? 'Could not load image'}
                      </p>
                      <p className="text-sm">
                        Check the URL is public and points to an image.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <ImagePlus size={40} strokeWidth={1.5} />
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        No background image
                      </p>
                      <p className="text-sm">
                        Open <strong>Configure</strong> in the toolbar to add a
                        background image and start mapping.
                      </p>
                    </div>
                  </>
                )}
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

      <HelpButton />
    </div>
  );
}
