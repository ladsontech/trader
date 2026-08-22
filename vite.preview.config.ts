import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const here = path.resolve('.');

export default defineConfig({
  root: path.join(here, 'preview'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^.*\/lib\/auth-context$/, replacement: path.join(here, 'preview/mock-auth.tsx') },
      { find: /^.*\/lib\/api$/, replacement: path.join(here, 'preview/mock-api.ts') },
      { find: /^.*\/lib\/firebase$/, replacement: path.join(here, 'preview/mock-firebase.ts') },
    ],
  },
  server: { port: 4321, host: '127.0.0.1' },
});
