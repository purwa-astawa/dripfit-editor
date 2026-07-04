import { useEffect, useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';
import { fetchProducts, formatPrice, type Product } from '../../lib/products';
import { useEditorStore } from '../../store/editorStore';

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ProductPicker({ selectedIds, onChange }: Props) {
  const shopDomain = useEditorStore((s) => s.shopDomain);
  const storefrontApiKey = useEditorStore((s) => s.storefrontApiKey);
  const apiVersion = useEditorStore((s) => s.apiVersion);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Reload when the Shopify connection changes (live store vs. mock fallback).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchProducts({ shopDomain, storefrontApiKey, apiVersion })
      .then((p) => {
        if (alive) setProducts(p);
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

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.productType.toLowerCase().includes(q),
    );
  }, [products, query]);

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
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

      {loading && <p className="text-sm text-slate-400">Loading products…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <ul className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">No matches.</li>
          )}
          {filtered.map((p) => {
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
                  <span className="flex-1">
                    <span className="block truncate text-slate-800">
                      {p.title}
                    </span>
                    <span className="block truncate text-xs text-slate-400">
                      {p.productType}
                    </span>
                  </span>
                  <span className="flex-none text-xs text-slate-500">
                    {formatPrice(p.price)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
