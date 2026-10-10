// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · FUNDING — Bybit + OKX
// Binance Futures НЕ используем (403 из РФ)
// ═══════════════════════════════════════════════════════════════

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

const SOURCES = [
  { name: 'bybit', fetch: fromBybit },
  { name: 'okx',   fetch: fromOkx },
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