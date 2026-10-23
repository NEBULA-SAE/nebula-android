// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · СВЕЧИ — Gate.io, Binance SPOT, OKX, Bybit, MEXC
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
}

export const TF_CONFIG: Record<Timeframe, TfConfig> = {
  '1m':  { label: '1m',  limit: 300,  gateio: '1m',  binance: '1m',  okx: '1m',  bybit: '1',   mexc: '1m'  },
  '15m': { label: '15m', limit: 300,  gateio: '15m', binance: '15m', okx: '15m', bybit: '15',  mexc: '15m' },
  '1h':  { label: '1h',  limit: 300,  gateio: '1h',  binance: '1h',  okx: '1H',  bybit: '60',  mexc: '60m' },
  '1d':  { label: '1d',  limit: 300,  gateio: '1d',  binance: '1d',  okx: '1D',  bybit: 'D',   mexc: '1d'  },
  '1w':  { label: '7d',  limit: 300,  gateio: '7d',  binance: '1w',  okx: '1W',  bybit: 'W',   mexc: '1W'  },
  '1M':  { label: '1M',  limit: 200,  gateio: '30d', binance: '1M',  okx: '1M',  bybit: 'M',   mexc: '1M'  },
  'max': { label: 'ALL', limit: 1000, gateio: '7d',  binance: '1w',  okx: '1W',  bybit: 'W',   mexc: '1W'  },
};

export function getTfConfig(tf: Timeframe = '1d'): TfConfig {
  return TF_CONFIG[tf] || TF_CONFIG['1d'];
}

const TIMEOUT = 8000;
const CACHE_TTL_MS = 15_000;

// ─── ИСТОЧНИКИ ───
// Каждый принимает интервал в своём формате и AbortSignal для отмены.

async function fromGateio(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const r = await fetch(
    `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${t}_USDT&interval=${interval}&limit=${limit}`,
    { signal }
  );
  if (!r.ok) throw new Error(`gateio ${r.status}`);
  const d: any[] = await r.json();
  return d.map(x => ({
    time: parseInt(x[0]), volume: parseFloat(x[1]), close: parseFloat(x[2]),
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
    time: Math.floor(x[0] / 1000),
    open: parseFloat(x[1]), high: parseFloat(x[2]),
    low: parseFloat(x[3]), close: parseFloat(x[4]),
    volume: parseFloat(x[5]),
  }));
}

async function fromOkx(t: string, interval: string, limit: number, signal: AbortSignal): Promise<Candle[]> {
  const base = P('okx', 'https://www.okx.com');
  // OKX отдаёт максимум 300 свечей за один запрос
  const safeLimit = Math.min(limit, 300);
  const r = await fetch(
    `${base}/api/v5/market/candles?instId=${t}-USDT&bar=${interval}&limit=${safeLimit}`,
    { signal }
  );
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  return (j.data || []).map((d: any) => ({
    time: Math.floor(parseInt(d[0]) / 1000),
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
    time: Math.floor(parseInt(d[0]) / 1000),
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
    time: Math.floor(x[0] / 1000),
    open: parseFloat(x[1]), high: parseFloat(x[2]),
    low: parseFloat(x[3]), close: parseFloat(x[4]),
    volume: parseFloat(x[5]),
  }));
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
        // Минимальный порог — для 15m+ свечей нужно хотя бы 25 точек
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

// ─── ПЕРВЫЙ УСПЕШНЫЙ ВЫИГРЫВАЕТ, ОСТАЛЬНЫЕ ОТМЕНЯЮТСЯ ───

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
// Короткий TTL: защищает от двойного запроса внутри одного анализа
// (mobileAnalyze → getAdvancedAnalytics), но не мешает автообновлению.

const _candleCache = new Map<string, { value: { data: Candle[]; source: string }; ts: number }>();

export async function fetchCandlesWithSource(
  ticker: string,
  limitOrTf?: number | Timeframe,
  tfParam?: Timeframe,
  force = false
): Promise<{ data: Candle[]; source: string }> {
  // Обратная совместимость: старый вызов fetchCandlesWithSource('BTC', 120)
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
  _candleCache.set(key, { value, ts: Date.now() });
  return value;
}

export async function fetchCandles(ticker: string, tf: Timeframe = '1d'): Promise<Candle[]> {
  return (await fetchCandlesWithSource(ticker, tf)).data;
}