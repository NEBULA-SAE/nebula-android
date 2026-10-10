// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · WHALE FUTURES — Bybit (OI+LSR) + OKX (Taker+TopLSR)
// OKX через прокси (CORS), Bybit напрямую
// ═══════════════════════════════════════════════════════════════

const IS_DEV = (import.meta as any).env?.DEV;
const OKX_BASE = IS_DEV ? '/proxy/okx' : 'https://www.okx.com';
const TIMEOUT = 6000;

export interface WhaleFuturesMetrics {
  status: 'success' | 'error';
  ticker: string;
  sources: string[];
  oi?: number;
  oi_source?: string;
  oi_change_24h_pct?: number;
  oi_trend?: 'rising' | 'falling' | 'flat';
  lsr_top_accounts?: number;
  lsr_top_positions?: number;
  lsr_global?: number;
  taker_ratio?: number;
  message?: string;
}

async function bybitOI(t: string, limit = 25): Promise<number[]> {
  const r = await fetch(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${t}USDT&intervalTime=1h&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`bybit OI ${r.status}`);
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(`bybit OI ${d.retMsg}`);
  const lst = d.result?.list || [];
  if (!lst.length) throw new Error('bybit OI empty');
  return lst.reverse().map((x: any) => parseFloat(x.openInterest));
}

async function bybitLsr(t: string): Promise<number> {
  const r = await fetch(`https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${t}USDT&period=1h&limit=1`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`bybit LSR ${r.status}`);
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(`bybit LSR ${d.retMsg}`);
  const lst = d.result?.list || [];
  if (!lst.length) throw new Error('bybit LSR empty');
  const buy = parseFloat(lst[0].buyRatio || '1');
  const sell = parseFloat(lst[0].sellRatio || '1');
  return sell <= 0 ? 1 : buy / sell;
}

async function okxTaker(t: string): Promise<number> {
  const r = await fetch(`${OKX_BASE}/api/v5/rubik/stat/taker-volume-contract?instId=${t}-USDT-SWAP&period=1H`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`okx taker ${r.status}`);
  const d = await r.json();
  if (d.code !== '0') throw new Error(`okx taker ${d.msg}`);
  const lst = d.data || [];
  if (!lst.length) throw new Error('okx taker empty');
  const [, sell, buy] = lst[0];
  const s = parseFloat(sell), b = parseFloat(buy);
  return s <= 0 ? 1 : b / s;
}

async function okxTopLsr(t: string): Promise<number> {
  const r = await fetch(`${OKX_BASE}/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${t}-USDT-SWAP&period=1H`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`okx top lsr ${r.status}`);
  const d = await r.json();
  if (d.code !== '0') throw new Error(`okx top lsr ${d.msg}`);
  const lst = d.data || [];
  if (!lst.length) throw new Error('okx top lsr empty');
  return parseFloat(lst[0][1]);
}

const _cache = new Map<string, { value: WhaleFuturesMetrics; ts: number }>();
const CACHE_TTL_MS = 180 * 1000;

export async function getWhaleFuturesMetrics(ticker: string): Promise<WhaleFuturesMetrics> {
  const key = ticker.toUpperCase();
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  const result: WhaleFuturesMetrics = { status: 'success', ticker, sources: [] };

  const [bybitOiR, bybitLsrR, okxTakerR, okxTopLsrR] = await Promise.allSettled([
    bybitOI(ticker, 25),
    bybitLsr(ticker),
    okxTaker(ticker),
    okxTopLsr(ticker),
  ]);

  if (bybitOiR.status === 'fulfilled' && bybitOiR.value.length >= 2) {
    const h = bybitOiR.value;
    result.oi = h[h.length - 1];
    result.oi_source = 'bybit';
    result.sources.push('oi:bybit');
    if (h[0] > 0) {
      const pct = ((h[h.length - 1] - h[0]) / h[0]) * 100;
      result.oi_change_24h_pct = Math.round(pct * 100) / 100;
      result.oi_trend = pct > 5 ? 'rising' : pct < -5 ? 'falling' : 'flat';
    }
  }

  if (bybitLsrR.status === 'fulfilled') {
    result.lsr_global = Math.round(bybitLsrR.value * 100) / 100;
    result.sources.push('lsr:bybit');
  }

  if (okxTopLsrR.status === 'fulfilled') {
    const v = Math.round(okxTopLsrR.value * 100) / 100;
    result.lsr_top_positions = v;
    result.lsr_top_accounts = v;
    result.sources.push('lsr_top:okx');
  } else if (bybitLsrR.status === 'fulfilled') {
    const v = Math.round(bybitLsrR.value * 100) / 100;
    result.lsr_top_positions = v;
    result.lsr_top_accounts = v;
    result.sources.push('lsr_top:bybit');
  }

  if (okxTakerR.status === 'fulfilled') {
    result.taker_ratio = Math.round(okxTakerR.value * 100) / 100;
    result.sources.push('taker:okx');
  }

  console.log(`[perf] whale ${ticker}: oi=${result.oi_source || '—'} (${result.oi_change_24h_pct ?? '—'}%) lsr=${result.lsr_global ?? '—'} top=${result.lsr_top_positions ?? '—'} taker=${result.taker_ratio ?? '—'}`);

  if (result.sources.length === 0) {
    const err: WhaleFuturesMetrics = { status: 'error', ticker, sources: [], message: 'No data' };
    // НЕ кэшируем ошибки — следующий запрос попробует снова
    return err;
  }

  _cache.set(key, { value: result, ts: Date.now() });
  return result;
}