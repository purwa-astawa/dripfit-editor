import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

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
