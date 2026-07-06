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
  const isCircle = shape === 'circle';
  const rounded = isCircle ? 'rounded-full' : 'rounded-xl';

  return (
    <div className="flex w-fit flex-col items-center">
      <div className="relative">
        {/* Shape-clipped frame: rounds the image AND the details scrim inside it
            (overflow-hidden), so on a circle the scrim conforms to the curve. */}
        <div
          className={[
            'relative h-24 w-24 overflow-hidden border border-slate-200 bg-white shadow-lg',
            rounded,
          ].join(' ')}
        >
          <button
            type="button"
            onClick={onActivate}
            aria-label={`Open ${product.title}`}
            className="block h-full w-full"
          >
            <ProductImage
              product={product}
              iconSize={22}
              className="h-full w-full"
            />
          </button>

          {/* Details cover the whole image as a gradient scrim (not a separate
              box), keeping the card exactly image-sized. Content is centered —
              the widest band — and the title wraps up to 3 lines to show more. */}
          {showDetails && (
            <div
              className={[
                // pointer-events-none: the scrim covers the whole image, so let
                // taps fall through to the image button (it reopens the deck);
                // the link re-enables pointer events on itself.
                'pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-gradient-to-t from-black/85 via-black/55 to-black/25 text-center',
                isCircle ? 'px-[0.85rem] py-2' : 'p-2',
              ].join(' ')}
            >
              <p className="line-clamp-3 w-full text-[0.6875rem] font-semibold leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
                {product.title}
              </p>
              <ViewProductLink
                shopDomain={shopDomain}
                handle={product.handle}
                small
                onDark
              />
            </div>
          )}
        </div>

        {/* Info / close toggle — only in `info` mode; kept OUTSIDE the clip so it
            isn't cut off. */}
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
    </div>
  );
}
