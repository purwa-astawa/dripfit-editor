import { useEffect, useMemo, useState } from 'react';
import { X, Copy, Check, Download, AlertCircle } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { getProductSnapshots } from '../../lib/products';
import { toBase64Utf8 } from '../../lib/base64';

interface Props {
  open: boolean;
  onClose: () => void;
}

type ExportFormat = 'base64' | 'json';

/** Export the current dripfit-config — copy to clipboard or download. Shopify
 *  connection settings live in the Configure modal. */
export function ExportModal({ open, onClose }: Props) {
  const image = useEditorStore((s) => s.image);
  const callouts = useEditorStore((s) => s.callouts);
  const storefrontApiKey = useEditorStore((s) => s.storefrontApiKey);
  const shopDomain = useEditorStore((s) => s.shopDomain);
  const apiVersion = useEditorStore((s) => s.apiVersion);
  const exportJson = useEditorStore((s) => s.exportJson);

  const [preview, setPreview] = useState('');
  const [format, setFormat] = useState<ExportFormat>('base64');
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
      const ids = doc.data.callouts.flatMap((c) => c.products.map((p) => p.id));
      try {
        doc.data.products = await getProductSnapshots(ids, {
          shopDomain,
          storefrontApiKey,
          apiVersion,
        });
        if (!cancelled) setSnapshotError(null);
      } catch (err) {
        // The map is still exportable; the widget falls back to fetching
        // products live. Warn, but leave `products` empty and show the config.
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

  // What the user actually copies/downloads. Base64 is brace-free, so it always
  // saves into a Shopify theme setting (raw JSON ending in `}}}}` gets rejected).
  // Memoized (before the early return, per rules of hooks) so a large baked
  // poster isn't re-encoded on every re-render.
  const output = useMemo(
    () => (preview && format === 'base64' ? toBase64Utf8(preview) : preview),
    [preview, format],
  );

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopyError('Clipboard access was blocked — select the text and copy manually.');
    }
  };

  const handleDownload = () => {
    const isBase64 = format === 'base64';
    const blob = new Blob([output], {
      type: isBase64 ? 'text/plain' : 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isBase64 ? 'dripfit-config.txt' : 'dripfit-config.json';
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
          <h2 className="text-sm font-semibold text-slate-800">Export dripfit-config</h2>
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
          <div className="flex items-center gap-1 self-start rounded-md border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setFormat('base64')}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                format === 'base64'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Base64 (theme-safe)
            </button>
            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                format === 'json'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              JSON
            </button>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              {format === 'base64'
                ? 'Base64-encoded so it pastes into a Shopify theme setting without being rejected as Liquid.'
                : 'Product snapshots are baked in from your connected store (or the sample catalog if none).'}
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
            value={output}
            spellCheck={false}
            className={`h-72 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-xs text-slate-700 ${
              format === 'base64' ? 'break-all' : ''
            }`}
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
