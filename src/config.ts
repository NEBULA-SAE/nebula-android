// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CONFIG
// Централизованные URL источников данных.
// В dev (Vite) — локальные /proxy/* (проксирует vite.config.ts)
// В prod (Tauri/APK) — VPS-прокси Caddy (обход блокировок РФ)
// ═══════════════════════════════════════════════════════════════

const IS_DEV = (import.meta as any).env?.DEV;

/** VPS-прокси (Caddy) — обходит блокировки и лимиты */
const VPS_PROXY = 'https://nebula-oracle.duckdns.org:8443';

/** Что и куда идёт в prod */
const VPS_MAP: Record<string, string> = {
  coinpaprika:     `${VPS_PROXY}/coinpaprika`,
  okx:             `${VPS_PROXY}/okx`,
  bybit:           `${VPS_PROXY}/bybit`,
  mexc:            `${VPS_PROXY}/mexc`,
  binance_futures: `${VPS_PROXY}/binance-futures`,
  fng:             `${VPS_PROXY}/fng`,
};

/**
 * Базовый URL источника.
 * @param name  — ключ Vite-прокси (`/proxy/{name}`)
 * @param real  — прямой URL (для источников работающих из РФ)
 */
export function P(name: string, real: string): string {
  if (IS_DEV) return `/proxy/${name}`;
  return VPS_MAP[name] || real;
}

export { IS_DEV, VPS_PROXY };