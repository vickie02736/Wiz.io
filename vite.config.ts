import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/Wiz.io/',
  plugins: [react()],
  build: { outDir: 'docs', emptyOutDir: true, chunkSizeWarningLimit: 6000 },
  worker: { format: 'es' },
});
