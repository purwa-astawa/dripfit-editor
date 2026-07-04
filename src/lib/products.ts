// Product data helpers. When a shop domain + public Storefront token are
// configured, products come from the live Storefront API; otherwise we fall
// back to the static `mock-fashion-products.json` (same Storefront node shape),
// so local dev works without credentials.

import type { ProductSnapshot } from './schema';
import {
  storefrontListProductNodes,
  storefrontProductNodesByIds,
  type StorefrontConfig,
} from './storefront';

/** Where products are read from — the configured Shopify store, if any. */
export type ProductSource = StorefrontConfig;

export interface Product {
  id: string;
  title: string;
  handle: string;
  productType: string;
  vendor: string;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Requested metafields, keyed by `namespace.key` (missing ones omitted). */
  metafields: Record<string, string>;
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
    metafields: normalizeMetafields(n.metafields),
  };
}

/** The usable value of a metafield: for file/media references, the resolved
 *  URL (e.g. fitdrip's image); otherwise the raw scalar `value`. */
function metafieldValue(m: Record<string, unknown>): string | null {
  const ref = asRecord(m.reference);
  if (ref) {
    const image = asRecord(ref.image); // MediaImage -> image { url }
    if (image && typeof image.url === 'string') return image.url;
    if (typeof ref.url === 'string') return ref.url; // GenericFile -> url
  }
  return typeof m.value === 'string' ? m.value : null;
}

/** Storefront returns `metafields` as an array with `null` for identifiers that
 *  don't exist on a product. Flatten to a `namespace.key -> value` map, using the
 *  resolved reference URL where the metafield is a file/media reference. */
function normalizeMetafields(input: unknown): Record<string, string> {
  if (!Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const raw of input) {
    const m = asRecord(raw);
    if (!m || typeof m.namespace !== 'string' || typeof m.key !== 'string') {
      continue;
    }
    const value = metafieldValue(m);
    if (value !== null) out[`${m.namespace}.${m.key}`] = value;
  }
  return out;
}

/** True when we have enough to talk to the live Storefront API. */
function isConfigured(src?: ProductSource): src is ProductSource {
  return !!src && !!src.shopDomain.trim() && !!src.storefrontApiKey.trim();
}

/** Load and normalize the mock catalog (static fallback for local dev). */
async function fetchMockProducts(): Promise<Product[]> {
  const res = await fetch('/mock-fashion-products.json');
  if (!res.ok) {
    throw new Error(`Failed to load products: ${res.status}`);
  }
  const data = (await res.json()) as StorefrontResponse;
  const edges = data.products?.edges ?? [];
  return edges
    .map((e) => normalize(e.node))
    .filter((p): p is Product => p !== null);
}

// Cache the product list per source so opening the picker for several callouts
// doesn't refetch. Keyed by source (mock, or shop@version); the in-flight
// promise is cached so concurrent callers share one request.
const listCache = new Map<string, Promise<Product[]>>();

function sourceKey(src?: ProductSource): string {
  return isConfigured(src) ? `${src.shopDomain}@${src.apiVersion}` : 'mock';
}

/**
 * Load the product catalog from the active source: the live Storefront API when
 * `src` is configured, otherwise the mock catalog. Cached per source.
 */
export function fetchProducts(src?: ProductSource): Promise<Product[]> {
  const key = sourceKey(src);
  let pending = listCache.get(key);
  if (!pending) {
    pending = (async () => {
      if (isConfigured(src)) {
        const nodes = await storefrontListProductNodes(src);
        return nodes.map(normalize).filter((p): p is Product => p !== null);
      }
      return fetchMockProducts();
    })().catch((err) => {
      listCache.delete(key); // evict on failure so the next call retries
      throw err;
    });
    listCache.set(key, pending);
  }
  return pending;
}

/**
 * Resolve a deduped snapshot map for the given product IDs from the active
 * source. Used to bake `data.products` into the exported map.json as an offline
 * fallback. Live sources query exactly these IDs; the mock source filters the
 * cached catalog.
 */
export async function getProductSnapshots(
  ids: string[],
  src?: ProductSource,
): Promise<Record<string, ProductSnapshot>> {
  if (ids.length === 0) return {};
  const uniqueIds = [...new Set(ids)];

  let products: Product[];
  if (isConfigured(src)) {
    const nodes = await storefrontProductNodesByIds(src, uniqueIds);
    products = nodes.map(normalize).filter((p): p is Product => p !== null);
  } else {
    products = await fetchProducts(src); // mock, shares listCache
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  const out: Record<string, ProductSnapshot> = {};
  for (const id of uniqueIds) {
    const p = byId.get(id);
    if (!p) continue;
    out[id] = {
      title: p.title,
      handle: p.handle || undefined,
      featuredImage: p.imageUrl,
    };
  }
  return out;
}
