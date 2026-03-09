import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      preview: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['mbr.nyxagency.com', 'nyx-web.onrender.com']
      },
      plugins: [react()],
      // SECURITY: Gemini API key removed from client bundle.
      // AI calls should be proxied through the API server instead.
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
