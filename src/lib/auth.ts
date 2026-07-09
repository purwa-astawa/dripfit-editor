// License-gate auth. The browser POSTs only the license key to `/api/verify`
// (same-origin → CloudFront → the verify Lambda); the Gumroad product id and the
// pass/fail decision live server-side, never in this bundle.
//
// This is a *soft* gate: the SPA and its assets are still publicly downloadable
// from S3/CloudFront, so a determined user can bypass it. It gates the UI for
// casual users, not the assets. A hard gate would need CloudFront signed cookies.

const UNLOCK_KEY = 'dripfit_access';
const EMAIL_KEY = 'dripfit_email';

// Local dev bypass: `npm run dev` has no `/api/verify` origin (that only exists
// on CloudFront in front of the Lambda), so the gate is skipped in DEV by
// default to keep local work unblocked. Set `VITE_AUTH_DEV_BYPASS=false` in
// `.env` to render the real gate locally (the verify fetch will still fail
// without a backend — useful only for eyeballing the screen).
export const DEV_BYPASS =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_DEV_BYPASS !== 'false';

export interface VerifyResult {
  authenticated: boolean;
  email?: string;
  error?: string;
}

export function isUnlocked(): boolean {
  if (DEV_BYPASS) return true;
  try {
    return localStorage.getItem(UNLOCK_KEY) === 'true';
  } catch {
    return false; // storage blocked (private mode) — treat as locked
  }
}

export function getEmail(): string | null {
  try {
    return localStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

function persistUnlock(email?: string): void {
  try {
    localStorage.setItem(UNLOCK_KEY, 'true');
    if (email) localStorage.setItem(EMAIL_KEY, email);
  } catch {
    // storage unavailable — the caller's in-memory state still unlocks the UI
    // for this session; the user re-enters the key next visit.
  }
}

export function lock(): void {
  try {
    localStorage.removeItem(UNLOCK_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    // nothing to clear
  }
}

export async function verifyLicense(licenseKey: string): Promise<VerifyResult> {
  const key = licenseKey.trim();
  if (!key) return { authenticated: false, error: 'Enter your license key.' };

  try {
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license_key: key }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      authenticated?: boolean;
      purchaser_email?: string;
      error?: string;
    };
    if (res.ok && data.authenticated) {
      persistUnlock(data.purchaser_email);
      return { authenticated: true, email: data.purchaser_email };
    }
    return {
      authenticated: false,
      error: data.error || 'That license key could not be verified.',
    };
  } catch {
    return { authenticated: false, error: 'Network error — please try again.' };
  }
}
