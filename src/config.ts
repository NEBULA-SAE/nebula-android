// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CONFIG
// Централизованные URL источников данных.
// В dev (Vite) — локальные /proxy/* (проксирует vite.config.ts)
// В prod (Tauri/APK) — прямые URL источников (работает без VPS)
// ═══════════════════════════════════════════════════════════════

const IS_DEV = (import.meta as any).env?.DEV;

/** Запасной VPS-прокси (при необходимости можно подключить точечно) */
const VPS_PROXY = 'https://nebula-oracle.duckdns.org:8443';

/** Прямые запросы в prod по умолчанию: каждый клиент берёт доступные ему источники */
const VPS_MAP: Record<string, string> = {};

/**
 * Базовый URL источника.
 * @param name — ключ Vite-прокси (`/proxy/{name}`)
 * @param real — прямой URL источника
 */
export function P(name: string, real: string): string {
  if (IS_DEV) return `/proxy/${name}`;
  return VPS_MAP[name] || real;
}

export { IS_DEV, VPS_PROXY };