import { useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { isUnlocked, verifyLicense } from '../../lib/auth';

// Gumroad's self-serve "What is my license key?" tool — buyers enter their
// purchase email and Gumroad re-sends their key(s). Cuts lost-key support.
const LICENSE_LOOKUP_URL = 'https://gumroad.com/license-key-lookup';

/**
 * Soft license gate. Renders `children` once a Gumroad license key has been
 * verified (via /api/verify) or the unlock flag is already stored; otherwise
 * shows a full-screen license entry screen. Not a hard access control — the
 * bundle is still publicly downloadable (see src/lib/auth.ts).
 */
export function LicenseGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => isUnlocked());
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return <>{children}</>;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (status === 'verifying') return;
    setStatus('verifying');
    setError(null);
    const result = await verifyLicense(key);
    if (result.authenticated) {
      setUnlocked(true);
    } else {
      setError(result.error ?? 'Verification failed.');
      setStatus('idle');
    }
  }

  const verifying = status === 'verifying';

  return (
    <div className="flex h-full flex-col items-center justify-center bg-slate-100 px-6 text-center">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
          <KeyRound size={24} strokeWidth={1.5} className="text-blue-600" />
        </div>
        <h1 className="text-lg font-semibold text-slate-800">DripFit Lab</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your license key to unlock the editor.
        </p>

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={verifying}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-center font-mono text-sm tracking-tight text-slate-800 placeholder:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
          />

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-left text-xs text-red-600">
              <AlertCircle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || !key.trim()}
            className="flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verifying ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Verifying…
              </>
            ) : (
              'Unlock'
            )}
          </button>
        </form>

        <a
          href={LICENSE_LOOKUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
        >
          Where&rsquo;s my license key?
          <ExternalLink size={12} strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}
