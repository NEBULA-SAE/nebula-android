import { defineConfig, type ProxyOptions } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import dns from 'node:dns';
import https from 'node:https';

// Принудительно используем IPv4, чтобы прокси не зависал на IPv6-маршрутах
dns.setDefaultResultOrder('ipv4first');
const ipv4Agent = new https.Agent({ family: 4, keepAlive: true });

function proxyRule(
  target: string,
  prefix: string,
  rewriteTo = '',
  extra: Partial<ProxyOptions> = {}
): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    secure: true,
    agent: ipv4Agent,
    cookieDomainRewrite: '',
    timeout: 10000,
    proxyTimeout: 10000,
    rewrite: (p) => p.replace(new RegExp(`^${prefix}`), rewriteTo),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        proxyReq.removeHeader('origin');
        proxyReq.removeHeader('referer');
        proxyReq.setHeader(
          'user-agent',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        );
      });
    },
    ...extra,
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@platform': fileURLToPath(new URL('./src/platform', import.meta.url)),
    },
  },

  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: false,
    open: false,
    proxy: {
      // ─── GetBlock ───
      '/proxy/getblock': proxyRule('https://dash.getblock.io', '/proxy/getblock'),
      '/proxy/gb-go': proxyRule('https://go.getblock.io', '/proxy/gb-go'),
      '/proxy/gb-shared': proxyRule('https://shared.eu-central-1.getblock.io', '/proxy/gb-shared'),

      // ─── Биржи (spot) ───
      '/proxy/mexc': proxyRule('https://api.mexc.com', '/proxy/mexc'),
      '/proxy/binance-spot': proxyRule('https://api.binance.com', '/proxy/binance-spot'),
      '/proxy/okx': proxyRule('https://www.okx.com', '/proxy/okx'),
      '/proxy/gateio': proxyRule('https://api.gateio.ws', '/proxy/gateio'),
      '/proxy/bybit': proxyRule('https://api.bybit.com', '/proxy/bybit'),

      // ─── KuCoin ───
      '/proxy/kucoin': proxyRule('https://api.kucoin.com', '/proxy/kucoin'),
      '/proxy/kucoin-futures': proxyRule('https://api-futures.kucoin.com', '/proxy/kucoin-futures'),
      '/proxy/ws-kucoin': {
        target: 'wss://x-push-spot.kucoin.com',
        ws: true,
        changeOrigin: true,
      },

      // ─── Market data ───
      '/proxy/coinpaprika': proxyRule('https://api.coinpaprika.com', '/proxy/coinpaprika', '', {
        headers: { Accept: 'application/json' },
      }),
      '/proxy/fng': proxyRule('https://api.alternative.me', '/proxy/fng'),
      '/proxy/cbr': proxyRule('https://www.cbr-xml-daily.ru', '/proxy/cbr'),
      '/proxy/dashcentral': proxyRule('https://www.dashcentral.org', '/proxy/dashcentral'),
      '/proxy/blockchair': proxyRule('https://api.blockchair.com', '/proxy/blockchair'),

      // ─── VPS-прокси ───
      '/proxy/binance-futures': proxyRule(
        'https://nebula-oracle.duckdns.org:8443',
        '/proxy/binance-futures',
        '/binance-futures'
      ),
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
});