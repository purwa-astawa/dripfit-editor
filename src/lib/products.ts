// Product data helpers. During local dev these come from the static
// `mock-fashion-products.json` (Storefront API shape). In the full Shopify app
// this would be swapped for a real Storefront API query behind the same shape.

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

function normalize(node: unknown): Product | null {
  if (typeof node !== 'object' || node === null) return null;
  const n = node as Record<string, any>;
  if (typeof n.id !== 'string' || typeof n.title !== 'string') return null;
  return {
    id: n.id,
    title: n.title,
    handle: typeof n.handle === 'string' ? n.handle : '',
    productType: typeof n.productType === 'string' ? n.productType : '',
    vendor: typeof n.vendor === 'string' ? n.vendor : '',
    imageUrl: n.featuredImage?.url ?? null,
    imageAlt: n.featuredImage?.altText ?? null,
    price: n.priceRange?.minVariantPrice ?? null,
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
