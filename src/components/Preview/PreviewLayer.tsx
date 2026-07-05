import { useCallback, useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { fetchProducts, type Product } from '../../lib/products';
import { ratioToPixel, type RenderBox } from '../../lib/geometry';
import { ProductDeck } from './ProductDeck';
import { SelectedProductCard } from './SelectedProductCard';
import type { PreviewProduct } from './types';

interface Props {
  box: RenderBox;
  /** Callout whose deck is open, or null. */
  openCalloutId: string | null;
  /** Per-callout selected product id (calloutId → productId). */
  selection: Record<string, string>;
  onOpenDeck: (calloutId: string) => void;
  onCloseDeck: () => void;
  onSelectProduct: (calloutId: string, productId: string) => void;
  onClearSelection: (calloutId: string) => void;
}

/**
 * HTML overlay for preview mode: sits above the Konva canvas and renders, per
 * callout, the selected-product card (which replaces the beacon once chosen),
 * plus the full-screen product deck when a callout's deck is open. Beacons for
 * un-selected callouts are drawn on the canvas (KonvaBeacon); this layer only
 * takes over once a product has been picked.
 */
export function PreviewLayer({
  box,
  openCalloutId,
  selection,
  onOpenDeck,
  onCloseDeck,
  onSelectProduct,
  onClearSelection,
}: Props) {
  const callouts = useEditorStore((s) => s.callouts);
  const shopDomain = useEditorStore((s) => s.shopDomain);
  const storefrontApiKey = useEditorStore((s) => s.storefrontApiKey);
  const apiVersion = useEditorStore((s) => s.apiVersion);
  const productCardMode = useEditorStore((s) => s.productCardMode);
  const productCardShape = useEditorStore((s) => s.productCardShape);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);

  // Load product details for card display (title/handle/featured image). Cached
  // in lib/products, so this is cheap and shared with the ProductPicker.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchProducts({ shopDomain, storefrontApiKey, apiVersion })
      .then((ps) => {
        if (alive) setProducts(new Map(ps.map((p) => [p.id, p])));
      })
      .catch(() => {
        if (alive) setProducts(new Map());
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [shopDomain, storefrontApiKey, apiVersion]);

  // Resolve a callout's products to display cards. Image uses the per-callout
  // override, else the product's featured image (the documented fitdrip rule).
  const cardsFor = useCallback(
    (calloutId: string): PreviewProduct[] => {
      const c = callouts.find((x) => x.id === calloutId);
      if (!c) return [];
      return c.products.map((cp) => {
        const p = products.get(cp.id);
        return {
          id: cp.id,
          title: p?.title ?? 'Product',
          image: cp.image ?? p?.imageUrl ?? null,
          handle: p?.handle ?? '',
        };
      });
    },
    [callouts, products],
  );

  const openCallout = openCalloutId
    ? callouts.find((c) => c.id === openCalloutId)
    : null;

  return (
    <div className="pointer-events-none absolute inset-0">
      {/* Selected-product cards, positioned where the beacon sits. */}
      {callouts.map((c) => {
        const selectedId = selection[c.id];
        if (!selectedId) return null; // beacon (canvas) shows until a pick
        const card = cardsFor(c.id).find((x) => x.id === selectedId);
        if (!card) return null;
        const pos = ratioToPixel(c.beacon, box);
        return (
          <div
            key={c.id}
            className="pointer-events-auto absolute"
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <SelectedProductCard
              product={card}
              shopDomain={shopDomain}
              shape={productCardShape}
              mode={productCardMode}
              onActivate={() => onOpenDeck(c.id)}
            />
          </div>
        );
      })}

      {/* The swipe deck (its own full-screen fixed overlay). */}
      {openCallout && (
        <ProductDeck
          products={cardsFor(openCallout.id)}
          shopDomain={shopDomain}
          loading={loading}
          selectedId={selection[openCallout.id]}
          onSelect={(pid) => onSelectProduct(openCallout.id, pid)}
          onClear={() => {
            onClearSelection(openCallout.id);
            onCloseDeck();
          }}
          onClose={onCloseDeck}
        />
      )}
    </div>
  );
}
