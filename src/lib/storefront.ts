// Thin Shopify Storefront GraphQL client. The Storefront API is built for
// client-side use with a *public* access token (sent via the
// `X-Shopify-Storefront-Access-Token` header) and supports CORS, so these
// requests run directly from the browser — no backend proxy needed.

export interface StorefrontConfig {
  shopDomain: string;
  storefrontApiKey: string;
  apiVersion: string;
}

// The fields we request map 1:1 onto the normalized `Product` shape in
// products.ts, so the same `normalize()` handles both live and mock nodes.
const PRODUCT_FIELDS = `
  id
  title
  handle
  productType
  vendor
  featuredImage { url altText }
  priceRange { minVariantPrice { amount currencyCode } }
`;

const LIST_QUERY = `
  query Products($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      edges { node { ${PRODUCT_FIELDS} } }
    }
  }
`;

const BY_IDS_QUERY = `
  query ProductsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product { ${PRODUCT_FIELDS} }
    }
  }
`;

interface GraphQLResponse {
  data?: unknown;
  errors?: Array<{ message?: string }>;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null
    ? (v as Record<string, unknown>)
    : null;
}

function endpoint(cfg: StorefrontConfig): string {
  // Accept shop domains with or without protocol / trailing slash.
  const host = cfg.shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const version = cfg.apiVersion || '2025-01';
  return `https://${host}/api/${version}/graphql.json`;
}

async function storefrontFetch(
  cfg: StorefrontConfig,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(endpoint(cfg), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': cfg.storefrontApiKey,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error(
      `Could not reach ${cfg.shopDomain}. Check the shop domain and your network.`,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Storefront API rejected the token — use a public Storefront access token, not an app API secret (shpss_…).',
    );
  }
  if (!res.ok) {
    throw new Error(`Storefront API error: HTTP ${res.status}`);
  }
  const body = (await res.json()) as GraphQLResponse;
  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors[0]?.message ?? 'Storefront API returned errors');
  }
  return body.data;
}

/** Raw product nodes from a `products(first, query)` listing (max 250). */
export async function storefrontListProductNodes(
  cfg: StorefrontConfig,
  opts: { first?: number; query?: string } = {},
): Promise<unknown[]> {
  const data = asRecord(
    await storefrontFetch(cfg, LIST_QUERY, {
      first: opts.first ?? 250,
      query: opts.query ?? null,
    }),
  );
  const products = asRecord(data?.products);
  const edges = products && Array.isArray(products.edges) ? products.edges : [];
  return edges.map((e) => asRecord(e)?.node);
}

/** Raw product nodes for specific IDs (gid://shopify/Product/...). Missing IDs
 *  come back as null and are dropped by the caller's normalize step. */
export async function storefrontProductNodesByIds(
  cfg: StorefrontConfig,
  ids: string[],
): Promise<unknown[]> {
  if (ids.length === 0) return [];
  const data = asRecord(await storefrontFetch(cfg, BY_IDS_QUERY, { ids }));
  return data && Array.isArray(data.nodes) ? data.nodes : [];
}
