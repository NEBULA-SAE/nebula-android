// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · FUNDING — Bybit + OKX + KuCoin
// ═══════════════════════════════════════════════════════════════

const IS_DEV = (import.meta as any).env?.DEV;

export interface FundingResult {
  status: 'success' | 'error';
  avgFunding: number;
  rates: Record<string, number>;
  sources: string[];
  sourceCount: number;
  message?: string;
}

const TIMEOUT = 6000;

async function fromBybit(t: string): Promise<number> {
  const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${t}USDT`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`bybit ${r.status}`);
  const d = await r.json();
  const item = d.result?.list?.[0];
  if (!item) throw new Error('bybit empty');
  return parseFloat(item.fundingRate) * 100;
}

async function fromOkx(t: string): Promise<number> {
  const r = await fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${t}-USDT-SWAP`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  const d = j.data?.[0];
  if (!d) throw new Error('okx empty');
  return parseFloat(d.fundingRate) * 100;
}

async function fromKucoin(t: string): Promise<number> {
  // ✅ Новый Unified API KuCoin — тот же домен, что и spot
  const base = IS_DEV ? '/proxy/kucoin' : 'https://api.kucoin.com';

  // Символ для USDT-M перпетуалов: DASHUSDTM (M = perpetual)
  const r = await fetch(
    `${base}/api/ua/v2/market/funding-rate?symbol=${t}USDTM&productType=USDT-FUTURES`,
    { signal: AbortSignal.timeout(TIMEOUT) }
  );

  if (!r.ok) throw new Error(`kucoin HTTP ${r.status}`);

  const j = await r.json();
  if (j.code !== '200000') {
    throw new Error(`kucoin ${j.code}: ${j.msg || 'no data'}`);
  }

  const item = j.data?.[0];
  if (!item) throw new Error('kucoin empty (maybe no futures for this coin)');

  // В ответе nextFundingRate (доля): 0.000075 → 0.0075%
  const rate = parseFloat(item.nextFundingRate || '0') * 100;
  return rate;
}

const SOURCES = [
  { name: 'bybit',  fetch: fromBybit },
  { name: 'okx',    fetch: fromOkx },
  { name: 'kucoin', fetch: fromKucoin },
];

export async function getAggregatedFunding(ticker: string): Promise<FundingResult> {
  const results = await Promise.allSettled(
    SOURCES.map(async (s) => ({ name: s.name, rate: await s.fetch(ticker) }))
  );

  const rates: Record<string, number> = {};
  const sourcesOk: string[] = [];
  for (const res of results) {
    if (res.status === 'fulfilled') {
      rates[res.value.name] = Math.round(res.value.rate * 10000) / 10000;
      sourcesOk.push(res.value.name);
    } else {
      console.warn(`[funding] ${res.reason?.message || 'failed'}`);
    }
  }

  if (sourcesOk.length === 0) {
    return { status: 'error', avgFunding: 0, rates: {}, sources: [], sourceCount: 0, message: 'No data' };
  }

  const avg = sourcesOk.reduce((s, n) => s + rates[n], 0) / sourcesOk.length;
  return {
    status: 'success',
    avgFunding: Math.round(avg * 10000) / 10000,
    rates, sources: sourcesOk, sourceCount: sourcesOk.length,
  };
}