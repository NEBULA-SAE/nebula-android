// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · СТАКАН + ПРАВДИВОЕ ДАВЛЕНИЕ
// Gate.io, Binance SPOT, Bybit, OKX, MEXC
// Всё напрямую, кроме MEXC (прокси). Параллельно.
// ═══════════════════════════════════════════════════════════════

export interface OrderbookResult {
  status: 'success' | 'error';
  bidsPct: number; asksPct: number;
  pressureRaw: number; pressureWeighted: number; pressureNear: number;
  totalBidsUsdt: number; totalAsksUsdt: number;
  midPrice: number | null;
  bestBidWall: { price: number; total: number } | null;
  bestAskWall: { price: number; total: number } | null;
  sources: string[]; sourceCount: number; sourcesFailed: string[];
}

const IS_DEV = (import.meta as any).env?.DEV;
const TIMEOUT = 6000;

async function getGateio(t: string): Promise<[string[][], string[][]]> {
  const base = IS_DEV ? '/proxy/gateio' : 'https://api.gateio.ws';
  const r = await fetch(`${base}/api/v4/spot/order_book?currency_pair=${t}_USDT&limit=100`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`gateio ${r.status}`);
  const d = await r.json();
  return [d.bids, d.asks];
}

async function getBinance(t: string): Promise<[string[][], string[][]]> {
  const base = IS_DEV ? '/proxy/binance-spot' : 'https://api.binance.com';
  const r = await fetch(`${base}/api/v3/depth?symbol=${t}USDT&limit=100`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`binance ${r.status}`);
  const d = await r.json();
  return [d.bids, d.asks];
}

async function getBybit(t: string): Promise<[string[][], string[][]]> {
  const base = IS_DEV ? '/proxy/bybit' : 'https://api.bybit.com';
  const r = await fetch(`${base}/v5/market/orderbook?category=spot&symbol=${t}USDT&limit=100`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`bybit ${r.status}`);
  const j = await r.json();
  if (j.retCode !== 0) throw new Error(`bybit ${j.retMsg}`);
  const res = j.result || {};
  if (!res.b?.length || !res.a?.length) throw new Error('bybit empty');
  return [res.b, res.a];
}

async function getOkx(t: string): Promise<[string[][], string[][]]> {
  const base = IS_DEV ? '/proxy/okx' : 'https://www.okx.com';
  const r = await fetch(`${base}/api/v5/market/books?instId=${t}-USDT&sz=100`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  const d = j.data?.[0];
  if (!d) throw new Error('okx empty');
  return [d.bids, d.asks];
}

async function getMexc(t: string): Promise<[string[][], string[][]]> {
  const base = IS_DEV ? '/proxy/mexc' : 'https://api.mexc.com';
  const r = await fetch(`${base}/api/v3/depth?symbol=${t}USDT&limit=100`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`mexc ${r.status}`);
  const d = await r.json();
  return [d.bids, d.asks];
}

const EXCHANGES = [
  { name: 'gateio',  fetch: getGateio },
  { name: 'binance', fetch: getBinance },
  { name: 'bybit',   fetch: getBybit },
  { name: 'okx',     fetch: getOkx },
  { name: 'mexc',    fetch: getMexc },
];

function cleanSpoof(levels: [number, number][], mid: number): [number, number][] {
  const side = levels.filter(([p]) => p > 0 && p < mid * 1.5);
  if (side.length < 3) return side;
  const total = side.reduce((s, [, q]) => s + q, 0);
  const maxOne = Math.max(...side.map(([, q]) => q));
  if (maxOne / total < 0.3) return side;
  const avg = (total - maxOne) / (side.length - 1);
  const cut = avg * 2.5;
  return side.map(([p, q]) => [p, q > cut ? cut : q] as [number, number]);
}

function pressureWeighted(bids: [number, number][], asks: [number, number][], mid: number): number {
  let wB = 0, wA = 0;
  for (const [p, q] of bids) wB += p * q * (1 / (1 + ((mid - p) / mid) * 100));
  for (const [p, q] of asks) wA += p * q * (1 / (1 + ((p - mid) / mid) * 100));
  return (wB - wA) / (wB + wA + 1e-9);
}

function pressureNear(bids: [number, number][], asks: [number, number][], mid: number): number {
  const lo = mid * 0.997, hi = mid * 1.003;
  const b = bids.filter(([p]) => p >= lo).reduce((s, [p, q]) => s + p * q, 0);
  const a = asks.filter(([p]) => p <= hi).reduce((s, [p, q]) => s + p * q, 0);
  return (b - a) / (b + a + 1e-9);
}

export async function getAggregatedOrderbook(ticker: string): Promise<OrderbookResult> {
  const t0 = performance.now();
  const results = await Promise.allSettled(
    EXCHANGES.map(async (ex) => {
      const [bids, asks] = await ex.fetch(ticker);
      return { name: ex.name, bids, asks };
    })
  );

  const rawBids: [number, number][] = [];
  const rawAsks: [number, number][] = [];
  const sourcesOk: string[] = [];
  const sourcesFailed: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    if (res.status === 'fulfilled') {
      const { bids, asks } = res.value;
      for (const [p, q] of bids) rawBids.push([parseFloat(p), parseFloat(q)]);
      for (const [p, q] of asks) rawAsks.push([parseFloat(p), parseFloat(q)]);
      sourcesOk.push(EXCHANGES[i].name);
    } else {
      sourcesFailed.push(EXCHANGES[i].name);
    }
  }

  if (!rawBids.length || !rawAsks.length) {
    return {
      status: 'error', bidsPct: 50, asksPct: 50,
      pressureRaw: 0, pressureWeighted: 0, pressureNear: 0,
      totalBidsUsdt: 0, totalAsksUsdt: 0,
      midPrice: null, bestBidWall: null, bestAskWall: null,
      sources: sourcesOk, sourceCount: sourcesOk.length, sourcesFailed,
    };
  }

  const bestBid = Math.max(...rawBids.map(([p]) => p));
  const bestAsk = Math.min(...rawAsks.map(([p]) => p));
  const midPrice = (bestBid + bestAsk) / 2;

  const bidsClean = cleanSpoof(rawBids, midPrice);
  const asksClean = cleanSpoof(rawAsks, midPrice);

  const totalBids = bidsClean.reduce((s, [p, q]) => s + p * q, 0);
  const totalAsks = asksClean.reduce((s, [p, q]) => s + p * q, 0);
  const total = totalBids + totalAsks;
  const bidsPct = total > 0 ? (totalBids / total) * 100 : 50;
  const pressureRaw = (totalBids - totalAsks) / (totalBids + totalAsks + 1e-9);
  const pressureW = pressureWeighted(bidsClean, asksClean, midPrice);
  const pressureN = pressureNear(bidsClean, asksClean, midPrice);

  const isFar = (p: number) => Math.abs(p - midPrice) / midPrice * 100 >= 1.0;
  const farBids = bidsClean.filter(([p]) => isFar(p));
  const farAsks = asksClean.filter(([p]) => isFar(p));
  const wallBid = farBids.length ? farBids.reduce((b, c) => c[0] * c[1] > b[0] * b[1] ? c : b) : null;
  const wallAsk = farAsks.length ? farAsks.reduce((b, c) => c[0] * c[1] > b[0] * b[1] ? c : b) : null;

  const ms = Math.round(performance.now() - t0);
  console.log(`[perf] orderbook ${ticker} in ${ms}ms, sources: ${sourcesOk.join(',')}, pressure: raw=${pressureRaw.toFixed(3)} w=${pressureW.toFixed(3)} near=${pressureN.toFixed(3)}`);

  return {
    status: 'success',
    bidsPct: Math.round(bidsPct * 10) / 10,
    asksPct: Math.round((100 - bidsPct) * 10) / 10,
    pressureRaw: Math.round(pressureRaw * 1000) / 1000,
    pressureWeighted: Math.round(pressureW * 1000) / 1000,
    pressureNear: Math.round(pressureN * 1000) / 1000,
    totalBidsUsdt: Math.round(totalBids * 100) / 100,
    totalAsksUsdt: Math.round(totalAsks * 100) / 100,
    midPrice,
    bestBidWall: wallBid ? { price: wallBid[0], total: wallBid[0] * wallBid[1] } : null,
    bestAskWall: wallAsk ? { price: wallAsk[0], total: wallAsk[0] * wallAsk[1] } : null,
    sources: sourcesOk, sourceCount: sourcesOk.length, sourcesFailed,
  };
}