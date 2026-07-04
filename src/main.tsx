import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initPostHog } from './lib/analytics';

// Dev-only: expose the store on window for debugging / manual poking in the
// console (e.g. window.__editorStore.getState()). Stripped from production.
if (import.meta.env.DEV) {
  import('./store/editorStore').then(({ useEditorStore }) => {
    (window as unknown as Record<string, unknown>).__editorStore =
      useEditorStore;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Load analytics lazily after first paint / when the browser is idle, so
// posthog-js stays in its own chunk and never blocks the initial render.
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => initPostHog());
} else {
  setTimeout(initPostHog, 1500);
}
