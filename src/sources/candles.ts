// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · СВЕЧИ — Gate.io, Binance SPOT, OKX, Bybit, MEXC
// MEXC и Binance Futures — через VPS-прокси в prod (config.ts)
// ═══════════════════════════════════════════════════════════════

import { P } from '../config';

export interface Candle {
  time: number; open: number; high: number; low: number; close: number; volume: number;
}

const TIMEOUT = 6000;

async function fromGateio(t: string, limit: number): Promise<Candle[]> {
  const r = await fetch(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${t}_USDT&interval=1d&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`gateio ${r.status}`);
  const d: any[] = await r.json();
  return d.map(x => ({
    time: parseInt(x[0]), volume: parseFloat(x[1]), close: parseFloat(x[2]),
    high: parseFloat(x[3]), low: parseFloat(x[4]), open: parseFloat(x[5]),
  }));
}

async function fromBinance(t: string, limit: number): Promise<Candle[]> {
  const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${t}USDT&interval=1d&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`binance ${r.status}`);
  const d: any[] = await r.json();
  return d.map(x => ({
    time: Math.floor(x[0] / 1000),
    open: parseFloat(x[1]), high: parseFloat(x[2]),
    low: parseFloat(x[3]), close: parseFloat(x[4]),
    volume: parseFloat(x[5]),
  }));
}

async function fromOkx(t: string, limit: number): Promise<Candle[]> {
  const base = P('okx', 'https://www.okx.com');
  const r = await fetch(`${base}/api/v5/market/candles?instId=${t}-USDT&bar=1D&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  return (j.data || []).map((d: any) => ({
    time: Math.floor(parseInt(d[0]) / 1000),
    open: parseFloat(d[1]), high: parseFloat(d[2]),
    low: parseFloat(d[3]), close: parseFloat(d[4]),
    volume: parseFloat(d[5]),
  })).reverse();
}

async function fromBybit(t: string, limit: number): Promise<Candle[]> {
  const base = P('bybit', 'https://api.bybit.com');
  const r = await fetch(`${base}/v5/market/kline?category=spot&symbol=${t}USDT&interval=D&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) });
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

async function fromMexc(t: string, limit: number): Promise<Candle[]> {
  const base = P('mexc', 'https://api.mexc.com');
  const r = await fetch(`${base}/api/v3/klines?symbol=${t}USDT&interval=1d&limit=${limit}`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`mexc ${r.status}`);
  const d: any[] = await r.json();
  return d.map(x => ({
    time: Math.floor(x[0] / 1000),
    open: parseFloat(x[1]), high: parseFloat(x[2]),
    low: parseFloat(x[3]), close: parseFloat(x[4]),
    volume: parseFloat(x[5]),
  }));
}

const SOURCES = [
  { name: 'gateio',  fetch: fromGateio },
  { name: 'binance', fetch: fromBinance },
  { name: 'okx',     fetch: fromOkx },
  { name: 'bybit',   fetch: fromBybit },
  { name: 'mexc',    fetch: fromMexc },
];

async function trySources(ticker: string, limit: number): Promise<{ data: Candle[]; source: string; ms: number }> {
  const t0 = performance.now();
  const settled = await Promise.allSettled(
    SOURCES.map(async (src) => {
      const data = await src.fetch(ticker, limit);
      if (!data || data.length <= 20) throw new Error('мало данных');
      return { data, source: src.name, ms: performance.now() };
    })
  );

  const ok = settled.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ data: Candle[]; source: string; ms: number }> | undefined;
  if (ok) {
    const ms = Math.round(ok.value.ms - t0);
    console.log(`[perf] candles ${ticker} from ${ok.value.source}: ${ms}ms`);
    return ok.value;
  }

  const errors = settled
    .map((r, i) => r.status === 'fulfilled'
      ? `${SOURCES[i].name}: OK но мало`
      : `${SOURCES[i].name}: ${(r as PromiseRejectedResult).reason?.message || 'err'}`)
    .join('\n');
  throw new Error(`Все источники упали:\n${errors}`);
}

export async function fetchCandles(ticker: string, limit = 120): Promise<Candle[]> {
  return (await trySources(ticker, limit)).data;
}

export async function fetchCandlesWithSource(ticker: string, limit = 120): Promise<{ data: Candle[]; source: string }> {
  const { data, source } = await trySources(ticker, limit);
  return { data, source };
}