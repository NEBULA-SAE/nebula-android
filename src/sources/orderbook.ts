// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · СТАКАН + ПРАВДИВОЕ ДАВЛЕНИЕ + УМНЫЙ АНАЛИЗ СТЕНОК
// Gate.io, Binance, Bybit, OKX, MEXC, KuCoin
// ═══════════════════════════════════════════════════════════════

export interface WallInfo {
  price: number;        // VWAP-цена кластера стенки
  total: number;        // Объём стенки в USDT
  distPct: number;      // Дистанция от midPrice в %
  sharePct: number;     // Доля объёма стенки от всей стороны (bids/asks) в %
  exchanges: string[];  // Биржи, где подтверждён крупный объём в этой зоне
  exchangeCount: number;
  status: 'new' | 'steady' | 'growing' | 'shrinking' | 'pulled';
  changePct: number;    // Изменение объёма относительно прошлого цикла в %
}

export interface OrderbookResult {
  status: 'success' | 'error';
  bidsPct: number; asksPct: number;
  pressureRaw: number; pressureWeighted: number; pressureNear: number;
  totalBidsUsdt: number; totalAsksUsdt: number;
  midPrice: number | null;
  bestBidWall: WallInfo | null;
  bestAskWall: WallInfo | null;
  wallSummary: {
    dominantSide: 'bid' | 'ask' | 'balanced';
    ratio: number;
    closerSide: 'bid' | 'ask' | 'equal';
    alertNote: string | null;
  } | null;
  sources: string[]; sourceCount: number; sourcesFailed: string[];
}

interface ExchangeBook {
  name: string;
  bids: [number, number][];
  asks: [number, number][];
}

interface PrevWallSnapshot {
  ts: number;
  bidWall: { price: number; total: number } | null;
  askWall: { price: number; total: number } | null;
}

const IS_DEV = (import.meta as any).env?.DEV;
const TIMEOUT = 3500;
const EXCHANGE_COOLDOWN_MS = 60_000;
const WALL_MEMORY_TTL_MS = 120_000;

const _exchangeCooldownUntil = new Map<string, number>();
const _prevWalls = new Map<string, PrevWallSnapshot>();

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

function sanitizeSide(levels: [number, number][], mid: number, side: 'bid' | 'ask'): [number, number][] {
  return levels.filter(([p, q]) => {
    if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) return false;
    const distPct = Math.abs(p - mid) / mid * 100;
    if (distPct > 15) return false;
    if (side === 'bid') return p <= mid * 1.005;
    return p >= mid * 0.995;
  });
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

function detectWall(
  books: ExchangeBook[],
  side: 'bid' | 'ask',
  mid: number,
  sideTotalUsdt: number,
  prev: { price: number; total: number } | null
): WallInfo | null {
  const combined: [number, number][] = [];
  for (const b of books) {
    const lvls = side === 'bid' ? b.bids : b.asks;
    for (const [p, q] of lvls) {
      const distPct = Math.abs(p - mid) / mid * 100;
      // Ищем стенки в рабочей зоне 0.25% – 4.5% от midPrice
      if (distPct >= 0.25 && distPct <= 4.5) {
        if (side === 'bid' && p < mid) combined.push([p, q]);
        if (side === 'ask' && p > mid) combined.push([p, q]);
      }
    }
  }

  if (!combined.length || sideTotalUsdt <= 0) {
    if (prev && prev.total > 0) {
      const distPct = Math.abs(prev.price - mid) / mid * 100;
      return {
        price: prev.price,
        total: 0,
        distPct: Math.round(distPct * 100) / 100,
        sharePct: 0,
        exchanges: [],
        exchangeCount: 0,
        status: 'pulled',
        changePct: -100,
      };
    }
    return null;
  }

  // Группируем уровни в корзины по 0.15% вокруг каждого кандидата и берём самую плотную по USDT
  let bestCluster = {
    price: combined[0][0],
    totalUsdt: combined[0][0] * combined[0][1],
    minP: combined[0][0],
    maxP: combined[0][0],
  };

  for (let i = 0; i < combined.length; i++) {
    const [anchorP] = combined[i];
    let sumUsdt = 0;
    let sumQty = 0;
    let minP = anchorP;
    let maxP = anchorP;

    for (let j = 0; j < combined.length; j++) {
      const [p, q] = combined[j];
      if (Math.abs(p - anchorP) / anchorP <= 0.0015) {
        sumUsdt += p * q;
        sumQty += q;
        if (p < minP) minP = p;
        if (p > maxP) maxP = p;
      }
    }

    if (sumUsdt > bestCluster.totalUsdt && sumQty > 0) {
      bestCluster = {
        price: sumUsdt / sumQty,
        totalUsdt: sumUsdt,
        minP,
        maxP,
      };
    }
  }

  // Проверяем, на каких биржах в этой ценовой зоне есть заметный объём
  const confirmedExchanges: string[] = [];
  for (const b of books) {
    const lvls = side === 'bid' ? b.bids : b.asks;
    const exVol = lvls.reduce((acc, [p, q]) => {
      if (p >= bestCluster.minP * 0.9985 && p <= bestCluster.maxP * 1.0015) {
        return acc + p * q;
      }
      return acc;
    }, 0);
    if (exVol >= bestCluster.totalUsdt * 0.12 || exVol >= sideTotalUsdt * 0.03) {
      confirmedExchanges.push(b.name);
    }
  }

  const distPct = Math.abs(bestCluster.price - mid) / mid * 100;
  const sharePct = (bestCluster.totalUsdt / sideTotalUsdt) * 100;

  let status: WallInfo['status'] = 'new';
  let changePct = 0;

  if (prev && prev.total > 0) {
    changePct = ((bestCluster.totalUsdt - prev.total) / prev.total) * 100;
    const nearPrevPrice = Math.abs(bestCluster.price - prev.price) / prev.price <= 0.004;
    if (nearPrevPrice) {
      if (changePct <= -40) status = 'pulled';
      else if (changePct <= -15) status = 'shrinking';
      else if (changePct >= 20) status = 'growing';
      else status = 'steady';
    }
  }

  return {
    price: bestCluster.price,
    total: Math.round(bestCluster.totalUsdt * 100) / 100,
    distPct: Math.round(distPct * 100) / 100,
    sharePct: Math.round(sharePct * 10) / 10,
    exchanges: confirmedExchanges,
    exchangeCount: confirmedExchanges.length,
    status,
    changePct: Math.round(changePct * 10) / 10,
  };
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

    const parsedBooks: ExchangeBook[] = [];
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
        const bNum: [number, number][] = [];
        const aNum: [number, number][] = [];
        for (const [p, q] of bids) {
          const pn = parseFloat(p), qn = parseFloat(q);
          if (Number.isFinite(pn) && Number.isFinite(qn)) {
            rawBids.push([pn, qn]);
            bNum.push([pn, qn]);
          }
        }
        for (const [p, q] of asks) {
          const pn = parseFloat(p), qn = parseFloat(q);
          if (Number.isFinite(pn) && Number.isFinite(qn)) {
            rawAsks.push([pn, qn]);
            aNum.push([pn, qn]);
          }
        }
        if (bNum.length && aNum.length) {
          parsedBooks.push({ name: exName, bids: bNum, asks: aNum });
          sourcesOk.push(exName);
        } else {
          setExchangeCooldown(exName);
          sourcesFailed.push(exName);
        }
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
        midPrice: null, bestBidWall: null, bestAskWall: null, wallSummary: null,
        sources: sourcesOk, sourceCount: sourcesOk.length, sourcesFailed,
      };
    }

    const bestBid = Math.max(...rawBids.map(([p]) => p));
    const bestAsk = Math.min(...rawAsks.map(([p]) => p));
    const midPrice = (bestBid + bestAsk) / 2;

    const bidsClean = sanitizeSide(rawBids, midPrice, 'bid');
    const asksClean = sanitizeSide(rawAsks, midPrice, 'ask');

    const cleanBooks: ExchangeBook[] = parsedBooks.map(b => ({
      name: b.name,
      bids: sanitizeSide(b.bids, midPrice, 'bid'),
      asks: sanitizeSide(b.asks, midPrice, 'ask'),
    }));

    const totalBids = bidsClean.reduce((s, [p, q]) => s + p * q, 0);
    const totalAsks = asksClean.reduce((s, [p, q]) => s + p * q, 0);
    const total = totalBids + totalAsks;
    const bidsPct = total > 0 ? (totalBids / total) * 100 : 50;
    const pressureRaw = (totalBids - totalAsks) / (totalBids + totalAsks + 1e-9);
    const pressureW = pressureWeighted(bidsClean, asksClean, midPrice);
    const pressureN = pressureNear(bidsClean, asksClean, midPrice);

    const prevSnap = _prevWalls.get(key);
    const validPrev = prevSnap && (Date.now() - prevSnap.ts < WALL_MEMORY_TTL_MS) ? prevSnap : null;

    const bestBidWall = detectWall(cleanBooks, 'bid', midPrice, totalBids, validPrev?.bidWall ?? null);
    const bestAskWall = detectWall(cleanBooks, 'ask', midPrice, totalAsks, validPrev?.askWall ?? null);

    _prevWalls.set(key, {
      ts: Date.now(),
      bidWall: bestBidWall && bestBidWall.total > 0 ? { price: bestBidWall.price, total: bestBidWall.total } : null,
      askWall: bestAskWall && bestAskWall.total > 0 ? { price: bestAskWall.price, total: bestAskWall.total } : null,
    });

    let wallSummary: OrderbookResult['wallSummary'] = null;
    if (bestBidWall && bestAskWall) {
      const ratio = bestAskWall.total > 0
        ? Math.round((bestBidWall.total / bestAskWall.total) * 100) / 100
        : 1;
      const dominantSide: 'bid' | 'ask' | 'balanced' =
        ratio >= 1.35 ? 'bid' : ratio <= 0.74 ? 'ask' : 'balanced';
      const closerSide: 'bid' | 'ask' | 'equal' =
        bestBidWall.distPct < bestAskWall.distPct * 0.85 ? 'bid'
        : bestAskWall.distPct < bestBidWall.distPct * 0.85 ? 'ask'
        : 'equal';

      let alertNote: string | null = null;
      if (bestBidWall.status === 'pulled') {
        alertNote = 'pulled_bid';
      } else if (bestAskWall.status === 'pulled') {
        alertNote = 'pulled_ask';
      } else if (bestBidWall.exchangeCount <= 1 && bestAskWall.exchangeCount <= 1) {
        alertNote = 'single_exchange';
      }

      wallSummary = { dominantSide, ratio, closerSide, alertNote };
    }

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
      bestBidWall,
      bestAskWall,
      wallSummary,
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