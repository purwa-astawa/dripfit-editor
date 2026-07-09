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
same-origin `/api/verify`, which CloudFront routes to an **API Gateway HTTP API**
that fronts a small **AWS Lambda**
(source: [`infra/verify-lambda/index.mjs`](../infra/verify-lambda/index.mjs))
that verifies the key against the Gumroad API server-side. The Gumroad
`product_id` and the pass/fail decision live only in the Lambda, never in the
browser bundle.

> **Soft gate, by design.** The assets stay publicly downloadable from
> CloudFront/S3, so this gates the *UI* for casual users — it is not hard access
> control. A hard gate would require CloudFront **signed cookies** (a trusted key
> group + a restricted default behavior); out of scope here.

> **Why API Gateway and not a bare Lambda Function URL?** The verify call is a
> `POST` with a JSON body, and both "Lambda URL behind CloudFront" patterns fail
> for that here: (a) a **public** Function URL (`auth-type NONE`) is **blocked at
> the account level** in this AWS account — every direct call 403s at the
> Function-URL auth layer even with a textbook public resource policy; (b)
> **CloudFront OAC** (`AWS_IAM`) [does **not** sign POST/PUT
> bodies](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html),
> so the signature fails and Lambda returns `AccessDenied`. An API Gateway HTTP
> API proxies the POST body natively and its public endpoint is unaffected by the
> Function-URL block, so CloudFront → API Gateway → Lambda is the working path.

This is a **one-time manual setup**, separate from the GitHub Actions pipeline
(the deploy role only writes S3 + invalidates CloudFront — it does not touch
Lambda or API Gateway). New placeholders: `<API_ID>` (the API Gateway id, e.g.
`abc123xyz`), `<GUMROAD_PRODUCT_ID>`, `<REGION>`.

> **As deployed (`us-east-1`):** Lambda `dripfit-verify-license` (exec role
> `dripfit-verify-license-exec`), an API Gateway HTTP API (route `POST
> /api/verify`, `$default` stage), and the editor's CloudFront distribution
> (origin `lambda-verify-origin` → the API Gateway domain, custom header
> `x-origin-secret`). The concrete account id, `<API_ID>`, and `<DIST_ID>` for the
> live deployment are recorded in the ops notes, not committed here.
> `GUMROAD_PRODUCT_ID` is the Gumroad **product_id** (see step 1), **not** the
> `/l/<permalink>` URL slug; the `CF_SHARED_SECRET` value lives only in the Lambda
> env + the CloudFront custom header, never in git.

### 1. Gumroad — enable license keys

- Product → **Checkout** tab → enable **"Generate a unique license key per
  sale."**
- Record the product's **`product_id`** (used as `GUMROAD_PRODUCT_ID` below).
  Find it under **Product → Share → API** — it is a short base64-ish token like
  `qOi3W8U8WyV14cv4C26_Ww==`. **It is not** the `/l/<slug>` permalink from the
  product URL (e.g. `pdxdio`); the permalink only works as a legacy fallback for
  pre-2023 products, so always use the real `product_id`. The buyer receives a
  **license key** per sale (in the receipt email + their Gumroad Library); they
  can self-recover it at `gumroad.com/license-key-lookup`.

### 2. Deploy the verify Lambda

Node 20+ runtime (global `fetch`; no dependencies — a single `index.mjs`).

First, a basic execution role (CloudWatch Logs only — no S3/CloudFront/Lambda
access needed):

```bash
aws iam create-role --role-name dripfit-verify-license-exec \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name dripfit-verify-license-exec \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

> A freshly created IAM role is not immediately assumable (eventual consistency),
> so `create-function` right after may fail with *"The role defined for the
> function cannot be assumed by Lambda."* Wait ~10s, or just re-run
> `create-function` until it succeeds.

Then the function (fill in `<ACCOUNT_ID>` / `<REGION>`):

```bash
cd infra/verify-lambda
zip -r function.zip index.mjs

aws lambda create-function \
  --function-name dripfit-verify-license \
  --runtime nodejs20.x \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --role arn:aws:iam::<ACCOUNT_ID>:role/dripfit-verify-license-exec \
  --timeout 10 --memory-size 128 \
  --environment "Variables={GUMROAD_PRODUCT_ID=<GUMROAD_PRODUCT_ID>}" \
  --region <REGION>
```

`CF_SHARED_SECRET` is added in step 4 (once the secret is chosen). Update the code
later with:

```bash
aws lambda update-function-code --function-name dripfit-verify-license \
  --zip-file fileb://function.zip --region <REGION>
```

### 3. API Gateway HTTP API in front of the Lambda

An HTTP API with a Lambda proxy integration (payload format 2.0 — matches the
event shape the Lambda already reads). CloudFront is the intended only caller;
the `x-origin-secret` header (step 4) is what actually enforces that.

> Run this block **as one shell session** — `$LAMBDA_ARN`, `$API_ID`, and
> `$INT_ID` are captured by earlier commands and reused by later ones. Substitute
> the `<REGION>` / `<ACCOUNT_ID>` placeholders **first**; only the `$...` values
> are meant to carry over from the captures above.

```bash
LAMBDA_ARN=$(aws lambda get-function --function-name dripfit-verify-license \
  --region <REGION> --query 'Configuration.FunctionArn' --output text)

API_ID=$(aws apigatewayv2 create-api --name dripfit-verify-api \
  --protocol-type HTTP --region <REGION> --query 'ApiId' --output text)

INT_ID=$(aws apigatewayv2 create-integration --api-id "$API_ID" \
  --integration-type AWS_PROXY --integration-uri "$LAMBDA_ARN" \
  --integration-method POST --payload-format-version 2.0 \
  --region <REGION> --query 'IntegrationId' --output text)

aws apigatewayv2 create-route --api-id "$API_ID" \
  --route-key 'POST /api/verify' --target "integrations/$INT_ID" --region <REGION>

aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' \
  --auto-deploy --region <REGION>

# Let API Gateway invoke the Lambda.
aws lambda add-permission --function-name dripfit-verify-license \
  --statement-id AllowApiGatewayInvoke --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:<REGION>:<ACCOUNT_ID>:$API_ID/*/*" \
  --region <REGION>
```

The invoke endpoint is `https://<API_ID>.execute-api.<REGION>.amazonaws.com`
(the `$default` stage has no path prefix), so `POST /api/verify` lands directly
on the route. Record `<API_ID>`.

### 4. CloudFront — route `/api/verify` to API Gateway

Pick a random `CF_SHARED_SECRET` (e.g. `openssl rand -hex 24`) and set it on the
Lambda — the function rejects any request whose `x-origin-secret` header doesn't
match, so a caller who discovers the public API Gateway URL still can't use it:

```bash
aws lambda update-function-configuration \
  --function-name dripfit-verify-license \
  --environment "Variables={GUMROAD_PRODUCT_ID=<GUMROAD_PRODUCT_ID>,CF_SHARED_SECRET=<RANDOM>}" \
  --region <REGION>
```

On the editor's distribution:

- **Origins** → **Create origin**: origin domain
  `<API_ID>.execute-api.<REGION>.amazonaws.com`, protocol **HTTPS only**. Add a
  **custom header** `x-origin-secret` = the same `<RANDOM>` value as above.

  > ⚠️ This value **must match the Lambda's `CF_SHARED_SECRET` byte-for-byte.**
  > Since the secret is now always set, a typo or missing header makes the Lambda
  > return `403` for **every** request through CloudFront — a full lockout of all
  > real users, not just a weaker gate. If verify returns 403 with
  > `{"error":"Forbidden"}` (the Lambda's own body, not an API Gateway/CloudFront
  > error), suspect a secret mismatch first.
- **Behaviors** → **Create behavior**:
  - **Path pattern**: `/api/verify`
  - **Origin**: the API Gateway origin above.
  - **Viewer protocol policy**: Redirect HTTP to HTTPS.
  - **Allowed methods**: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** (POST
    must be allowed).
  - **Cache policy**: **CachingDisabled** (never cache auth responses).
  - **Origin request policy**: **AllViewerExceptHostHeader** (forwards the body;
    the `Host` header must not be pinned to the origin).
- Precedence: this behavior must sit **above** the default `*` behavior.

> Do **not** attach an Origin Access Control to this origin — OAC's SigV4 signing
> does not cover POST/PUT bodies, which would break the verify call.

> The `403/404 → /index.html` custom error responses (Part A) apply to the SPA
> paths, not `/api/verify` — the Lambda returns real 4xx/5xx JSON.

### 5. Test

Wait for the distribution to finish deploying
(`aws cloudfront wait distribution-deployed --id <DIST_ID>`), then (the live
editor is served at `https://dripfit-builder.garusin.com`; substitute your own
`dxxxx.cloudfront.net` default domain or alias if different):

```bash
# Through CloudFront: bad key → 401 { "authenticated": false, ... }
curl -sS -X POST https://dripfit-builder.garusin.com/api/verify \
  -H 'content-type: application/json' \
  -d '{"license_key":"not-a-real-key"}'

# Security check — direct API Gateway hit WITHOUT the secret header → 403
# { "error": "Forbidden" } (proves only CloudFront can use it):
curl -sS -X POST https://<API_ID>.execute-api.<REGION>.amazonaws.com/api/verify \
  -H 'content-type: application/json' -d '{"license_key":"x"}'
```

A real purchased key returns `{ "authenticated": true, "purchaser_email": "…" }`.
(Gumroad returns the same "license does not exist" message for a bad key and an
unknown product, so a bad-key 401 confirms the wiring but **not** that
`GUMROAD_PRODUCT_ID` is correct — only a real key proves that end-to-end.)

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
