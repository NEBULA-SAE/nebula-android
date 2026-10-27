import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

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
      '/proxy/getblock': {
        target: 'https://dash.getblock.io',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/getblock/, ''),
      },
      '/proxy/gb-go': {
        target: 'https://go.getblock.io',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/gb-go/, ''),
      },
      '/proxy/gb-shared': {
        target: 'https://shared.eu-central-1.getblock.io',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/gb-shared/, ''),
      },

      // ─── Биржи (spot) ───
      '/proxy/mexc': {
        target: 'https://api.mexc.com',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/mexc/, ''),
      },
      '/proxy/binance-spot': {
        target: 'https://api.binance.com',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/binance-spot/, ''),
      },
      '/proxy/okx': {
        target: 'https://www.okx.com',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
        rewrite: (p) => p.replace(/^\/proxy\/okx/, ''),
      },
      '/proxy/gateio': {
        target: 'https://api.gateio.ws',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/gateio/, ''),
      },
      '/proxy/bybit': {
        target: 'https://api.bybit.com',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/bybit/, ''),
      },

      // ─── KuCoin ───
      '/proxy/kucoin': {
        target: 'https://api.kucoin.com',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '', // ← ДОБАВИТЬ ЭТО: убирает ошибку Cookie __cf_bm
        rewrite: (path: string) => path.replace(/^\/proxy\/kucoin/, ''),
      },
      '/proxy/kucoin-futures': {
        target: 'https://api-futures.kucoin.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path: string) => path.replace(/^\/proxy\/kucoin-futures/, ''),
      },
      '/proxy/ws-kucoin': {
        target: 'wss://x-push-spot.kucoin.com',
        ws: true,
        changeOrigin: true,
      },

      // ─── Market data ───
      '/proxy/coinpaprika': {
        target: 'https://api.coinpaprika.com',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
        },
        rewrite: (p) => p.replace(/^\/proxy\/coinpaprika/, ''),
      },
      '/proxy/fng': {
        target: 'https://api.alternative.me',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/fng/, ''),
      },
      '/proxy/cbr': {
        target: 'https://www.cbr-xml-daily.ru',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/cbr/, ''),
      },
      '/proxy/dashcentral': {
        target: 'https://www.dashcentral.org',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/dashcentral/, ''),
      },
      '/proxy/blockchair': {
        target: 'https://api.blockchair.com',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/blockchair/, ''),
      },

      // ─── VPS-прокси ───
      '/proxy/binance-futures': {
        target: 'https://nebula-oracle.duckdns.org:8443',
        changeOrigin: true, secure: true,
        rewrite: (p) => p.replace(/^\/proxy\/binance-futures/, '/binance-futures'),
      },
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