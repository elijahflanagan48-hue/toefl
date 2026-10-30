import { defineConfig } from 'vite';

// Relative base so the build works on GitHub Pages under any repo path.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', target: 'es2020' }
});
