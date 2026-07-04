import { useEffect, useState } from 'react';
import { X, Copy, Check, Download, AlertCircle } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { getProductSnapshots } from '../../lib/products';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Export the current map.json — copy to clipboard or download. Shopify
 *  connection settings live in the Configure modal. */
export function ExportModal({ open, onClose }: Props) {
  const image = useEditorStore((s) => s.image);
  const callouts = useEditorStore((s) => s.callouts);
  const storefrontApiKey = useEditorStore((s) => s.storefrontApiKey);
  const shopDomain = useEditorStore((s) => s.shopDomain);
  const apiVersion = useEditorStore((s) => s.apiVersion);
  const exportJson = useEditorStore((s) => s.exportJson);

  const [preview, setPreview] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  // Build the export preview (with baked product snapshots) whenever the modal
  // is open and something that affects the output changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const doc = exportJson();
      const ids = doc.data.callouts.flatMap((c) => c.productIds);
      try {
        doc.data.products = await getProductSnapshots(ids, {
          shopDomain,
          storefrontApiKey,
          apiVersion,
        });
        if (!cancelled) setSnapshotError(null);
      } catch (err) {
        // The map is still exportable; the widget falls back to fetching
        // products live. Warn, but leave `products` empty and show the map.
        if (!cancelled) {
          setSnapshotError(
            `Couldn't bake product snapshots: ${(err as Error).message}`,
          );
        }
      }
      if (!cancelled) setPreview(JSON.stringify(doc, null, 2));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, exportJson, callouts, image, storefrontApiKey, shopDomain, apiVersion]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError('Clipboard access was blocked — select the text and copy manually.');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([preview], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'map.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Export map.json</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Product snapshots are baked in from your connected store (or the
              sample catalog if none).
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!preview}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={!preview}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-40"
              >
                <Download size={13} /> Download
              </button>
            </div>
          </div>
          <textarea
            readOnly
            value={preview}
            spellCheck={false}
            className="h-72 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700"
          />
          {snapshotError && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle size={13} /> {snapshotError}
            </p>
          )}
          {copyError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={13} /> {copyError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
