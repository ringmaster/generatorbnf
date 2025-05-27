import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  server: {
    port: 3000,
    open: '/demo.html',
    watch: {
      // Watch for changes in these directories
      include: ['src/**', 'public/**', '*.html']
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      // Could be ESM/CJS/UMD/IIFE
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'TextGeneratorBNF',
      fileName: (format) => `index.${format}.js`
    },
    sourcemap: true,
    // Ensure assets are properly resolved
    assetsDir: 'assets'
  },
  optimizeDeps: {
    include: []
  }
});