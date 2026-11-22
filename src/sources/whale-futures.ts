// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · WHALE FUTURES
// Bybit (OI+LSR Global) + OKX (Taker+LSR Top) + Binance (fallback)
// Прямые запросы через конфиг P() с быстрым фолбэком
// ═══════════════════════════════════════════════════════════════

import { P } from '../config';

const BYBIT_BASE   = P('bybit',           'https://api.bybit.com');
const OKX_BASE     = P('okx',             'https://www.okx.com');
const BINANCE_BASE = P('binance_futures', 'https://fapi.binance.com');

const TIMEOUT = 3500;
const COOLDOWN_MS = 60_000;
const _exchangeCooldownUntil = new Map<string, number>();

function isCoolingDown(name: string): boolean {
  const until = _exchangeCooldownUntil.get(name) || 0;
  if (until <= Date.now()) {
    _exchangeCooldownUntil.delete(name);
    return false;
  }
  return true;
}

function setCooldown(name: string): void {
  _exchangeCooldownUntil.set(name, Date.now() + COOLDOWN_MS);
}

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
// BINANCE FUTURES
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
  return Math.max(0.1, Math.min(10, val));
}

// ═══════════════════════════════════════════════════════════════
// АГРЕГАЦИЯ
// ═══════════════════════════════════════════════════════════════

const _cache = new Map<string, { value: WhaleFuturesMetrics; ts: number }>();
const CACHE_TTL_MS = 180 * 1000;

export async function getWhaleFuturesMetrics(ticker: string): Promise<WhaleFuturesMetrics> {
  const sym = ticker.toUpperCase();
  const cached = _cache.get(sym);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.value;

  const allDown = isCoolingDown('bybit') && isCoolingDown('okx') && isCoolingDown('binance');
  const allowBybit = allDown || !isCoolingDown('bybit');
  const allowOkx = allDown || !isCoolingDown('okx');
  const allowBinance = allDown || !isCoolingDown('binance');

  const emptyRejected = <T,>(): Promise<PromiseSettledResult<T>> =>
    Promise.resolve({ status: 'rejected', reason: new Error('cooldown') });

  const [
    bybitOiR, bybitLsrR,
    okxTakerR, okxTopLsrR,
    binanceOiR, binanceLsrTopR, binanceLsrGlobalR, binanceTakerR,
  ] = await Promise.all([
    allowBybit ? Promise.allSettled([bybitOI(sym, 25)]).then(a => a[0]) : emptyRejected<number[]>(),
    allowBybit ? Promise.allSettled([bybitLsrGlobal(sym)]).then(a => a[0]) : emptyRejected<number>(),
    allowOkx ? Promise.allSettled([okxTaker(sym)]).then(a => a[0]) : emptyRejected<number>(),
    allowOkx ? Promise.allSettled([okxTopLsr(sym)]).then(a => a[0]) : emptyRejected<number>(),
    allowBinance ? Promise.allSettled([binanceOI(sym, 25)]).then(a => a[0]) : emptyRejected<number[]>(),
    allowBinance ? Promise.allSettled([binanceLsrTop(sym)]).then(a => a[0]) : emptyRejected<number>(),
    allowBinance ? Promise.allSettled([binanceLsrGlobal(sym)]).then(a => a[0]) : emptyRejected<number>(),
    allowBinance ? Promise.allSettled([binanceTaker(sym)]).then(a => a[0]) : emptyRejected<number>(),
  ]);

  if (allowBybit && bybitOiR.status === 'rejected' && bybitLsrR.status === 'rejected') {
    setCooldown('bybit');
  }
  if (allowOkx && okxTakerR.status === 'rejected' && okxTopLsrR.status === 'rejected') {
    setCooldown('okx');
  }
  if (
    allowBinance &&
    binanceOiR.status === 'rejected' &&
    binanceLsrTopR.status === 'rejected' &&
    binanceLsrGlobalR.status === 'rejected' &&
    binanceTakerR.status === 'rejected'
  ) {
    setCooldown('binance');
  }

  const result: WhaleFuturesMetrics = { status: 'success', ticker: sym, sources: [] };

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

  console.log(`[perf] whale ${sym}: oi=${result.oi_source || '—'} (${result.oi_change_24h_pct ?? '—'}%) lsr=${result.lsr_global ?? '—'} top=${result.lsr_top_positions ?? '—'} taker=${result.taker_ratio ?? '—'} sources=[${result.sources.join(', ')}]`);

  if (result.sources.length === 0) {
    const err: WhaleFuturesMetrics = { status: 'error', ticker: sym, sources: [], message: 'No data' };
    return err;
  }

  _cache.set(sym, { value: result, ts: Date.now() });
  return result;
}