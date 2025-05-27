const { build } = require('esbuild');

// Build for browser as a simple global
build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: 'dist/index.js',
  format: 'iife',
  globalName: 'GeneratorBNF',
  target: ['es2018'],
}).catch(() => process.exit(1));

console.log('Build complete!');