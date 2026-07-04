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
// Product metafields to request. The Storefront API has no "all metafields"
// query — each metafield must be named by namespace + key. Edit this list to
// match your store's metafield definitions; leave it empty to skip metafields.
export const PRODUCT_METAFIELD_IDENTIFIERS: { namespace: string; key: string }[] =
  [
    { namespace: 'custom', key: 'fitdrip' },
  ];

const metafieldsSelection = PRODUCT_METAFIELD_IDENTIFIERS.length
  ? `metafields(identifiers: [${PRODUCT_METAFIELD_IDENTIFIERS.map(
      (m) => `{namespace:"${m.namespace}",key:"${m.key}"}`,
    ).join(', ')}]) {
      namespace
      key
      value
      type
      # Resolve file/media references so metafields like fitdrip return the
      # actual URL, not just a gid://shopify/MediaImage/... reference.
      reference {
        ... on MediaImage { image { url altText } }
        ... on GenericFile { url }
      }
    }`
  : '';

const PRODUCT_FIELDS = `
  id
  title
  handle
  productType
  vendor
  featuredImage { url altText }
  ${metafieldsSelection}
`;

const LIST_QUERY = `
  query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges { node { ${PRODUCT_FIELDS} } }
      pageInfo { hasNextPage endCursor }
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
  // Local-dev only: log the Storefront response for debugging. Stripped from
  // production builds by the `import.meta.env.DEV` guard. The access token is in
  // the request headers and is never logged here.
  if (import.meta.env.DEV) {
    // console.log (not console.debug — DevTools hides "Verbose" by default).
    console.log('[storefront] response', {
      endpoint: endpoint(cfg),
      variables,
      errors: body.errors,
      data: body.data,
    });
  }
  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors[0]?.message ?? 'Storefront API returned errors');
  }
  return body.data;
}

// Storefront caps `first` at 250 per page, so a store with more products needs
// cursor pagination. `MAX_PRODUCTS` is a safety cap so a huge catalog can't loop
// forever / fetch unbounded pages into the picker.
const PAGE_SIZE = 250;
const MAX_PRODUCTS = 5000;

/** Raw product nodes from the `products` connection, paginated to fetch the
 *  whole catalog (up to MAX_PRODUCTS), not just the first 250. */
export async function storefrontListProductNodes(
  cfg: StorefrontConfig,
  opts: { query?: string } = {},
): Promise<unknown[]> {
  const all: unknown[] = [];
  let after: string | null = null;

  while (all.length < MAX_PRODUCTS) {
    const data = asRecord(
      await storefrontFetch(cfg, LIST_QUERY, {
        first: PAGE_SIZE,
        after,
        query: opts.query ?? null,
      }),
    );
    const products = asRecord(data?.products);
    const edges = products && Array.isArray(products.edges) ? products.edges : [];
    for (const e of edges) all.push(asRecord(e)?.node);

    const pageInfo = asRecord(products?.pageInfo);
    const endCursor =
      pageInfo && typeof pageInfo.endCursor === 'string'
        ? pageInfo.endCursor
        : null;
    if (pageInfo?.hasNextPage !== true || !endCursor || edges.length === 0) {
      break; // no more pages
    }
    after = endCursor;
  }

  return all;
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
