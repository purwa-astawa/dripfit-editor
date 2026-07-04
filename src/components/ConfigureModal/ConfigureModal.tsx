import { useState } from 'react';
import {
  X,
  Link as LinkIcon,
  Loader2,
  Store,
  Upload,
  ClipboardPaste,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { normalizeImageUrl } from '../../lib/imageUrl';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Configure" — the single place to get set up: load the background image,
 * connect the Shopify storefront, and import an existing map.json.
 */
export function ConfigureModal({ open, onClose }: Props) {
  const image = useEditorStore((s) => s.image);
  const imageStatus = useEditorStore((s) => s.imageStatus);
  const imageError = useEditorStore((s) => s.imageError);
  const loadImageFromUrl = useEditorStore((s) => s.loadImageFromUrl);
  const shopDomain = useEditorStore((s) => s.shopDomain);
  const storefrontApiKey = useEditorStore((s) => s.storefrontApiKey);
  const apiVersion = useEditorStore((s) => s.apiVersion);
  const setShopifyConfig = useEditorStore((s) => s.setShopifyConfig);
  const loadFromJson = useEditorStore((s) => s.loadFromJson);

  const [urlInput, setUrlInput] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  if (!open) return null;

  const loading = imageStatus === 'loading';

  // Load the image but keep the modal open so you can carry on configuring
  // (Shopify settings, import, etc.). Both Enter and the Load button do this.
  const submitUrl = () => {
    if (!urlInput.trim() || loading) return;
    loadImageFromUrl(urlInput);
  };

  // Closing the modal: if a URL was typed but not yet loaded, load it first so
  // Done doesn't silently discard it. Skips a reload if it's already the loaded
  // image (loadImageFromUrl normalizes, so compare the normalized form).
  const handleDone = () => {
    const url = urlInput.trim();
    if (url && !loading && normalizeImageUrl(url) !== image?.url) {
      loadImageFromUrl(url);
    }
    onClose();
  };

  const importFromText = (text: string) => {
    try {
      loadFromJson(JSON.parse(text));
      setImportError(null);
      setPasteText('');
      onClose();
    } catch (err) {
      setImportError((err as Error).message);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importFromText(String(reader.result));
    reader.readAsText(file);
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
          <h2 className="text-sm font-semibold text-slate-800">Configure</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-4">
          {/* Background image */}
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <LinkIcon size={13} /> Background image
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="url"
                data-tour="cfg-image"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitUrl();
                }}
                placeholder="Paste a public image URL (Dropbox / Drive links work)…"
                disabled={loading}
                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={() => submitUrl()}
                disabled={loading || !urlInput.trim()}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                {loading ? 'Loading…' : 'Load'}
              </button>
            </div>
            {imageStatus === 'error' && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle size={13} /> {imageError}
              </p>
            )}
            {image && imageStatus !== 'error' && (
              <p className="text-xs text-slate-400">
                Loaded {image.width}×{image.height}px.
              </p>
            )}
          </section>

          {/* Storefront connection */}
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Store size={13} /> Storefront connection
            </h3>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">Shop domain</span>
              <input
                type="text"
                data-tour="cfg-domain"
                value={shopDomain}
                onChange={(e) => setShopifyConfig({ shopDomain: e.target.value.trim() })}
                placeholder="your-shop.myshopify.com"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-500">
                Storefront API access token
              </span>
              <input
                type="text"
                data-tour="cfg-token"
                value={storefrontApiKey}
                onChange={(e) =>
                  setShopifyConfig({ storefrontApiKey: e.target.value.trim() })
                }
                placeholder="Public Storefront access token"
                className="rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="flex w-40 flex-col gap-1">
              <span className="text-xs text-slate-500">API version</span>
              <input
                type="text"
                value={apiVersion}
                onChange={(e) => setShopifyConfig({ apiVersion: e.target.value.trim() })}
                placeholder="2025-01"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </label>
            <p className="text-xs text-slate-400">
              The Storefront token is a public access token — safe to embed in the
              exported map.json. Settings persist for this browser session.
            </p>
          </section>

          {/* Import */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Import map.json
              </h3>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100">
                <Upload size={13} /> From file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            </div>
            <textarea
              data-tour="cfg-import"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              spellCheck={false}
              placeholder="Paste map.json here…"
              className="h-32 w-full resize-none rounded-md border border-slate-300 p-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
            />
            {importError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle size={13} /> {importError}
              </p>
            )}
            <button
              type="button"
              onClick={() => importFromText(pasteText)}
              disabled={!pasteText.trim()}
              className="flex w-fit items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-40"
            >
              <ClipboardPaste size={13} /> Load pasted JSON
            </button>
          </section>
        </div>

        {/* Footer — settings persist as you type; Done loads any pending image
            URL, then closes. */}
        <div className="flex justify-end border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={handleDone}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Check size={15} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}
