import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function normalizeViteBase(p: string | undefined): string {
  if (!p || p === '/') return '/';
  if (p.includes('Program Files')) {
    throw new Error('MSYS2 path corruption detected on BASE_PATH: ' + p + '. Use PowerShell to build.');
  }
  return p.replace(/\/$/, '') + '/';
}

const API_PROXY_TARGET = process.env.VITE_API_PROXY_URL || 'http://localhost:11080';

function buildProxyConfig(): Record<string, any> {
  const proxy: Record<string, any> = {};

  const passThroughPrefixes = [
    '/api/v1/',
    '/identity/',
    '/tenant/',
    '/audit/',
    '/billing/api/v1/billing/',
    '/compliance/api/v1/compliance/',
    '/storage/api/v1/storage/',
    '/wallet/api/v1/wallet/',
    '/session/',
    '/mfa/api/v1/mfa/',
    '/notification/',
    '/communication/api/v1/communication/',
    '/point/',
    '/profile/api/v1/profile/',
    '/status/api/v1/status/',
    '/oauth/api/v1/oauth/',
    '/.well-known/',
    '/bff',
    '/developer',
  ];

  for (const prefix of passThroughPrefixes) {
    proxy[prefix] = {
      target: API_PROXY_TARGET,
      changeOrigin: true,
    };
  }

  return proxy;
}

export default defineConfig(({ command, mode }) => {
  // 生产构建必须注入 Grafana 基址（ops 页 iframe）；缺失即 fail-build，
  // 禁止静默回落到 localhost 在线上呈现空白面板（PL-56）。
  if (command === 'build') {
    const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
    if (!env.VITE_GRAFANA_URL) {
      throw new Error(
        'VITE_GRAFANA_URL is required for production builds: the ops page embeds Grafana iframes. ' +
          'Set it in the deployment environment (e.g. Vercel project env) before building; ' +
          'a localhost fallback would render blank panels in production.',
      );
    }
  }

  return {
    plugins: [react()],
    base: normalizeViteBase(process.env.BASE_PATH),
    resolve: {
      extensions: ['.mjs', '.tsx', '.ts', '.jsx', '.js', '.json'],
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      port: 13110,
      proxy: buildProxyConfig(),
    },
    preview: {
      port: 13110,
      proxy: buildProxyConfig(),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router'],
            'vendor-ui': ['antd', 'lucide-react'],
            'vendor-charts': ['recharts'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-i18n': ['i18next', 'react-i18next'],
            'shared-api': ['@autional/shared'],
          },
        },
      },
    },
  };
});
