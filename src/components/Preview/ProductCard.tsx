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
}: {
  shopDomain: string;
  handle: string;
  small?: boolean;
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
        'inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700',
        small ? 'text-[11px]' : 'text-sm',
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

/** The large card shown in the swipe deck: image + title + View-product link. */
export function ProductCard({
  product,
  shopDomain,
}: {
  product: PreviewProduct;
  shopDomain: string;
}) {
  return (
    <div className="flex w-full select-none flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <ProductImage product={product} />
      <div className="flex flex-col gap-2 p-4">
        <p className="text-base font-semibold text-slate-800">{product.title}</p>
        <ViewProductLink shopDomain={shopDomain} handle={product.handle} />
      </div>
    </div>
  );
}
