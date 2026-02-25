import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [react()],
  resolve: isDev
    ? {
        alias: {
          'pdf-search-highlight/react': path.resolve(__dirname, '../../src/react/index.ts'),
          'pdf-search-highlight/styles.css': path.resolve(__dirname, '../../src/styles/pdf-search-highlight.css'),
          'pdf-search-highlight': path.resolve(__dirname, '../../src/core/index.ts'),
        },
      }
    : {},
});
