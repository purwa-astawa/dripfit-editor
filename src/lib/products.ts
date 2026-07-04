// Product data helpers. During local dev these come from the static
// `mock-fashion-products.json` (Storefront API shape). In the full Shopify app
// this would be swapped for a real Storefront API query behind the same shape.

import type { ProductSnapshot } from './schema';

export interface Product {
  id: string;
  title: string;
  handle: string;
  productType: string;
  vendor: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: { amount: string; currencyCode: string } | null;
}

interface StorefrontResponse {
  products?: {
    edges?: Array<{ node?: unknown }>;
  };
}

/** Treat an unknown value as a plain object for safe property lookups. */
function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null
    ? (v as Record<string, unknown>)
    : null;
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function normalize(node: unknown): Product | null {
  const n = asRecord(node);
  if (!n) return null;
  if (typeof n.id !== 'string' || typeof n.title !== 'string') return null;

  const featuredImage = asRecord(n.featuredImage);
  const minPrice = asRecord(asRecord(n.priceRange)?.minVariantPrice);

  return {
    id: n.id,
    title: n.title,
    handle: asString(n.handle),
    productType: asString(n.productType),
    vendor: asString(n.vendor),
    imageUrl: featuredImage && typeof featuredImage.url === 'string'
      ? featuredImage.url
      : null,
    imageAlt: featuredImage && typeof featuredImage.altText === 'string'
      ? featuredImage.altText
      : null,
    price:
      minPrice &&
      typeof minPrice.amount === 'string' &&
      typeof minPrice.currencyCode === 'string'
        ? { amount: minPrice.amount, currencyCode: minPrice.currencyCode }
        : null,
  };
}

let cache: Product[] | null = null;

/** Load and normalize the mock product catalog (cached after first call). */
export async function fetchProducts(): Promise<Product[]> {
  if (cache) return cache;
  const res = await fetch('/mock-fashion-products.json');
  if (!res.ok) {
    throw new Error(`Failed to load products: ${res.status}`);
  }
  const data = (await res.json()) as StorefrontResponse;
  const edges = data.products?.edges ?? [];
  cache = edges
    .map((e) => normalize(e.node))
    .filter((p): p is Product => p !== null);
  return cache;
}

/**
 * Resolve a deduped snapshot map for the given product IDs from the active
 * product source (mock catalog for now; Storefront API in Phase 2). Used to bake
 * `data.products` into the exported map.json as an offline fallback.
 */
export async function getProductSnapshots(
  ids: string[],
): Promise<Record<string, ProductSnapshot>> {
  if (ids.length === 0) return {};
  const all = await fetchProducts();
  const byId = new Map(all.map((p) => [p.id, p]));
  const out: Record<string, ProductSnapshot> = {};
  for (const id of new Set(ids)) {
    const p = byId.get(id);
    if (!p) continue;
    out[id] = {
      title: p.title,
      handle: p.handle || undefined,
      featuredImage: p.imageUrl,
      price: p.price,
    };
  }
  return out;
}

export function formatPrice(
  price: { amount: string; currencyCode: string } | null,
): string {
  if (!price) return '';
  const amount = Number(price.amount);
  if (Number.isNaN(amount)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: price.currencyCode,
    }).format(amount);
  } catch {
    return `${price.amount} ${price.currencyCode}`;
  }
}
