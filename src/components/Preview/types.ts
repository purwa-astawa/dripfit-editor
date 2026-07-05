// Shared types for the preview interaction (callout → swipeable product deck →
// selected product card). These components are intentionally store-agnostic and
// props-driven so the Visualizer can reuse them.

/** A product resolved for display on a preview card. `image` already has the
 *  per-callout override applied (calloutProduct.image ?? product.featuredImage). */
export interface PreviewProduct {
  id: string;
  title: string;
  image: string | null;
  handle: string;
}

/** Build the Shopify product-page URL from the shop domain + product handle, or
 *  null when either is missing (e.g. mock data with no shop connected). */
export function productUrl(shopDomain: string, handle: string): string | null {
  const host = shopDomain
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  const h = handle.trim();
  if (!host || !h) return null;
  return `https://${host}/products/${h}`;
}
