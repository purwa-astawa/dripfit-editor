import { useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, Trash2 } from 'lucide-react';
import { ProductCard } from './ProductCard';
import type { PreviewProduct } from './types';

interface Props {
  products: PreviewProduct[];
  shopDomain: string;
  /** Product details still loading — show a spinner instead of placeholder cards. */
  loading?: boolean;
  /** Currently-selected product for this callout (when the deck is reopened). The
   *  deck opens on it, and a "Clear" action is offered. */
  selectedId?: string;
  /** Tap on the front card (or button) selects that product. */
  onSelect: (productId: string) => void;
  /** Clear this callout's selection (only offered when `selectedId` is set). */
  onClear?: () => void;
  onClose: () => void;
}

// Horizontal drag past this many px commits a browse (advance the deck).
const SWIPE_THRESHOLD = 60;
const CARD_WIDTH = 'min(82vw, 320px)';

/**
 * Full-screen, swipeable "Tinder" deck of a callout's products. Swipe (or the
 * prev/next buttons) browses the looping deck; tapping the front card selects
 * that product. Pointer events cover both mouse and touch for mobile.
 */
export function ProductDeck({
  products,
  shopDomain,
  loading = false,
  selectedId,
  onSelect,
  onClear,
  onClose,
}: Props) {
  const n = products.length;
  // Open on the currently-selected product when reopening the deck.
  const [index, setIndex] = useState(() => {
    const i = selectedId ? products.findIndex((p) => p.id === selectedId) : -1;
    return i >= 0 ? i : 0;
  });
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  const mod = (i: number) => ((i % n) + n) % n;

  const advance = (dir: 1 | -1) => {
    setIndex((i) => i + dir);
    setDragX(0);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    moved.current = false;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 6) moved.current = true;
    setDragX(dx);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    startX.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      advance(dx < 0 ? 1 : -1); // drag left → next, right → previous
    } else {
      setDragX(0);
      if (!moved.current) onSelect(products[mod(index)].id); // tap = select
    }
  };
  // A cancelled gesture (system swipe, scroll takeover) must reset the drag so
  // the card doesn't stay offset / keep tracking without a fresh press.
  const onPointerCancel = () => {
    startX.current = null;
    setDragX(0);
  };

  return (
    <div
      className="fixed inset-0 z-[12000] flex flex-col items-center justify-center gap-4 bg-black/60 p-4"
      style={{ pointerEvents: 'auto' }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700 shadow hover:bg-white"
      >
        <X size={18} />
      </button>

      {/* Offered only when reopening a callout that already has a selection. */}
      {selectedId && onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-2 text-xs font-medium text-red-600 shadow hover:bg-white"
        >
          <Trash2 size={14} /> Clear selection
        </button>
      )}

      {loading ? (
        <div
          className="flex items-center gap-2 rounded-xl bg-white px-6 py-8 text-sm text-slate-500 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 size={16} className="animate-spin" /> Loading products…
        </div>
      ) : n === 0 ? (
        <div
          className="rounded-xl bg-white px-6 py-8 text-center text-sm text-slate-500 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          No products on this callout.
        </div>
      ) : (
        <>
          <div
            className="relative"
            style={{ width: CARD_WIDTH }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Back cards (peek behind the front for depth). Non-interactive. */}
            {[2, 1]
              .filter((depth) => depth < n)
              .map((depth) => (
                <div
                  key={depth}
                  className="absolute inset-0"
                  style={{
                    zIndex: 10 - depth,
                    transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.05})`,
                    transition: 'transform 0.2s ease',
                    pointerEvents: 'none',
                  }}
                >
                  <ProductCard
                    product={products[mod(index + depth)]}
                    shopDomain={shopDomain}
                  />
                </div>
              ))}

            {/* Front card (in flow — defines the stack's size). */}
            <div
              className="relative"
              style={{
                zIndex: 12,
                transform: `translateX(${dragX}px) rotate(${dragX * 0.04}deg)`,
                transition: startX.current == null ? 'transform 0.2s ease' : 'none',
                touchAction: 'none',
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              <ProductCard
                product={products[mod(index)]}
                shopDomain={shopDomain}
              />
            </div>
          </div>

          <div
            className="flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => advance(-1)}
              aria-label="Previous"
              disabled={n < 2}
              className="rounded-full bg-white/90 p-2 text-slate-700 shadow hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium tabular-nums text-slate-600 shadow">
              {mod(index) + 1} / {n}
            </span>
            <button
              type="button"
              onClick={() => advance(1)}
              aria-label="Next"
              disabled={n < 2}
              className="rounded-full bg-white/90 p-2 text-slate-700 shadow hover:bg-white disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <p
            className="text-xs text-white/80"
            onClick={(e) => e.stopPropagation()}
          >
            Swipe to browse · tap a card to select
          </p>
        </>
      )}
    </div>
  );
}
