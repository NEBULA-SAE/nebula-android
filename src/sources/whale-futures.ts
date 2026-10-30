// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · WHALE FUTURES
// Bybit (OI+LSR Global) + OKX (Taker+LSR Top) + Binance (fallback)
// Binance через VPS-прокси (обход блокировки РФ)
// ═══════════════════════════════════════════════════════════════

import { P } from '../config';

const BYBIT_BASE   = P('bybit',           'https://api.bybit.com');
const OKX_BASE     = P('okx',             'https://www.okx.com');
const BINANCE_BASE = P('binance_futures', 'https://fapi.binance.com');

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

// ═══════════════════════════════════════════════════════════════
// BYBIT
// ═══════════════════════════════════════════════════════════════

async function bybitOI(t: string, limit = 25): Promise<number[]> {
  const r = await fetch(`${BYBIT_BASE}/v5/market/open-interest?category=linear&symbol=${t}USDT&intervalTime=1h&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`bybit OI ${r.status}`);
  const d = await r.json();
  if (d.retCode !== 0) throw new Error(`bybit OI ${d.retMsg}`);
  const lst = d.result?.list || [];
  if (!lst.length) throw new Error('bybit OI empty');
  return lst.reverse().map((x: any) => parseFloat(x.openInterest));
}

async function bybitLsrGlobal(t: string): Promise<number> {
  const r = await fetch(`${BYBIT_BASE}/v5/market/account-ratio?category=linear&symbol=${t}USDT&period=1h&limit=1`,
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

// ═══════════════════════════════════════════════════════════════
// OKX
// ═══════════════════════════════════════════════════════════════

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
  // Ограничиваем от 0.1 до 10, чтобы избежать выбросов вроде 300.11
  return s <= 0 ? 1 : Math.max(0.1, Math.min(10, b / s));
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

// ═══════════════════════════════════════════════════════════════
// BINANCE FUTURES (через VPS-прокси — обход блокировки РФ)
// ═══════════════════════════════════════════════════════════════

async function binanceOI(t: string, limit = 25): Promise<number[]> {
  const r = await fetch(
    `${BINANCE_BASE}/futures/data/openInterestHist?symbol=${t}USDT&period=1h&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`binance OI ${r.status}`);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error('binance OI empty');
  return arr.map((x: any) => parseFloat(x.sumOpenInterest));
}

async function binanceLsrTop(t: string): Promise<number> {
  const r = await fetch(
    `${BINANCE_BASE}/futures/data/topLongShortAccountRatio?symbol=${t}USDT&period=1h&limit=1`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`binance top lsr ${r.status}`);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error('binance top lsr empty');
  return parseFloat(arr[0].longShortRatio);
}

async function binanceLsrGlobal(t: string): Promise<number> {
  const r = await fetch(
    `${BINANCE_BASE}/futures/data/globalLongShortAccountRatio?symbol=${t}USDT&period=1h&limit=1`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`binance global lsr ${r.status}`);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error('binance global lsr empty');
  return parseFloat(arr[0].longShortRatio);
}

async function binanceTaker(t: string): Promise<number> {
  const r = await fetch(
    `${BINANCE_BASE}/futures/data/takerlongshortRatio?symbol=${t}USDT&period=1h&limit=1`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`binance taker ${r.status}`);
  const arr = await r.json();
  if (!Array.isArray(arr) || !arr.length) throw new Error('binance taker empty');
  const val = parseFloat(arr[0].buySellRatio);
  return Math.max(0.1, Math.min(10, val)); // Тоже ограничиваем
}

// ═══════════════════════════════════════════════════════════════
// АГРЕГАЦИЯ
// ═══════════════════════════════════════════════════════════════

const _cache = new Map<string, { value: WhaleFuturesMetrics; ts: number }>();
const CACHE_TTL_MS = 180 * 1000;

export async function getWhaleFuturesMetrics(ticker: string): Promise<WhaleFuturesMetrics> {
  const key = ticker.toUpperCase();
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  const result: WhaleFuturesMetrics = { status: 'success', ticker, sources: [] };

  // Все запросы параллельно: Bybit ×2, OKX ×2, Binance ×4
  const [
    bybitOiR, bybitLsrR,
    okxTakerR, okxTopLsrR,
    binanceOiR, binanceLsrTopR, binanceLsrGlobalR, binanceTakerR,
  ] = await Promise.allSettled([
    bybitOI(ticker, 25),
    bybitLsrGlobal(ticker),
    okxTaker(ticker),
    okxTopLsr(ticker),
    binanceOI(ticker, 25),
    binanceLsrTop(ticker),
    binanceLsrGlobal(ticker),
    binanceTaker(ticker),
  ]);

  // ─── OI: Bybit → Binance ───
  let oiSeries: number[] | null = null;
  let oiSource = '';
  if (bybitOiR.status === 'fulfilled' && bybitOiR.value.length >= 2) {
    oiSeries = bybitOiR.value;
    oiSource = 'bybit';
  } else if (binanceOiR.status === 'fulfilled' && binanceOiR.value.length >= 2) {
    oiSeries = binanceOiR.value;
    oiSource = 'binance';
  }
  if (oiSeries) {
    const h = oiSeries;
    result.oi = h[h.length - 1];
    result.oi_source = oiSource;
    result.sources.push(`oi:${oiSource}`);
    if (h[0] > 0) {
      const pct = ((h[h.length - 1] - h[0]) / h[0]) * 100;
      result.oi_change_24h_pct = Math.round(pct * 100) / 100;
      result.oi_trend = pct > 5 ? 'rising' : pct < -5 ? 'falling' : 'flat';
    }
  }

  // ─── LSR Top Traders: OKX → Binance → Bybit ───
  let lsrTop: number | null = null;
  let lsrTopSource = '';
  if (okxTopLsrR.status === 'fulfilled') {
    lsrTop = okxTopLsrR.value;
    lsrTopSource = 'okx';
  } else if (binanceLsrTopR.status === 'fulfilled') {
    lsrTop = binanceLsrTopR.value;
    lsrTopSource = 'binance';
  } else if (bybitLsrR.status === 'fulfilled') {
    lsrTop = bybitLsrR.value;
    lsrTopSource = 'bybit';
  }
  if (lsrTop !== null) {
    const v = Math.round(lsrTop * 100) / 100;
    result.lsr_top_positions = v;
    result.lsr_top_accounts = v;
    result.sources.push(`lsr_top:${lsrTopSource}`);
  }

  // ─── LSR Global (толпа): Bybit → Binance ───
  let lsrGlobal: number | null = null;
  let lsrGlobalSource = '';
  if (bybitLsrR.status === 'fulfilled') {
    lsrGlobal = bybitLsrR.value;
    lsrGlobalSource = 'bybit';
  } else if (binanceLsrGlobalR.status === 'fulfilled') {
    lsrGlobal = binanceLsrGlobalR.value;
    lsrGlobalSource = 'binance';
  }
  if (lsrGlobal !== null) {
    result.lsr_global = Math.round(lsrGlobal * 100) / 100;
    result.sources.push(`lsr:${lsrGlobalSource}`);
  }

  // ─── Taker Buy/Sell: OKX → Binance ───
  let taker: number | null = null;
  let takerSource = '';
  if (okxTakerR.status === 'fulfilled') {
    taker = okxTakerR.value;
    takerSource = 'okx';
  } else if (binanceTakerR.status === 'fulfilled') {
    taker = binanceTakerR.value;
    takerSource = 'binance';
  }
  if (taker !== null) {
    result.taker_ratio = Math.round(taker * 100) / 100;
    result.sources.push(`taker:${takerSource}`);
  }

  console.log(`[perf] whale ${ticker}: oi=${result.oi_source || '—'} (${result.oi_change_24h_pct ?? '—'}%) lsr=${result.lsr_global ?? '—'} top=${result.lsr_top_positions ?? '—'} taker=${result.taker_ratio ?? '—'} sources=[${result.sources.join(', ')}]`);

  if (result.sources.length === 0) {
    const err: WhaleFuturesMetrics = { status: 'error', ticker, sources: [], message: 'No data' };
    // НЕ кэшируем ошибки — следующий запрос попробует снова
    return err;
  }

  _cache.set(key, { value: result, ts: Date.now() });
  return result;
}