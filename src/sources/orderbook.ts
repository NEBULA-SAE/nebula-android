// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · СТАКАН + ПРАВДИВОЕ ДАВЛЕНИЕ
// Gate.io, Binance, Bybit, OKX, MEXC, KuCoin
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
const TIMEOUT = 3500;
const EXCHANGE_COOLDOWN_MS = 60_000;

const _exchangeCooldownUntil = new Map<string, number>();

function isCoolingDown(name: string): boolean {
  const until = _exchangeCooldownUntil.get(name) || 0;
  if (until <= Date.now()) {
    _exchangeCooldownUntil.delete(name);
    return false;
  }
  return true;
}

function setExchangeCooldown(name: string): void {
  _exchangeCooldownUntil.set(name, Date.now() + EXCHANGE_COOLDOWN_MS);
}

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

async function getKucoin(t: string): Promise<[string[][], string[][]]> {
  const base = IS_DEV ? '/proxy/kucoin' : 'https://api.kucoin.com';
  const r = await fetch(
    `${base}/api/v1/market/orderbook/level2_100?symbol=${t}-USDT`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );
  if (!r.ok) throw new Error(`kucoin ${r.status}`);
  const j = await r.json();
  if (j.code !== '200000') throw new Error(`kucoin ${j.msg}`);
  const d = j.data;
  if (!d?.bids?.length || !d?.asks?.length) throw new Error('kucoin empty');
  return [d.bids, d.asks];
}

const EXCHANGES = [
  { name: 'gateio',  fetch: getGateio },
  { name: 'binance', fetch: getBinance },
  { name: 'bybit',   fetch: getBybit },
  { name: 'okx',     fetch: getOkx },
  { name: 'mexc',    fetch: getMexc },
  { name: 'kucoin',  fetch: getKucoin },
];

function cleanSpoof(levels: [number, number][], mid: number): [number, number][] {
  const side = levels.filter(([p]) => p > 0 && p < mid * 1.5);
  if (side.length < 3) return side;
  return side;
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

const _orderbookPending = new Map<string, Promise<OrderbookResult>>();

export async function getAggregatedOrderbook(ticker: string): Promise<OrderbookResult> {
  const key = ticker.toUpperCase();

  if (_orderbookPending.has(key)) {
    return _orderbookPending.get(key)!;
  }

  const fetchPromise = (async (): Promise<OrderbookResult> => {
    const t0 = performance.now();

    const activeExchanges = EXCHANGES.filter(ex => !isCoolingDown(ex.name));
    const skippedExchanges = EXCHANGES.filter(ex => isCoolingDown(ex.name));
    const candidates = activeExchanges.length > 0 ? activeExchanges : EXCHANGES;

    const results = await Promise.allSettled(
      candidates.map(async (ex) => {
        const [bids, asks] = await ex.fetch(ticker);
        return { name: ex.name, bids, asks };
      })
    );

    const rawBids: [number, number][] = [];
    const rawAsks: [number, number][] = [];
    const sourcesOk: string[] = [];
    const sourcesFailed: string[] = activeExchanges.length > 0
      ? skippedExchanges.map(ex => ex.name)
      : [];

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const exName = candidates[i].name;
      if (res.status === 'fulfilled') {
        const { bids, asks } = res.value;
        for (const [p, q] of bids) rawBids.push([parseFloat(p), parseFloat(q)]);
        for (const [p, q] of asks) rawAsks.push([parseFloat(p), parseFloat(q)]);
        sourcesOk.push(exName);
      } else {
        setExchangeCooldown(exName);
        sourcesFailed.push(exName);
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

    const isFar = (p: number) => {
      const dist = Math.abs(p - midPrice) / midPrice * 100;
      return dist >= 0.5 && dist <= 5.0;
    };

    const farBids = bidsClean.filter(([p]) => isFar(p));
    const farAsks = asksClean.filter(([p]) => isFar(p));

    const findBestWall = (levels: [number, number][]) => {
      if (!levels.length) return null;
      const sorted = levels.sort((a, b) => b[0] - a[0]);

      let bestWall = sorted[0];
      let maxVolume = bestWall[0] * bestWall[1];

      for (let i = 0; i < sorted.length; i++) {
        const [p, q] = sorted[i];
        const cluster = sorted.filter(([cp]) => Math.abs(cp - p) / p < 0.002);
        const clusterVol = cluster.reduce((sum, [, cq]) => sum + cq * p, 0);

        if (clusterVol > maxVolume) {
          maxVolume = clusterVol;
          bestWall = [p, clusterVol / p];
        }
      }
      return bestWall;
    };

    const wallBid = findBestWall(farBids);
    const wallAsk = findBestWall(farAsks);

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
  })();

  _orderbookPending.set(key, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    _orderbookPending.delete(key);
  }
}