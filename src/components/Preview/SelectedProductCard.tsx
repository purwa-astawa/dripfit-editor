import { useState } from 'react';
import { Info, X } from 'lucide-react';
import type { PreviewProduct } from './types';
import { ProductImage, ViewProductLink } from './ProductCard';

interface Props {
  product: PreviewProduct;
  shopDomain: string;
  /** Image shape (a global preview setting): circular or square. */
  shape: 'circle' | 'square';
  /** Display mode: `details` = title/link always shown; `info` = hidden until the
   *  info button is tapped. */
  mode: 'details' | 'info';
  /** Tap the image to reopen the deck (pick a different product). */
  onActivate: () => void;
}

/**
 * The card that replaces a callout's beacon once a product is selected. The image
 * follows the callout shape; details (title + View-product link) are either always
 * shown (`details`) or revealed by an info button (`info`). Tapping the image
 * reopens the product deck.
 */
export function SelectedProductCard({
  product,
  shopDomain,
  shape,
  mode,
  onActivate,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const showDetails = mode === 'details' || expanded;
  const rounded = shape === 'circle' ? 'rounded-full' : 'rounded-xl';

  return (
    <div className="flex w-32 flex-col items-center gap-1.5">
      <div className="relative">
        <button
          type="button"
          onClick={onActivate}
          aria-label={`Open ${product.title}`}
          className={[
            'block h-24 w-24 overflow-hidden border border-slate-200 shadow-lg',
            rounded,
          ].join(' ')}
        >
          <ProductImage
            product={product}
            iconSize={22}
            className="h-full w-full"
          />
        </button>

        {/* Info / close toggle — only in `info` mode. */}
        {mode === 'info' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? 'Hide details' : 'Show details'}
            aria-pressed={expanded}
            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow hover:bg-slate-50"
          >
            {expanded ? <X size={13} /> : <Info size={13} />}
          </button>
        )}
      </div>

      {showDetails && (
        <div className="w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <p className="truncate text-xs font-medium text-slate-800">
            {product.title}
          </p>
          <ViewProductLink
            shopDomain={shopDomain}
            handle={product.handle}
            small
          />
        </div>
      )}
    </div>
  );
}
