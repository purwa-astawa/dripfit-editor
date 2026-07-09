// AWS Lambda (Node 20, ESM) behind a Function URL, wired as the `/api/verify`
// origin on the CloudFront distribution. It verifies a Gumroad license key
// server-side so the product id — and the verify *decision* — never live in the
// public client bundle where they could be read or tampered with.
//
// Env:
//   GUMROAD_PRODUCT_ID  (required) — the product's Gumroad `product_id`.
//   CF_SHARED_SECRET    (optional) — when set, the request must carry a matching
//                       `x-origin-secret` header. CloudFront injects it as a
//                       custom origin header so the public Function URL can't be
//                       invoked directly (bypassing CloudFront). No-op if unset.
//
// The browser sends only `{ license_key }`; the product id is added here. See
// docs/deploy.md "Part D" for the one-time AWS setup (Function URL + the
// CloudFront behavior that routes POST /api/verify here).

const GUMROAD_VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  // Function URL events use requestContext.http.method; fall back for safety.
  const method =
    event?.requestContext?.http?.method ?? event?.httpMethod ?? 'GET';
  if (method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // Reject direct hits on the Function URL that don't come through CloudFront.
  // Function URL headers are lower-cased in the event.
  const expectedSecret = process.env.CF_SHARED_SECRET;
  if (expectedSecret && event?.headers?.['x-origin-secret'] !== expectedSecret) {
    return json(403, { error: 'Forbidden' });
  }

  const productId = process.env.GUMROAD_PRODUCT_ID;
  if (!productId) {
    // Misconfiguration — fail closed, and don't leak the reason to the client.
    console.error('GUMROAD_PRODUCT_ID is not set');
    return json(500, { error: 'Server not configured' });
  }

  let licenseKey;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
      : event.body ?? '';
    ({ license_key: licenseKey } = JSON.parse(raw || '{}'));
  } catch {
    return json(400, { error: 'Invalid request body' });
  }

  if (!licenseKey || typeof licenseKey !== 'string') {
    return json(400, { error: 'Missing license key' });
  }

  let data;
  try {
    const res = await fetch(GUMROAD_VERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        product_id: productId,
        license_key: licenseKey.trim(),
        // Read-only check — don't bump Gumroad's usage counter on every login.
        increment_uses_count: 'false',
      }),
    });
    // Gumroad returns 404 + { success: false } for an unknown key; still JSON.
    data = await res.json();
  } catch (err) {
    console.error('Gumroad verify call failed', err);
    return json(502, { error: 'Verification service unavailable' });
  }

  const purchase = data?.purchase ?? {};
  const valid =
    data?.success === true &&
    !purchase.refunded &&
    !purchase.chargebacked &&
    !purchase.disputed &&
    // Subscription products set these when access has lapsed; they are absent
    // (falsy) for one-off purchases, so the check is safe for both.
    !purchase.subscription_cancelled_at &&
    !purchase.subscription_failed_at;

  if (valid) {
    return json(200, { authenticated: true, purchaser_email: purchase.email });
  }

  return json(401, {
    authenticated: false,
    error: 'Invalid, refunded, or deactivated license key',
  });
};
