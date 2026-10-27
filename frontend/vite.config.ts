import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 8080,
      host: true,
      proxy: {
        '/api/cloudrun': {
          target: env.AGENT_API_URL || env.VITE_AGENT_API_URL || 'https://atlanta-heat-advisor-1004921377034.us-central1.run.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/cloudrun/, ''),
        },
      },
    },
    preview: {
      port: 8080,
      host: true,
      proxy: {
        '/api/cloudrun': {
          target: env.AGENT_API_URL || env.VITE_AGENT_API_URL || 'https://atlanta-heat-advisor-1004921377034.us-central1.run.app',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/cloudrun/, ''),
        },
      },
    },
  };
});
