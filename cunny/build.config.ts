// Example build config for TypeScript ESM backend using tsup
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  shims: false,
  esbuildOptions(options) {
    options.platform = 'node';
  },
});
