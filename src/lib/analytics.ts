// Lazily initialize PostHog. `posthog-js` is imported dynamically (its own Vite
// chunk) only when this runs, so it never bloats the initial bundle or blocks
// first paint. Autocapture / pageviews work at the posthog-js level — no React
// provider is needed until we use PostHog hooks/components.

let started = false;

export function initPostHog(): void {
  if (started) return;
  const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
  if (!token) return; // no token configured — skip analytics
  started = true;

  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(token, {
        api_host: import.meta.env.VITE_POSTHOG_HOST,
        defaults: '2026-05-30',
      });
    })
    .catch(() => {
      started = false; // allow a retry if the chunk failed to load
    });
}
