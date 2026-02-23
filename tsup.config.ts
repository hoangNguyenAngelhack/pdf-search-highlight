import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'core/index': 'src/core/index.ts',
    'react/index': 'src/react/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  splitting: true,
  clean: true,
  external: ['react', 'react-dom', 'pdfjs-dist'],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
