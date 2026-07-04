#!/usr/bin/env bash
#
# Mint a public Shopify Storefront API access token from a custom / Dev Dashboard
# app's client credentials, for the DripFit editor's live product path.
#
# Credentials are read from .env (git-ignored) at the repo root:
#   SHOPIFY_SHOP_DOMAIN, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
#   SHOPIFY_API_VERSION (optional, default 2025-01)   -- see .env.example
#
# Requires: curl, jq.
# Usage:    ./scripts/get-storefront-token.sh
# Output:   the public Storefront access token on stdout (only that, on success).
#           Paste it into Configure -> "Storefront API access token".
#
# Note: each run creates a NEW token (Shopify allows up to 100 per shop) — reuse
# the printed token rather than re-running repeatedly.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

[ -f "$ENV_FILE" ] || { echo "error: $ENV_FILE not found (copy .env.example to .env and fill SHOPIFY_*)" >&2; exit 1; }
command -v jq >/dev/null || { echo "error: jq is required (brew install jq)" >&2; exit 1; }

# Read a single KEY=value from .env (last match wins), stripping quotes.
env_get() { grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"'\'''; }

SHOP="$(env_get SHOPIFY_SHOP_DOMAIN)"
CID="$(env_get SHOPIFY_CLIENT_ID)"
SECRET="$(env_get SHOPIFY_CLIENT_SECRET)"
VER="$(env_get SHOPIFY_API_VERSION)"; VER="${VER:-2025-01}"

# Normalize the shop host (accept protocol / trailing slash).
SHOP="${SHOP#https://}"; SHOP="${SHOP#http://}"; SHOP="${SHOP%/}"

[ -n "$SHOP" ]   || { echo "error: SHOPIFY_SHOP_DOMAIN missing in .env" >&2; exit 1; }
[ -n "$CID" ]    || { echo "error: SHOPIFY_CLIENT_ID missing in .env" >&2; exit 1; }
[ -n "$SECRET" ] || { echo "error: SHOPIFY_CLIENT_SECRET missing in .env" >&2; exit 1; }

# 1. Exchange client credentials for a short-lived Admin API token.
ADMIN="$(curl -s -X POST "https://$SHOP/admin/oauth/access_token" \
  -d "grant_type=client_credentials" \
  -d "client_id=$CID" \
  -d "client_secret=$SECRET")"
TOKEN="$(printf '%s' "$ADMIN" | jq -r '.access_token // empty')"
if [ -z "$TOKEN" ]; then
  echo "error: could not get admin token from client credentials:" >&2
  printf '%s\n' "$ADMIN" >&2
  exit 1
fi

# 2. Mint a public Storefront access token via storefrontAccessTokenCreate.
RESP="$(curl -s -X POST "https://$SHOP/admin/api/$VER/graphql.json" \
  -H "X-Shopify-Access-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation{storefrontAccessTokenCreate(input:{title:\"DripFit Lab\"}){storefrontAccessToken{accessToken} userErrors{field message}}}"}')"
SF="$(printf '%s' "$RESP" | jq -r '.data.storefrontAccessTokenCreate.storefrontAccessToken.accessToken // empty')"
if [ -z "$SF" ]; then
  echo "error: could not mint storefront token:" >&2
  printf '%s\n' "$RESP" | jq -c '.data.storefrontAccessTokenCreate.userErrors // .errors // .' >&2 2>/dev/null || printf '%s\n' "$RESP" >&2
  exit 1
fi

printf '%s\n' "$SF"
