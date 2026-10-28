// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · СВЕЧИ — Gate.io, Binance, OKX, Bybit, MEXC, KuCoin
// Поддержка таймфреймов: 1m / 15m / 1h / 1d / 1w / 1M / max
// ═══════════════════════════════════════════════════════════════

import { P } from '../config';

export interface Candle {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

export type Timeframe = '1m' | '15m' | '1h' | '1d' | '1w' | '1M' | 'max';

interface TfConfig {
  label: string;
  limit: number;
  gateio: string;
  binance: string;
  okx: string;
  bybit: string;
  mexc: string;
  kucoin: string;
}

export const TF_CONFIG: Record<Timeframe, TfConfig> = {
  '1m':  { label: '1m',  limit: 300,  gateio: '1m',  binance: '1m',  okx: '1m',  bybit: '1',   mexc: '1m',  kucoin: '1min'   },
  '15m': { label: '15m', limit: 300,  gateio: '15m', binance: '15m', okx: '15m', bybit: '15',  mexc: '15m', kucoin: '15min'  },
  '1h':  { label: '1h',  limit: 300,  gateio: '1h',  binance: '1h',  okx: '1H',  bybit: '60',  mexc: '60m', kucoin: '1hour'  },
  '1d':  { label: '1d',  limit: 300,  gateio: '1d',  binance: '1d',  okx: '1D',  bybit: 'D',   mexc: '1d',  kucoin: '1day'   },
  '1w':  { label: '7d',  limit: 300,  gateio: '7d',  binance: '1w',  okx: '1W',  bybit: 'W',   mexc: '1W',  kucoin: '1week'  },
  '1M':  { label: '1M',  limit: 200,  gateio: '30d', binance: '1M',  okx: '1M',  bybit: 'M',   mexc: '1M',  kucoin: '1month' },
  'max': { label: 'ALL', limit: 1000, gateio: '7d',  binance: '1w',  okx: '1W',  bybit: 'W',   mexc: '1W',  kucoin: '1week'  },
};

export function getTfConfig(tf: Timeframe = '1d'): TfConfig {
  return TF_CONFIG[tf] || TF_CONFIG['1d'];
}

const TIMEOUT = 8000;
const CACHE_TTL_MS = 15_000;

// Универсальный парсер времени: понимает и секунды, и миллисекунды
function toSeconds(ts: string | number): number {
  const n = typeof ts === 'number' ? ts : parseInt(ts, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 1_000_000_000_000 ? Math.floor(n / 1000) : n;
}

// Сортировка + удаление дублей по времени (lightweight-charts требует asc order)
function sortAndDedupe(candles: Candle[]): Candle[] {
  const sorted = candles.slice().sort((a, b) => a.time - b.time);
  const out: Candle[] = [];
  for (const c of sorted) {
    if (out.length && out[out.length - 1].time === c.time) {
      out[out.length - 1] = c;
    } else {
      out.push(c);
    }
  }
  return out;
}

// ─── ИСТОЧНИКИ ───

async function fromGateio(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const r = await fetch(
    `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${t}_USDT&interval=${interval}&limit=${limit}`,
    { signal }
  );
  if (!r.ok) throw new Error(`gateio ${r.status}`);
  const d: any[] = await r.json();
  return d.map(x => ({
    time: toSeconds(x[0]), volume: parseFloat(x[1]), close: parseFloat(x[2]),
    high: parseFloat(x[3]), low: parseFloat(x[4]), open: parseFloat(x[5]),
  }));
}

async function fromBinance(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const r = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${t}USDT&interval=${interval}&limit=${limit}`,
    { signal }
  );
  if (!r.ok) throw new Error(`binance ${r.status}`);
  const d: any[] = await r.json();
  return d.map(x => ({
    time: toSeconds(x[0]),
    open: parseFloat(x[1]), high: parseFloat(x[2]),
    low: parseFloat(x[3]), close: parseFloat(x[4]),
    volume: parseFloat(x[5]),
  }));
}

async function fromOkx(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const base = P('okx', 'https://www.okx.com');
  const safeLimit = Math.min(limit, 300);
  const r = await fetch(
    `${base}/api/v5/market/candles?instId=${t}-USDT&bar=${interval}&limit=${safeLimit}`,
    { signal }
  );
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  return (j.data || []).map((d: any) => ({
    time: toSeconds(d[0]),
    open: parseFloat(d[1]), high: parseFloat(d[2]),
    low: parseFloat(d[3]), close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  })).reverse();
}

async function fromBybit(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const base = P('bybit', 'https://api.bybit.com');
  const r = await fetch(
    `${base}/v5/market/kline?category=spot&symbol=${t}USDT&interval=${interval}&limit=${limit}`,
    { signal }
  );
  if (!r.ok) throw new Error(`bybit ${r.status}`);
  const j = await r.json();
  if (j.retCode !== 0) throw new Error(`bybit ${j.retMsg}`);
  return (j.result?.list || []).map((d: any) => ({
    time: toSeconds(d[0]),
    open: parseFloat(d[1]), high: parseFloat(d[2]),
    low: parseFloat(d[3]), close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  })).reverse();
}

async function fromMexc(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const base = P('mexc', 'https://api.mexc.com');
  const r = await fetch(
    `${base}/api/v3/klines?symbol=${t}USDT&interval=${interval}&limit=${limit}`,
    { signal }
  );
  if (!r.ok) throw new Error(`mexc ${r.status}`);
  const d: any[] = await r.json();
  return d.map(x => ({
    time: toSeconds(x[0]),
    open: parseFloat(x[1]), high: parseFloat(x[2]),
    low: parseFloat(x[3]), close: parseFloat(x[4]),
    volume: parseFloat(x[5]),
  }));
}

async function fromKucoin(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const base = P('kucoin', 'https://api.kucoin.com');
  const r = await fetch(
    `${base}/api/v1/market/candles?symbol=${t}-USDT&type=${interval}`,
    { signal }
  );
  if (!r.ok) throw new Error(`kucoin ${r.status}`);
  const j = await r.json();
  if (j.code !== '200000') throw new Error(`kucoin ${j.msg}`);

  // KuCoin: [time, open, close, high, low, volume, turnover]
  // Порядок в ответе — от новых к старым. Разворачиваем и обрезаем.
  const mapped: Candle[] = (j.data || []).map((d: any): Candle => ({
    time: toSeconds(d[0]),
    open: parseFloat(d[1]),
    close: parseFloat(d[2]),
    high: parseFloat(d[3]),
    low: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  }));
  mapped.sort((a, b) => a.time - b.time);
  return mapped.slice(-limit);
}

// ─── ОДИН ИСТОЧНИК С ТАЙМАУТОМ + ВНЕШНЕЙ ОТМЕНОЙ ───

function runSource(
  name: string,
  fn: (t: string, interval: string, limit: number, signal: AbortSignal) => Promise<Candle[]>,
  ticker: string,
  interval: string,
  limit: number,
  externalSignal: AbortSignal
): Promise<{ data: Candle[]; source: string }> {
  return new Promise((resolve, reject) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const onExternal = () => ctrl.abort();
    externalSignal.addEventListener('abort', onExternal, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      externalSignal.removeEventListener('abort', onExternal);
    };

    (async () => {
      try {
        const data = await fn(ticker, interval, limit, ctrl.signal);
        const minCandles = 25;
        if (!data || data.length < minCandles) throw new Error('мало данных');
        cleanup();
        resolve({ data, source: name });
      } catch (e: any) {
        cleanup();
        reject(e);
      }
    })();
  });
}

// ─── ПЕРВЫЙ УСПЕШНЫЙ ВЫИГРЫВАЕТ ───

async function trySources(
  ticker: string,
  tf: Timeframe
): Promise<{ data: Candle[]; source: string }> {
  const cfg = getTfConfig(tf);
  const t0 = performance.now();
  const outerCtrl = new AbortController();

  const promises = [
    runSource('gateio',  fromGateio,  ticker, cfg.gateio,  cfg.limit, outerCtrl.signal),
    runSource('binance', fromBinance, ticker, cfg.binance, cfg.limit, outerCtrl.signal),
    runSource('okx',     fromOkx,     ticker, cfg.okx,     cfg.limit, outerCtrl.signal),
    runSource('bybit',   fromBybit,   ticker, cfg.bybit,   cfg.limit, outerCtrl.signal),
    runSource('mexc',    fromMexc,    ticker, cfg.mexc,    cfg.limit, outerCtrl.signal),
    runSource('kucoin',  fromKucoin,  ticker, cfg.kucoin,  cfg.limit, outerCtrl.signal),
  ];

  try {
    const winner = await Promise.any(promises);
    outerCtrl.abort();
    const ms = Math.round(performance.now() - t0);
    console.log(`[perf] candles ${ticker} ${tf} from ${winner.source}: ${ms}ms (${winner.data.length} bars)`);
    return winner;
  } catch {
    throw new Error(`Все источники упали (tf=${tf})`);
  }
}

// ─── КЭШ (15 сек) ───

const _candleCache = new Map<string, { value: { data: Candle[]; source: string }; ts: number }>();

export async function fetchCandlesWithSource(
  ticker: string,
  limitOrTf?: number | Timeframe,
  tfParam?: Timeframe,
  force = false
): Promise<{ data: Candle[]; source: string }> {
  let tf: Timeframe;
  if (typeof limitOrTf === 'string') {
    tf = limitOrTf;
  } else if (tfParam) {
    tf = tfParam;
  } else {
    tf = '1d';
  }

  const key = `${ticker.toUpperCase()}:${tf}`;
  const cached = _candleCache.get(key);
  if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }

  const value = await trySources(ticker, tf);

  // Бронебойная нормализация: гарантированно asc-порядок, без дублей.
  value.data = sortAndDedupe(value.data);

  _candleCache.set(key, { value, ts: Date.now() });
  return value;
}

export async function fetchCandles(ticker: string, tf: Timeframe = '1d'): Promise<Candle[]> {
  return (await fetchCandlesWithSource(ticker, tf)).data;
}