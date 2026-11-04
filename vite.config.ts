import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // PGlite 需要讀取自己的 WASM 與資料檔，不能被預先打包
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
