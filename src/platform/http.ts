// ═══════════════════════════════════════════════════════════════
// NEBULA · UNIVERSAL HTTP
// Патч fetch на Tauri: только для доменов, требующих CORS-обхода
// ═══════════════════════════════════════════════════════════════

import { isTauri, isAndroid, platform } from './index';

let installed = false;

// ─── Домены, которым ТОЧНО нужен обход CORS через Tauri ───
const TAURI_PROXY_HOSTS = [
  'api.mexc.com',
  'shared.eu-central-1.getblock.io',
  'dash.getblock.io',
  'go.getblock.io',
  'dash-rpc.publicnode.com',
  'api.groq.com',
  'www.dashcentral.org',
  'api.blockchair.com',
  'api.dexpaprika.com',
];

// ─── Особые пути (okx: только rubik требует обхода) ───
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

        // счётчик для диагностики — покажет сколько активных Tauri-запросов
        let activeCount = 0;

        window.fetch = (async (input: any, init?: any) => {
          const url = typeof input === 'string' ? input : input.url;

          // Локальные / blob / data — нативный fetch
          if (
            url.startsWith('/') ||
            url.startsWith('blob:') ||
            url.startsWith('data:') ||
            url.startsWith('http://localhost') ||
            url.startsWith('http://127.0.0.1')
          ) {
            return origFetch(input, init);
          }

          // Не в whitelist — нативный fetch (gateio, binance, bybit, okx-market и т.д.)
          if (!needsTauriProxy(url)) {
            return origFetch(input, init);
          }

          // Whitelist — идём через Tauri
          activeCount++;
          const t0 = performance.now();
          try {
            const res = await tauriFetch(url, init);
            return res;
          } finally {
            activeCount--;
            const ms = Math.round(performance.now() - t0);
            console.log(`[tauri-http] ${url.slice(0, 70)} · ${ms}ms · active: ${activeCount}`);
          }
        }) as typeof fetch;

        console.log('[platform] Tauri fetch patch installed (whitelist mode)');
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