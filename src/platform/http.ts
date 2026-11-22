// ═══════════════════════════════════════════════════════════════
// NEBULA · UNIVERSAL HTTP
// Патч fetch на Tauri: прямые запросы через нативный клиент с таймаутом
// ═══════════════════════════════════════════════════════════════

import { isTauri, isAndroid, platform } from './index';

let installed = false;

// ─── Домены, которым нужен нативный клиент Tauri (CORS + стабильный TLS) ───
const TAURI_PROXY_HOSTS = [
  'api.mexc.com',
  'api.bybit.com',
  'www.okx.com',
  'api.coinpaprika.com',
  'api.alternative.me',
  'shared.eu-central-1.getblock.io',
  'dash.getblock.io',
  'go.getblock.io',
  'dash-rpc.publicnode.com',
  'api.groq.com',
  'www.dashcentral.org',
  'api.blockchair.com',
  'api.dexpaprika.com',
  'api.kucoin.com',
  'api-futures.kucoin.com',
];

const TAURI_PROXY_PATHS: { host: string; pathPrefix: string }[] = [
  { host: 'www.okx.com', pathPrefix: '/api/v5/rubik/' },
];

function needsTauriProxy(url: string): boolean {
  try {
    const u = new URL(url);
    if (TAURI_PROXY_HOSTS.includes(u.hostname)) return true;
    for (const { host, pathPrefix } of TAURI_PROXY_PATHS) {
      if (u.hostname === host && u.pathname.startsWith(pathPrefix)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function installFetchPatch(): void {
  if (typeof window === 'undefined') return;
  if (installed) return;
  installed = true;

  if (isTauri) {
    (async () => {
      try {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        const origFetch = window.fetch.bind(window);

        let activeCount = 0;

        window.fetch = (async (input: any, init?: any) => {
          const url = typeof input === 'string' ? input : input.url;

          if (
            url.startsWith('/') ||
            url.startsWith('blob:') ||
            url.startsWith('data:') ||
            url.startsWith('http://localhost') ||
            url.startsWith('http://127.0.0.1')
          ) {
            return origFetch(input, init);
          }

          if (!needsTauriProxy(url)) {
            return origFetch(input, init);
          }

          activeCount++;
          const t0 = performance.now();
          try {
            const headers = new Headers(init?.headers || {});
            if (!headers.has('User-Agent')) {
              headers.set(
                'User-Agent',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              );
            }
            if (!headers.has('Accept')) {
              headers.set('Accept', 'application/json');
            }

            const tauriInit: any = {
              ...init,
              headers,
              connectTimeout: 4000,
            };

            return await (tauriFetch as any)(url, tauriInit);
          } finally {
            activeCount--;
            const ms = Math.round(performance.now() - t0);
            console.log(`[tauri-http] ${url.slice(0, 70)} · ${ms}ms · active: ${activeCount}`);
          }
        }) as typeof fetch;

        console.log('[platform] Tauri fetch patch installed (direct + timeout)');
      } catch (e) {
        console.warn('[platform] Tauri fetch patch failed:', e);
      }
    })();
    return;
  }

  if (isAndroid) {
    console.log('[platform] Android uses CapacitorHttp patch');
    return;
  }

  console.log(`[platform] no fetch patch needed for ${platform}`);
}