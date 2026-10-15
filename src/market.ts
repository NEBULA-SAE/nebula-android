// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MARKET
// Coinpaprika + Alternative.me + ЦБ РФ + OKX (всё через прокси)
// ═══════════════════════════════════════════════════════════════

import {
  ema,
  calcRsiSimple, calcRsi,
  calcMacd, calcBollinger, calcAtr, calcAdx, calcStochRsi,
  findSupportResistance, detectDivergence, calcVolumeProfile,
  enhancedMarketRegime,
} from './indicators';
import { fetchCandlesWithSource } from './sources/candles';
import { P } from './config';

const COINPAPRIKA = P('coinpaprika', 'https://api.coinpaprika.com');
const FNG         = P('fng',         'https://api.alternative.me');
const CBR         = P('cbr',         'https://www.cbr-xml-daily.ru');
const OKX_BASE    = P('okx',         'https://www.okx.com');

// ═══════════════════════════════════════════════════════════════
// КУРС USDT / RUB
// ═══════════════════════════════════════════════════════════════

let _rateCache: { value: number; ts: number } | null = null;

export async function getCurrentRate(): Promise<number> {
  if (_rateCache && Date.now() - _rateCache.ts < 300_000) {
    return _rateCache.value;
  }

  const rates: number[] = [];

  // OKX USDT/RUB
  try {
    const r = await fetch(`${OKX_BASE}/api/v5/market/ticker?instId=USDT-RUB`,
      { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      const v = d?.data?.[0]?.last ? parseFloat(d.data[0].last) : 0;
      if (v > 50 && v < 200) rates.push(v);
    }
  } catch { /* silent */ }

  // ЦБ РФ USD/RUB
  try {
    const r = await fetch(`${CBR}/daily_json.js`,
      { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      const v = d?.Valute?.USD?.Value;
      if (v > 50 && v < 200) rates.push(v);
    }
  } catch { /* silent */ }

  let result: number;
  if (rates.length >= 2) {
    result = Math.round(((rates[0] + rates[1]) / 2) * 100) / 100;
  } else if (rates.length === 1) {
    result = Math.round(rates[0] * 100) / 100;
  } else {
    result = 95.00;
  }

  _rateCache = { value: result, ts: Date.now() };
  return result;
}

// ═══════════════════════════════════════════════════════════════
// ON-CHAIN (DEX pools)
// ═══════════════════════════════════════════════════════════════

export interface OnchainPool {
  dex: string; pair: string; price_usd: number;
  volume_24h: number; liquidity: number; txns_24h: number;
}

export interface OnchainData {
  status: 'success' | 'error';
  token?: any;
  pools?: OnchainPool[];
  message?: string;
}

export async function getOnchainData(ticker: string): Promise<OnchainData> {
  try {
    const s = await fetch(`https://api.dexpaprika.com/search?query=${ticker}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!s.ok) return { status: 'error', message: 'DexPaprika недоступен' };
    const sj = await s.json();
    const results = (sj?.tokens || []).slice(0, 3);
    if (!results.length) return { status: 'error', message: 'Токен не найден в DEX' };

    const token = results[0];
    const tid = token.id || token.address;
    const chain = token.chain || 'ethereum';

    const p = await fetch(
      `https://api.dexpaprika.com/networks/${chain}/tokens/${tid}/pools`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!p.ok) return { status: 'success', token, pools: [] };

    const pj = await p.json();
    const pl = (pj?.pools || []).slice(0, 5);

    return {
      status: 'success',
      token,
      pools: pl.map((x: any) => ({
        dex: x.dex_name,
        pair: `${x.token0?.symbol || '?'}/${x.token1?.symbol || '?'}`,
        price_usd: x.price_usd,
        volume_24h: x.volume_usd || 0,
        liquidity: x.liquidity_usd || 0,
        txns_24h: x.transactions || 0,
      })),
    };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// РЫНОЧНЫЙ КОНТЕКСТ
// ═══════════════════════════════════════════════════════════════

export interface MarketContext {
  status: 'success' | 'error';
  updated: number;
  total_mcap?: number;
  total_vol?: number;
  btc_dominance?: number;
  eth_dominance?: number;
  mcap_change_24h?: number;
  active_cryptos?: number;
  fear_greed?: number;
  fear_greed_text?: string;
  btc?: any;
  trending?: any[];
  regime: string;
  regime_desc: string;
  regime_color: string;
  btc_rsi: number;
  btc_trend: string;
  sentiment_warning: string | null;
  aggression_modifier: number;
  message?: string;
}

let _marketCache: { value: MarketContext; ts: number } | null = null;

export async function getMarketContext(): Promise<MarketContext> {
  if (_marketCache && Date.now() - _marketCache.ts < 60_000) {
    return _marketCache.value;
  }

  const result: any = { status: 'success', updated: Math.floor(Date.now() / 1000) };

  // ─── Global — Coinpaprika ───
  try {
    const r = await fetch(`${COINPAPRIKA}/v1/global`, {
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (r.ok) {
      const d = await r.json();
      result.total_mcap = d.market_cap_usd;
      result.total_vol = d.volume_24h_usd;
      result.btc_dominance = Math.round((d.bitcoin_dominance_percentage || 0) * 100) / 100;
      result.eth_dominance = Math.round((d.ethereum_dominance_percentage || 0) * 100) / 100;
      result.mcap_change_24h = Math.round((d.market_cap_change_24h || 0) * 100) / 100;
      result.active_cryptos = d.cryptocurrencies_number || 0;
    }
  } catch { /* silent */ }

  // ─── Fear & Greed ───
  try {
    const r = await fetch(`${FNG}/fng/?limit=1`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const d = await r.json();
      const f = d.data?.[0];
      if (f) {
        result.fear_greed = parseInt(f.value, 10);
        result.fear_greed_text = f.value_classification;
      }
    }
  } catch { /* silent */ }

  // ─── BTC — Coinpaprika ───
  try {
    const r = await fetch(`${COINPAPRIKA}/v1/tickers/btc-bitcoin`, {
      signal: AbortSignal.timeout(7000),
    });
    if (r.ok) {
      const bd = await r.json();
      const q = bd.quotes?.USD || {};
      result.btc = {
        price: q.price || 0,
        change_24h: Math.round((q.percent_change_24h || 0) * 100) / 100,
        change_7d: Math.round((q.percent_change_7d || 0) * 100) / 100,
        change_30d: Math.round((q.percent_change_30d || 0) * 100) / 100,
        market_cap: q.market_cap || 0,
        volume: q.volume_24h || 0,
        ath: q.ath_price || 0,
        ath_change: Math.round((q.percent_from_price_ath || 0) * 100) / 100,
        high_24h: q.high_24h || 0,
        low_24h: q.low_24h || 0,
      };
    }
  } catch { /* silent */ }

  // ─── Trending — Coinpaprika ───
  try {
    const r = await fetch(`${COINPAPRIKA}/v1/tickers?limit=15`, {
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const tj = await r.json();
      result.trending = (tj || []).slice(0, 7).map((c: any) => ({
        name: c.name,
        symbol: (c.symbol || '').toUpperCase(),
        rank: c.rank || '?',
        score: Math.round((c.quotes?.USD?.percent_change_24h || 0) * 100) / 100,
      }));
    }
  } catch { /* silent */ }

  const mc = result.mcap_change_24h || 0;
  const bd = result.btc_dominance || 50;
  const fv = result.fear_greed || 50;

  let btcRsi = 50;
  let btcTrend: 'up' | 'down' = 'up';
  try {
    const { data } = await fetchCandlesWithSource('BTC', 60);
    const closes = data.map(c => c.close);
    btcRsi = calcRsiSimple(closes, 14);
    btcTrend = ema(closes.slice(-20), 20) > ema(closes.slice(-50), 50) ? 'up' : 'down';
  } catch { /* silent */ }

  const regime = enhancedMarketRegime(mc, bd, fv, btcRsi, btcTrend);
  const regimeColors: Record<string, string> = {
    bull_btc: 'mint',
    altseason: 'violet',
    bull_mild: 'mint',
    bearish: 'coral',
    bear_mild: 'coral',
    neutral: 'amber',
  };

  result.regime = regime.regime;
  result.regime_desc = regime.description;
  result.regime_color = regimeColors[regime.regime] || 'amber';
  result.btc_rsi = Math.round(btcRsi * 10) / 10;
  result.btc_trend = btcTrend;

  if (fv > 75) {
    result.sentiment_warning = '⚠️ Extreme Greed — рынок перегрет';
    result.aggression_modifier = -0.3;
  } else if (fv < 25) {
    result.sentiment_warning = '💎 Extreme Fear — потенциально хорошее время для покупок';
    result.aggression_modifier = 0.3;
  } else {
    result.sentiment_warning = null;
    result.aggression_modifier = 0;
  }

  _marketCache = { value: result as MarketContext, ts: Date.now() };
  return result as MarketContext;
}

// ═══════════════════════════════════════════════════════════════
// BTC DAILY
// ═══════════════════════════════════════════════════════════════

let _btcCache: { value: any; ts: number } | null = null;

export async function getBtcDailyAnalysis(): Promise<any> {
  if (_btcCache && Date.now() - _btcCache.ts < 90_000) {
    return _btcCache.value;
  }
  try {
    const ctx = await getMarketContext();
    const btc = ctx.btc || {};

    const { data } = await fetchCandlesWithSource('BTC', 120);
    const closes = data.map(c => c.close);
    const highs = data.map(c => c.high);
    const lows = data.map(c => c.low);
    const vols = data.map(c => c.volume);

    const cp = closes[closes.length - 1];
    const m120 = Math.max(...highs);
    const n120 = Math.min(...lows);
    const rsiVal = calcRsi(closes);
    const reb = ((cp - n120) / n120) * 100;
    const drop = ((m120 - cp) / m120) * 100;
    const av = vols.slice(-30).reduce((a, b) => a + b, 0) / 30;
    const vr = av > 0 ? (vols[vols.length - 1] / av) * 100 : 100;
    const e20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const e50 = closes.length >= 50
      ? closes.slice(-50).reduce((a, b) => a + b, 0) / 50
      : e20;
    const trend = e20 > e50 ? 'up' : 'down';
    const macdR = calcMacd(closes);
    const bb = calcBollinger(closes);
    const adxVal = calcAdx(highs, lows, closes);
    const stoch = calcStochRsi(closes);

    let v: string;
    let adv: string;
    if (rsiVal < 35 && reb < 25) {
      v = 'buy_zone';
      adv = '🟢 BTC на дне 120-дневного диапазона. Отличная зона для накопления.';
    } else if (rsiVal > 70 || reb > 70) {
      v = 'sell_zone';
      adv = '🔴 BTC перегрет. Вероятна коррекция.';
    } else if (trend === 'up' && rsiVal < 55) {
      v = 'bullish';
      adv = '📈 BTC в здоровом восходящем тренде.';
    } else if (trend === 'down') {
      v = 'bearish';
      adv = '📉 BTC в нисходящем тренде. Подожди разворота.';
    } else {
      v = 'neutral';
      adv = '⚖️ BTC консолидируется.';
    }

    const result = {
      status: 'success',
      price: cp,
      change_24h: btc.change_24h || 0,
      change_7d: btc.change_7d || 0,
      rsi: Math.round(rsiVal * 10) / 10,
      rebound_pct: Math.round(reb * 10) / 10,
      drop_pct: Math.round(drop * 10) / 10,
      volume_ratio: Math.round(vr * 10) / 10,
      trend,
      ema20: Math.round(e20 * 100) / 100,
      ema50: Math.round(e50 * 100) / 100,
      max_120: m120,
      min_120: n120,
      verdict: v,
      advice: adv,
      ath: btc.ath || 0,
      ath_change: btc.ath_change || 0,
      macd: Math.round(macdR.macd * 1e4) / 1e4,
      macd_hist: Math.round(macdR.hist * 1e4) / 1e4,
      bb_percent: Math.round(bb.percent_b * 10) / 10,
      adx: Math.round(adxVal * 10) / 10,
      stoch_rsi: Math.round(stoch * 10) / 10,
    };
    _btcCache = { value: result, ts: Date.now() };
    return result;
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// ADVANCED ANALYTICS
// ═══════════════════════════════════════════════════════════════

export interface AdvancedAnalytics {
  status: 'success' | 'error';
  ticker: string;
  price: number;
  macd: { line: number; signal: number; histogram: number; crossover: 'bullish' | 'bearish' | 'neutral'; };
  bollinger: { upper: number; middle: number; lower: number; percent_b?: number; bandwidth?: number; state: 'oversold' | 'overbought' | 'normal'; };
  atr: { value: number; percent: number; suggested_stop_pct: number; suggested_tp_pct: number; };
  adx: { value: number; trend_strength: string };
  stoch_rsi: { value: number; state: 'oversold' | 'overbought' | 'neutral' };
  support_resistance: { resistance: number[]; support: number[]; nearest_r?: number; nearest_s?: number; };
  divergence: { type: 'bullish' | 'bearish' | null; strength: number };
  volume_profile: { poc: number; va_low: number; va_high: number };
  message?: string;
}

const _advCache = new Map<string, { value: AdvancedAnalytics; ts: number }>();

export async function getAdvancedAnalytics(ticker: string): Promise<AdvancedAnalytics> {
  const cached = _advCache.get(ticker);
  if (cached && Date.now() - cached.ts < 300_000) {
    return cached.value;
  }

  try {
    const { data } = await fetchCandlesWithSource(ticker, 120);
    const closes = data.map(c => c.close);
    const highs = data.map(c => c.high);
    const lows = data.map(c => c.low);
    const volumes = data.map(c => c.volume);

    const macdR = calcMacd(closes);
    const bb = calcBollinger(closes);
    const atr = calcAtr(highs, lows, closes);
    const adxVal = calcAdx(highs, lows, closes);
    const stoch = calcStochRsi(closes);
    const sr = findSupportResistance(highs, lows, closes);
    const div = detectDivergence(closes);
    const vp = calcVolumeProfile(highs, lows, closes, volumes);

    const price = closes[closes.length - 1];
    const atrPct = price > 0 ? (atr / price) * 100 : 0;

    let trendStrength: string;
    if (adxVal > 40) trendStrength = 'very_strong';
    else if (adxVal > 25) trendStrength = 'strong';
    else if (adxVal > 15) trendStrength = 'weak';
    else trendStrength = 'flat';

    let bbState: 'oversold' | 'overbought' | 'normal' = 'normal';
    if (bb.percent_b > 95) bbState = 'overbought';
    else if (bb.percent_b < 5) bbState = 'oversold';

    let stochState: 'oversold' | 'overbought' | 'neutral' = 'neutral';
    if (stoch > 80) stochState = 'overbought';
    else if (stoch < 20) stochState = 'oversold';

    let crossover: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (macdR.hist > 0 && macdR.macd > macdR.signal) crossover = 'bullish';
    else if (macdR.hist < 0) crossover = 'bearish';

    const result: AdvancedAnalytics = {
      status: 'success',
      ticker,
      price,
      macd: {
        line: Math.round(macdR.macd * 1e6) / 1e6,
        signal: Math.round(macdR.signal * 1e6) / 1e6,
        histogram: Math.round(macdR.hist * 1e6) / 1e6,
        crossover,
      },
      bollinger: {
        upper: Math.round(bb.upper * 1e6) / 1e6,
        middle: Math.round(bb.middle * 1e6) / 1e6,
        lower: Math.round(bb.lower * 1e6) / 1e6,
        percent_b: Math.round(bb.percent_b * 10) / 10,
        bandwidth: Math.round(bb.bandwidth * 100) / 100,
        state: bbState,
      },
      atr: {
        value: Math.round(atr * 1e6) / 1e6,
        percent: Math.round(atrPct * 100) / 100,
        suggested_stop_pct: Math.round(atrPct * 2 * 100) / 100,
        suggested_tp_pct: Math.round(atrPct * 3 * 100) / 100,
      },
      adx: { value: Math.round(adxVal * 10) / 10, trend_strength: trendStrength },
      stoch_rsi: { value: Math.round(stoch * 10) / 10, state: stochState },
      support_resistance: sr,
      divergence: div,
      volume_profile: vp,
    };

    _advCache.set(ticker, { value: result, ts: Date.now() });
    return result;
  } catch (e: any) {
    return {
      status: 'error',
      ticker,
      price: 0,
      macd: { line: 0, signal: 0, histogram: 0, crossover: 'neutral' },
      bollinger: { upper: 0, middle: 0, lower: 0, state: 'normal' },
      atr: { value: 0, percent: 0, suggested_stop_pct: 0, suggested_tp_pct: 0 },
      adx: { value: 0, trend_strength: 'flat' },
      stoch_rsi: { value: 50, state: 'neutral' },
      support_resistance: { resistance: [], support: [] },
      divergence: { type: null, strength: 0 },
      volume_profile: { poc: 0, va_low: 0, va_high: 0 },
      message: e.message,
    };
  }
}