// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · FUNDING — Bybit + OKX + KuCoin + Binance + Gate.io
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

const TIMEOUT = 3500;
const COOLDOWN_MS = 60_000;
const _cooldownUntil = new Map<string, number>();

function isCoolingDown(name: string): boolean {
  const until = _cooldownUntil.get(name) || 0;
  if (until <= Date.now()) {
    _cooldownUntil.delete(name);
    return false;
  }
  return true;
}

function setCooldown(name: string): void {
  _cooldownUntil.set(name, Date.now() + COOLDOWN_MS);
}

async function fromBybit(t: string): Promise<number> {
  const base = IS_DEV ? '/proxy/bybit' : 'https://api.bybit.com';
  const r = await fetch(`${base}/v5/market/tickers?category=linear&symbol=${t}USDT`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`bybit ${r.status}`);
  const d = await r.json();
  const item = d.result?.list?.[0];
  if (!item || item.fundingRate == null) throw new Error('bybit empty');
  return parseFloat(item.fundingRate) * 100;
}

async function fromOkx(t: string): Promise<number> {
  const base = IS_DEV ? '/proxy/okx' : 'https://www.okx.com';
  const r = await fetch(`${base}/api/v5/public/funding-rate?instId=${t}-USDT-SWAP`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`okx ${r.status}`);
  const j = await r.json();
  const d = j.data?.[0];
  if (!d || d.fundingRate == null) throw new Error('okx empty');
  return parseFloat(d.fundingRate) * 100;
}

async function fromKucoin(t: string): Promise<number> {
  const base = IS_DEV ? '/proxy/kucoin' : 'https://api.kucoin.com';
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
  if (!item || item.nextFundingRate == null) throw new Error('kucoin empty');
  return parseFloat(item.nextFundingRate) * 100;
}

async function fromBinanceFutures(t: string): Promise<number> {
  const base = IS_DEV ? '/proxy/binance-futures' : 'https://fapi.binance.com';
  const r = await fetch(`${base}/fapi/v1/premiumIndex?symbol=${t}USDT`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`binance_futures ${r.status}`);
  const d = await r.json();
  if (!d || d.lastFundingRate == null) throw new Error('binance_futures empty');
  return parseFloat(d.lastFundingRate) * 100;
}

async function fromGateio(t: string): Promise<number> {
  const base = IS_DEV ? '/proxy/gateio' : 'https://api.gateio.ws';
  const r = await fetch(`${base}/api/v4/futures/usdt/contracts/${t}_USDT`,
    { signal: AbortSignal.timeout(TIMEOUT) });
  if (!r.ok) throw new Error(`gateio ${r.status}`);
  const d = await r.json();
  if (!d || d.funding_rate == null) throw new Error('gateio empty');
  return parseFloat(d.funding_rate) * 100;
}

const SOURCES = [
  { name: 'bybit',           fetch: fromBybit },
  { name: 'okx',             fetch: fromOkx },
  { name: 'kucoin',          fetch: fromKucoin },
  { name: 'binance_futures', fetch: fromBinanceFutures },
  { name: 'gateio',          fetch: fromGateio },
];

export async function getAggregatedFunding(ticker: string): Promise<FundingResult> {
  const sym = ticker.toUpperCase();
  const active = SOURCES.filter(s => !isCoolingDown(s.name));
  const candidates = active.length > 0 ? active : SOURCES;

  const results = await Promise.allSettled(
    candidates.map(async (s) => ({ name: s.name, rate: await s.fetch(sym) }))
  );

  const rates: Record<string, number> = {};
  const sourcesOk: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const srcName = candidates[i].name;
    if (res.status === 'fulfilled') {
      rates[res.value.name] = Math.round(res.value.rate * 10000) / 10000;
      sourcesOk.push(res.value.name);
    } else {
      setCooldown(srcName);
      console.warn(`[funding] ${srcName}: ${res.reason?.message || 'failed'}`);
    }
  }

  if (sourcesOk.length === 0) {
    return { status: 'error', avgFunding: 0, rates: {}, sources: [], sourceCount: 0, message: 'No data' };
  }

  const avg = sourcesOk.reduce((s, n) => s + rates[n], 0) / sourcesOk.length;
  return {
    status: 'success',
    avgFunding: Math.round(avg * 10000) / 10000,
    rates,
    sources: sourcesOk,
    sourceCount: sourcesOk.length,
  };
}