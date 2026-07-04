import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Check,
  ImageOff,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { fetchProducts, type Product } from '../../lib/products';
import { useEditorStore } from '../../store/editorStore';
import type { CalloutProduct } from '../../lib/schema';

interface Props {
  value: CalloutProduct[];
  onChange: (products: CalloutProduct[]) => void;
}

const PAGE_SIZE = 10;

// The metafield (namespace.key) whose resolved image can replace a product's
// featured image on a callout. Matches PRODUCT_METAFIELD_IDENTIFIERS.
const FITDRIP_KEY = 'custom.fitdrip';

export function ProductPicker({ value, onChange }: Props) {
  const shopDomain = useEditorStore((s) => s.shopDomain);
  const storefrontApiKey = useEditorStore((s) => s.storefrontApiKey);
  const apiVersion = useEditorStore((s) => s.apiVersion);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loadedNotice, setLoadedNotice] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Reload when the Shopify connection changes (live store vs. mock fallback).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setLoadedNotice(null);
    fetchProducts({ shopDomain, storefrontApiKey, apiVersion })
      .then((p) => {
        if (!alive) return;
        setProducts(p);
        setLoadedNotice(`Loaded ${p.length} product${p.length === 1 ? '' : 's'}`);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shopDomain, storefrontApiKey, apiVersion]);

  // Auto-dismiss the "loaded" notification a couple of seconds after it shows.
  useEffect(() => {
    if (!loadedNotice) return;
    const t = setTimeout(() => setLoadedNotice(null), 2500);
    return () => clearTimeout(t);
  }, [loadedNotice]);

  const selected = useMemo(() => new Set(value.map((p) => p.id)), [value]);
  const byId = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  // Distinct product types (with counts) for the filter dropdown, built by
  // looping over every loaded product.
  const productTypes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const t = p.productType.trim();
      if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (typeFilter && p.productType !== typeFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.productType.toLowerCase().includes(q)
      );
    });
  }, [products, query, typeFilter]);

  // Jump back to the first page whenever the result set changes (new search,
  // type filter, or reload) so the current page is never out of range.
  useEffect(() => {
    setPage(0);
  }, [query, typeFilter, products]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(value.filter((p) => p.id !== id));
    } else {
      onChange([...value, { id }]); // added with the default (featured) image
    }
  };

  // Switch which image this callout uses for a selected product: the default
  // featured image, or the product's fitdrip image.
  const setImageSource = (id: string, source: 'featured' | 'fitdrip') => {
    const fitdripUrl = byId.get(id)?.metafields[FITDRIP_KEY];
    onChange(
      value.map((p) =>
        p.id === id
          ? source === 'fitdrip' && fitdripUrl
            ? { id, image: fitdripUrl }
            : { id }
          : p,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-md border border-slate-300 py-1.5 pl-7 pr-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {!loading && !error && productTypes.length > 1 && (
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 px-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">All types ({products.length})</option>
          {productTypes.map(([type, count]) => (
            <option key={type} value={type}>
              {type} ({count})
            </option>
          ))}
        </select>
      )}

      {loading && (
        <p className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 size={15} className="animate-spin" /> Loading products…
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && loadedNotice && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-600">
          <CheckCircle2 size={14} /> {loadedNotice}
        </p>
      )}

      {!loading && !error && (
        <ul className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">No matches.</li>
          )}
          {pageItems.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={[
                    'flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0',
                    isSelected ? 'bg-blue-50' : 'hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex h-4 w-4 flex-none items-center justify-center rounded border',
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300',
                    ].join(' ')}
                  >
                    {isSelected && <Check size={12} />}
                  </span>
                  {/* Thumbnail: product image over an ImageOff placeholder that
                      shows through when there's no image (or it fails to load). */}
                  <span className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-100">
                    <ImageOff size={14} className="text-slate-300" />
                    {p.imageUrl && (
                      <img
                        src={p.imageUrl}
                        alt={p.imageAlt ?? ''}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-800">
                      {p.title}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {p.productType}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && !error && filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {pageStart + 1}–{pageStart + pageItems.length} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="flex items-center rounded-md border border-slate-300 bg-white p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="flex items-center rounded-md border border-slate-300 bg-white p-1 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Selected products — listed below (not scrollable) so you can review the
          full set and, per product, pick which image this callout uses. */}
      {value.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-slate-200 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Selected ({value.length})
          </p>
          <ul className="flex flex-col gap-1.5">
            {value.map((entry) => {
              const p = byId.get(entry.id);
              const fitdripUrl = p?.metafields[FITDRIP_KEY];
              const usingFitdrip = !!entry.image;
              // Thumbnail reflects the image this callout will actually use.
              const shownImage = entry.image ?? p?.imageUrl ?? null;
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-2 rounded-md border border-slate-200 p-1.5"
                >
                  <span className="relative flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-100">
                    <ImageOff size={13} className="text-slate-300" />
                    {shownImage && (
                      <img
                        src={shownImage}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm text-slate-800">
                      {p?.title ?? 'Unknown product'}
                    </span>
                    {fitdripUrl && (
                      <div className="inline-flex w-fit overflow-hidden rounded border border-slate-200 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setImageSource(entry.id, 'featured')}
                          className={
                            usingFitdrip
                              ? 'px-1.5 py-0.5 text-slate-500 hover:bg-slate-100'
                              : 'bg-blue-600 px-1.5 py-0.5 text-white'
                          }
                        >
                          Featured
                        </button>
                        <button
                          type="button"
                          onClick={() => setImageSource(entry.id, 'fitdrip')}
                          className={
                            usingFitdrip
                              ? 'bg-blue-600 px-1.5 py-0.5 text-white'
                              : 'px-1.5 py-0.5 text-slate-500 hover:bg-slate-100'
                          }
                        >
                          Fitdrip
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    aria-label={`Remove ${p?.title ?? entry.id}`}
                    className="flex-none rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
