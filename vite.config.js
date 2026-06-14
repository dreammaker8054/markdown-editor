import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/markdown-editor/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        guide: resolve(__dirname, 'guide.html')
      }
    }
  }
});
