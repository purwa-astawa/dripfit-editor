# Deployment

`dripfit-editor` deploys automatically to **S3 + CloudFront** on every push to
`main`, via the GitHub Actions workflow in
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

The pipeline: `npm ci` → `npm run check` → `npm run build` → upload `dist/` to S3
→ invalidate CloudFront. GitHub authenticates to AWS with **OIDC** (a short-lived
assumed role), so **no AWS keys are stored in GitHub**.

This doc is the reproducibility record for the one-time AWS + GitHub setup.

---

## Placeholders used below

| Placeholder | Example | Notes |
|-------------|---------|-------|
| `<REGION>` | `ap-southeast-2` | AWS region for the bucket. |
| `<BUCKET>` | `dripfit-editor-web` | Globally-unique S3 bucket name. |
| `<ACCOUNT_ID>` | `123456789012` | Your AWS account ID. |
| `<DIST_ID>` | `E1ABCDEF2GHIJ` | CloudFront distribution ID (after creation). |
| `<ROLE_ARN>` | `arn:aws:iam::123456789012:role/dripfit-editor-gha-deploy` | Deploy role ARN. |

GitHub repo: `purwa-astawa/dripfit-editor`, deploy branch: `main`.

---

## Part A — One-time AWS setup

### 1. Private S3 bucket

```bash
aws s3api create-bucket \
  --bucket <BUCKET> \
  --region <REGION> \
  --create-bucket-configuration LocationConstraint=<REGION>

# Keep all public access blocked — CloudFront reaches the bucket via OAC.
aws s3api put-public-access-block \
  --bucket <BUCKET> \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

> Note: `us-east-1` does not accept `LocationConstraint` — drop the
> `--create-bucket-configuration` flag there.

### 2. CloudFront distribution (with Origin Access Control)

Easiest via the console (**CloudFront → Create distribution**):

- **Origin domain**: select the `<BUCKET>` S3 bucket.
- **Origin access**: *Origin access control settings (recommended)* → create a new
  OAC. CloudFront shows a **bucket policy to copy** — apply it to `<BUCKET>` (it
  grants `s3:GetObject` only to this distribution). See policy below.
- **Default root object**: `index.html`.
- **Viewer protocol policy**: Redirect HTTP to HTTPS.
- After creation, **Error pages** → add two custom error responses so the SPA is
  served for unknown paths (harmless today, future-proof for client routing):
  - HTTP `403` → response page `/index.html`, response code `200`.
  - HTTP `404` → response page `/index.html`, response code `200`.

Record the **Distribution ID** (`<DIST_ID>`).

The OAC bucket policy (CloudFront generates this for you — shown here for
reference):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::<BUCKET>/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DIST_ID>"
        }
      }
    }
  ]
}
```

### 3. GitHub OIDC provider in IAM (once per AWS account)

Skip if it already exists (`aws iam list-open-id-connect-providers`).

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

### 4. IAM deploy role

**Trust policy** — `trust-policy.json` (locks assumption to this repo + `main`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:purwa-astawa/dripfit-editor:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

**Permissions policy** — `deploy-policy.json` (least privilege):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3List",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<BUCKET>"
    },
    {
      "Sid": "S3Write",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::<BUCKET>/*"
    },
    {
      "Sid": "CloudFrontInvalidate",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DIST_ID>"
    }
  ]
}
```

Create the role and attach the policy:

```bash
aws iam create-role \
  --role-name dripfit-editor-gha-deploy \
  --assume-role-policy-document file://trust-policy.json

aws iam put-role-policy \
  --role-name dripfit-editor-gha-deploy \
  --policy-name dripfit-editor-deploy \
  --policy-document file://deploy-policy.json
```

Record the **role ARN** (`<ROLE_ARN>`): `aws iam get-role --role-name dripfit-editor-gha-deploy --query Role.Arn --output text`.

---

## Part B — GitHub repo configuration

**Settings → Secrets and variables → Actions → Variables** (all non-secret — they
are identifiers or public keys, so use *Variables*, not *Secrets*):

| Variable | Value |
|----------|-------|
| `AWS_REGION` | `<REGION>` |
| `AWS_DEPLOY_ROLE_ARN` | `<ROLE_ARN>` |
| `S3_BUCKET` | `<BUCKET>` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `<DIST_ID>` |
| `VITE_POSTHOG_PROJECT_TOKEN` | public PostHog project token *(optional)* |
| `VITE_POSTHOG_HOST` | e.g. `https://us.i.posthog.com` *(optional)* |

No **Secrets** are required — OIDC replaces stored AWS keys. Omit the two
`VITE_POSTHOG_*` vars to ship without analytics.

---

## Part C — Custom domain (Hostinger)

This editor is served at **`dripfit-builder.garusin.com`** (the Visualiser is a
separate S3 bucket + distribution at `dripfit.garusin.com`). Both are
**subdomains**, so DNS is a simple `CNAME` per subdomain — no Route 53 / apex
handling needed. The domain points at **CloudFront**, not S3 (the bucket is
private behind OAC; CloudFront terminates HTTPS).

### 1. Certificate — one wildcard cert for all `*.garusin.com`

CloudFront only accepts certs from **`us-east-1`**, regardless of the bucket
region. Request one wildcard cert and reuse it across both distributions:

- ACM (**us-east-1**) → **Request certificate** (public) → domain name
  `*.garusin.com`.
- Choose **DNS validation** → ACM shows one CNAME validation record. Add it in
  Hostinger (**hPanel → Domains → DNS / Nameservers → Manage DNS records**).
- Wait until the cert shows **Issued**.

### 2. Attach the domain + cert to this distribution

Edit the editor's CloudFront distribution → **Settings**:
- **Alternate domain names (CNAMEs)**: add `dripfit-builder.garusin.com`.
- **Custom SSL certificate**: select the `*.garusin.com` ACM cert.
- Save and wait for the distribution to redeploy. Note its domain, e.g.
  `d1abcd2efgh3.cloudfront.net`.

### 3. Point Hostinger DNS at CloudFront

In Hostinger **Manage DNS records**, add:

| Type | Name | Target (Points to) | TTL |
|------|------|--------------------|-----|
| `CNAME` | `dripfit-builder` | `d1abcd2efgh3.cloudfront.net` | default |

(The Visualiser gets its own `CNAME` `dripfit` → its own distribution, using the
same wildcard cert.)

### 4. Test

After DNS propagates (minutes–couple hours), open
`https://dripfit-builder.garusin.com` — the app loads over HTTPS via CloudFront.
The `403/404 → index.html` error responses still apply on the custom domain.

> The GitHub Actions pipeline is unchanged — it deploys to the same bucket /
> distribution regardless of the domain in front.

---

## Part D — License gate (Gumroad + verify Lambda)

The editor is gated behind a **Gumroad license key**. The SPA POSTs the key to a
same-origin `/api/verify`, which CloudFront routes to a small **AWS Lambda**
(source: [`infra/verify-lambda/index.mjs`](../infra/verify-lambda/index.mjs))
that verifies the key against the Gumroad API server-side. The Gumroad
`product_id` and the pass/fail decision live only in the Lambda, never in the
browser bundle.

> **Soft gate, by design.** The assets stay publicly downloadable from
> CloudFront/S3, so this gates the *UI* for casual users — it is not hard access
> control. A hard gate would require CloudFront **signed cookies** (a trusted key
> group + a restricted default behavior); out of scope here.

This is a **one-time manual setup**, separate from the GitHub Actions pipeline
(the deploy role only writes S3 + invalidates CloudFront — it does not touch
Lambda). New placeholders: `<FN_URL_HOST>` (the Function URL host, e.g.
`abc123.lambda-url.<REGION>.on.aws`), `<GUMROAD_PRODUCT_ID>`.

### 1. Gumroad — enable license keys

- Product → **Checkout** tab → enable **"Generate a unique license key per
  sale."**
- Record the product's **`product_id`** (used as `GUMROAD_PRODUCT_ID` below). The
  buyer receives a **license key** per sale (in the receipt email + their Gumroad
  Library); they can self-recover it at `gumroad.com/license-key-lookup`.

### 2. Deploy the verify Lambda

Node 20+ runtime (global `fetch`; no dependencies — a single `index.mjs`).

```bash
cd infra/verify-lambda
zip -r function.zip index.mjs

aws lambda create-function \
  --function-name dripfit-verify-license \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role <LAMBDA_EXEC_ROLE_ARN> \
  --environment "Variables={GUMROAD_PRODUCT_ID=<GUMROAD_PRODUCT_ID>}" \
  --region <REGION>
```

`<LAMBDA_EXEC_ROLE_ARN>` is a basic Lambda execution role (the AWS-managed
`AWSLambdaBasicExecutionRole` policy is enough — it only needs CloudWatch Logs;
no S3/CloudFront access). Update later with:

```bash
aws lambda update-function-code --function-name dripfit-verify-license \
  --zip-file fileb://function.zip --region <REGION>
```

### 3. Function URL (CloudFront is the only caller)

```bash
aws lambda create-function-url-config \
  --function-name dripfit-verify-license \
  --auth-type NONE \
  --region <REGION>

# Allow public invoke of the URL (CloudFront calls it unsigned; the function
# itself validates every request).
aws lambda add-permission \
  --function-name dripfit-verify-license \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE \
  --region <REGION>
```

Record the Function URL host as `<FN_URL_HOST>`.

### 4. CloudFront — route `/api/verify` to the Lambda

On the editor's distribution:

- **Origins** → **Create origin**: origin domain `<FN_URL_HOST>`, protocol
  **HTTPS only**. **Recommended:** add a **custom header** `x-origin-secret` with
  a random value, and set the same value as the Lambda's `CF_SHARED_SECRET` env
  var. The Function URL is public (`auth-type NONE`), so without this a caller
  who discovers `<FN_URL_HOST>` can hit the Lambda directly and bypass
  CloudFront; the header lets the Lambda reject anything not fronted by
  CloudFront (it returns 403 on mismatch). Set the env with:

  ```bash
  aws lambda update-function-configuration \
    --function-name dripfit-verify-license \
    --environment "Variables={GUMROAD_PRODUCT_ID=<GUMROAD_PRODUCT_ID>,CF_SHARED_SECRET=<RANDOM>}" \
    --region <REGION>
  ```
- **Behaviors** → **Create behavior**:
  - **Path pattern**: `/api/verify`
  - **Origin**: the Function URL origin above.
  - **Viewer protocol policy**: Redirect HTTP to HTTPS.
  - **Allowed methods**: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** (POST
    must be allowed).
  - **Cache policy**: **CachingDisabled** (never cache auth responses).
  - **Origin request policy**: **AllViewerExceptHostHeader** (forwards the body;
    the Function URL rejects a mismatched `Host`).
- Precedence: this behavior must sit **above** the default `*` behavior.

> The `403/404 → /index.html` custom error responses (Part A) apply to the SPA
> paths, not `/api/verify` — the Lambda returns real 4xx/5xx JSON.

### 5. Test

```bash
# Bad key → 401 { "authenticated": false, ... }
curl -sS -X POST https://dripfit-builder.garusin.com/api/verify \
  -H 'content-type: application/json' \
  -d '{"license_key":"not-a-real-key"}'
```

A real purchased key returns `{ "authenticated": true, "purchaser_email": "…" }`.

> **Local dev**: `npm run dev` has no `/api/verify` origin, so the gate is
> auto-bypassed in DEV (`VITE_AUTH_DEV_BYPASS`, default `true`). See
> `.env.example`.

---

## How it works

- **Trigger**: push to `main` (or run the workflow manually via *Actions →
  Deploy to S3 + CloudFront → Run workflow*).
- **Caching (two passes)**: `dist/assets/*` (content-hashed filenames) upload with
  `Cache-Control: public,max-age=31536000,immutable`; `index.html` and the other
  non-hashed root files (`logo.png`, `vite.svg`, `mock-fashion-products.json`, …)
  upload with `no-cache` so browsers revalidate them — they keep stable names
  between builds, so pinning them would serve stale content.
- **`--delete`** on each pass prunes files from previous builds (scoped per prefix
  so the two passes never delete each other's objects).
- **Invalidation**: `--paths "/*"` after upload clears CloudFront's edge cache so
  the new build serves immediately (one path → within the free 1,000/month).

## Troubleshooting

- **`configure-aws-credentials` fails / "Not authorized to perform
  sts:AssumeRoleWithWebIdentity"** — the trust policy `sub` must match exactly:
  `repo:purwa-astawa/dripfit-editor:ref:refs/heads/main`. Check for a renamed repo
  or deploying from a different branch.
- **403 from the site** — the OAC bucket policy isn't applied, or `<DIST_ID>` /
  `<ACCOUNT_ID>` in it is wrong.
- **Old version still served after deploy** — confirm the invalidation step ran;
  hard-refresh; verify `index.html` was uploaded with `no-cache`.
- **AccessDenied on S3/CloudFront in the run** — the deploy role's permission
  policy bucket/distribution ARNs don't match the actual resources.

## Out of scope (not configured here)

- Naked apex `garusin.com` (only subdomains are used — see Part C).
- PR preview / per-branch environments.
- Infrastructure-as-code — infra is created manually; this doc is the record.
