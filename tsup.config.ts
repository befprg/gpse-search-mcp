import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['esm'],
  target: 'node20',
  noExternal: ['@modelcontextprotocol/sdk'],
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  dts: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
