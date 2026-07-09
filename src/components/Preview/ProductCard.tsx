import { ImageOff, ExternalLink } from 'lucide-react';
import type { PreviewProduct } from './types';
import { productUrl } from './types';

/** "View product" link → Shopify product page. Stops event propagation so tapping
 *  it navigates rather than selecting/swiping/reopening the card. Renders nothing
 *  when there's no resolvable URL. */
export function ViewProductLink({
  shopDomain,
  handle,
  small = false,
  onDark = false,
}: {
  shopDomain: string;
  handle: string;
  small?: boolean;
  /** Render light (white + text-shadow) for use on a dark image scrim. */
  onDark?: boolean;
}) {
  const url = productUrl(shopDomain, handle);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={[
        'inline-flex items-center gap-1 font-medium',
        onDark
          ? 'pointer-events-auto text-white hover:text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]'
          : 'text-blue-600 hover:text-blue-700',
        small ? 'whitespace-nowrap text-[0.625rem]' : 'text-sm',
      ].join(' ')}
    >
      View product <ExternalLink size={small ? 11 : 14} />
    </a>
  );
}

/** Square image over a placeholder that shows through when there's no image. */
export function ProductImage({
  product,
  className,
  iconSize = 40,
}: {
  product: PreviewProduct;
  className?: string;
  iconSize?: number;
}) {
  return (
    <div
      className={[
        'relative flex items-center justify-center overflow-hidden bg-slate-100',
        className ?? '',
      ].join(' ')}
      style={{ aspectRatio: '1 / 1' }}
    >
      <ImageOff className="text-slate-300" size={iconSize} />
      {product.image && (
        <img
          src={product.image}
          alt={product.title}
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

/** The large card shown in the swipe deck: the title + View-product link overlay
 *  the bottom of the image as a gradient scrim ("overlay card"); the card's
 *  overflow-hidden clips the scrim to the rounded corners. */
export function ProductCard({
  product,
  shopDomain,
}: {
  product: PreviewProduct;
  shopDomain: string;
}) {
  return (
    <div className="relative flex w-full select-none flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <ProductImage product={product} />
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 bg-gradient-to-t from-black/80 via-black/50 to-transparent px-4 pb-4 pt-11">
        <p className="text-base font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">
          {product.title}
        </p>
        <ViewProductLink shopDomain={shopDomain} handle={product.handle} onDark />
      </div>
    </div>
  );
}
