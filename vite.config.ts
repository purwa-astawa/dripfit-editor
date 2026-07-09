import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
//
// Fixed dev/preview ports so the editor, visualizer, and shopify-demo-store can
// all run at once without collisions. See DripFitLab/shared-knowledge/local-dev-ports.md.
// `strictPort` fails loudly if the port is taken instead of silently drifting.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
