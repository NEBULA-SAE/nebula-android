// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · INDICATORS
// Точный порт из python/indicators.py
// Чистая математика: EMA, RSI, MACD, Bollinger, ATR, ADX,
// Stoch RSI, S/R, дивергенция, Volume Profile, regime
// ═══════════════════════════════════════════════════════════════

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── EMA ───

export function ema(values: number[], period: number): number {
  if (values.length < period) return values.length ? values[values.length - 1] : 0;
  const k = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) {
    result = values[i] * k + result * (1 - k);
  }
  return result;
}

export function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) {
    return values.length ? values.map(() => values[0]) : [];
  }
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

// ─── MACD ───

export interface MacdResult {
  macd: number;
  signal: number;
  hist: number;
}

export function calcMacd(closes: number[], fast = 12, slow = 26, signal = 9): MacdResult {
  if (closes.length < slow + signal) {
    return { macd: 0, signal: 0, hist: 0 };
  }
  const fastEma = emaSeries(closes, fast);
  const slowEma = emaSeries(closes, slow);
  const macdSeries = fastEma.map((f, i) => f - slowEma[i]);
  const signalSeries = emaSeries(macdSeries, signal);
  return {
    macd: macdSeries[macdSeries.length - 1],
    signal: signalSeries[signalSeries.length - 1],
    hist: macdSeries[macdSeries.length - 1] - signalSeries[signalSeries.length - 1],
  };
}

// ─── Bollinger Bands ───

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  percent_b: number;
  bandwidth: number;
}

export function calcBollinger(closes: number[], period = 20, stdMult = 2.0): BollingerResult {
  if (closes.length < period) {
    return { upper: 0, middle: 0, lower: 0, percent_b: 50, bandwidth: 0 };
  }
  const recent = closes.slice(-period);
  const sma = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((s, x) => s + (x - sma) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  const upper = sma + stdMult * std;
  const lower = sma - stdMult * std;
  const price = closes[closes.length - 1];
  const percent_b = (upper - lower) > 0 ? ((price - lower) / (upper - lower)) * 100 : 50;
  const bandwidth = sma > 0 ? ((upper - lower) / sma) * 100 : 0;
  return { upper, middle: sma, lower, percent_b, bandwidth };
}

// ─── ATR ───

export function calcAtr(highs: number[], lows: number[], closes: number[], period = 14): number {
  if (closes.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ─── ADX (только DX последней точки, как в Python) ───

export function calcAdx(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number {
  if (closes.length < period * 2) return 25;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trList: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const up = highs[i] - highs[i - 1];
    const down = lows[i - 1] - lows[i];
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trList.push(tr);
  }
  if (!trList.length) return 25;
  const trSum = trList.slice(-period).reduce((a, b) => a + b, 0);
  if (trSum === 0) return 25;
  const atr = trSum / period;
  const plusDi = ((plusDM.slice(-period).reduce((a, b) => a + b, 0)) / period) / atr * 100;
  const minusDi = ((minusDM.slice(-period).reduce((a, b) => a + b, 0)) / period) / atr * 100;
  const sum = plusDi + minusDi;
  const dx = sum > 0 ? (Math.abs(plusDi - minusDi) / sum) * 100 : 0;
  return dx;
}

// ─── RSI ───

export function calcRsiSimple(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let ag = gains / period;
  let al = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) {
      ag = (ag * (period - 1) + d) / period;
      al = (al * (period - 1)) / period;
    } else {
      ag = (ag * (period - 1)) / period;
      al = (al * (period - 1) - d) / period;
    }
  }
  return al === 0 ? 100 : 100 - (100 / (1 + ag / al));
}

// Алиас — как в Python: _calc_rsi = _calc_rsi_simple
export function calcRsi(closes: number[], period = 14): number {
  return calcRsiSimple(closes, period);
}

// ─── Stoch RSI ───

export function calcStochRsi(
  closes: number[],
  rsiPeriod = 14,
  stochPeriod = 14
): number {
  if (closes.length < rsiPeriod + stochPeriod) return 50;
  const rsiSeries: number[] = [];
  for (let i = rsiPeriod; i <= closes.length; i++) {
    rsiSeries.push(calcRsiSimple(closes.slice(0, i), rsiPeriod));
  }
  if (rsiSeries.length < stochPeriod) return 50;
  const recentRsi = rsiSeries.slice(-stochPeriod);
  const minRsi = Math.min(...recentRsi);
  const maxRsi = Math.max(...recentRsi);
  if (maxRsi === minRsi) return 50;
  return ((rsiSeries[rsiSeries.length - 1] - minRsi) / (maxRsi - minRsi)) * 100;
}

// ─── Support / Resistance ───

export interface SrResult {
  resistance: number[];
  support: number[];
  nearest_r: number;
  nearest_s: number;
}

export function findSupportResistance(
  highs: number[],
  lows: number[],
  closes: number[],
  lookback = 120
): SrResult {
  if (highs.length < 20) {
    return { resistance: [], support: [], nearest_r: 0, nearest_s: 0 };
  }
  const price = closes[closes.length - 1];
  const pivotsH: number[] = [];
  const pivotsL: number[] = [];
  const window = 5;
  for (let i = window; i < highs.length - window; i++) {
    const hSlice = highs.slice(i - window, i + window + 1);
    if (highs[i] === Math.max(...hSlice)) pivotsH.push(highs[i]);

    const lSlice = lows.slice(i - window, i + window + 1);
    if (lows[i] === Math.min(...lSlice)) pivotsL.push(lows[i]);
  }

  function cluster(levels: number[]): number[] {
    if (!levels.length) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
      const lv = sorted[i];
      const lastCluster = clusters[clusters.length - 1];
      const lastVal = lastCluster[lastCluster.length - 1];
      if ((lv - lastVal) / lastVal < 0.015) {
        lastCluster.push(lv);
      } else {
        clusters.push([lv]);
      }
    }
    return clusters.map(c => c.reduce((a, b) => a + b, 0) / c.length);
  }

  const resistanceLevels = cluster(pivotsH).filter(r => r > price).slice(0, 3);
  const supportAll = cluster(pivotsL).filter(s => s < price);
  const supportLevels = supportAll.slice(-3).reverse();

  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  return {
    resistance: resistanceLevels.map(round),
    support: supportLevels.map(round),
    nearest_r: resistanceLevels[0] ?? 0,
    nearest_s: supportLevels[0] ?? 0,
  };
}

// ─── Дивергенция ───

export interface DivergenceResult {
  type: 'bullish' | 'bearish' | null;
  strength: number;
}

export function detectDivergence(
  closes: number[],
  rsiPeriod = 14,
  lookback = 40
): DivergenceResult {
  if (closes.length < lookback + rsiPeriod) {
    return { type: null, strength: 0 };
  }
  const rsiSeries: number[] = [];
  for (let i = rsiPeriod; i <= closes.length; i++) {
    rsiSeries.push(calcRsiSimple(closes.slice(0, i), rsiPeriod));
  }
  if (rsiSeries.length < lookback) {
    return { type: null, strength: 0 };
  }
  const recentPrices = closes.slice(-lookback);
  const recentRsi = rsiSeries.slice(-lookback);
  const half = Math.floor(lookback / 2);

  const firstPrices = recentPrices.slice(0, half);
  const secondPrices = recentPrices.slice(half);
  const firstRsi = recentRsi.slice(0, half);
  const secondRsi = recentRsi.slice(half);

  const firstPMaxI = firstPrices.indexOf(Math.max(...firstPrices));
  const secondPMaxI = secondPrices.indexOf(Math.max(...secondPrices)) + half;
  const firstPMinI = firstPrices.indexOf(Math.min(...firstPrices));
  const secondPMinI = secondPrices.indexOf(Math.min(...secondPrices)) + half;

  if (
    recentPrices[secondPMaxI] > recentPrices[firstPMaxI] &&
    recentRsi[secondPMaxI] < recentRsi[firstPMaxI]
  ) {
    const strength = Math.min(100, Math.abs(recentRsi[secondPMaxI] - recentRsi[firstPMaxI]) * 2);
    return { type: 'bearish', strength: Math.round(strength * 10) / 10 };
  }

  if (
    recentPrices[secondPMinI] < recentPrices[firstPMinI] &&
    recentRsi[secondPMinI] > recentRsi[firstPMinI]
  ) {
    const strength = Math.min(100, Math.abs(recentRsi[secondPMinI] - recentRsi[firstPMinI]) * 2);
    return { type: 'bullish', strength: Math.round(strength * 10) / 10 };
  }

  return { type: null, strength: 0 };
}

// ─── Volume Profile ───

export interface VolumeProfileResult {
  poc: number;
  va_high: number;
  va_low: number;
}

export function calcVolumeProfile(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  bins = 20,
  lookback = 120
): VolumeProfileResult {
  if (closes.length < 20) {
    return { poc: 0, va_high: 0, va_low: 0 };
  }
  const h = highs.slice(-lookback);
  const l = lows.slice(-lookback);
  const v = volumes.slice(-lookback);
  if (!h.length || !l.length || !v.length) {
    return { poc: 0, va_high: 0, va_low: 0 };
  }
  const minP = Math.min(...l);
  const maxP = Math.max(...h);
  if (maxP === minP) {
    return { poc: closes[closes.length - 1], va_high: maxP, va_low: minP };
  }
  const step = (maxP - minP) / bins;
  const volByBin = new Array(bins).fill(0);
  for (let i = 0; i < closes.length && i < h.length; i++) {
    const mid = (h[i] + l[i]) / 2;
    const idx = Math.min(bins - 1, Math.floor((mid - minP) / step));
    volByBin[idx] += v[i];
  }
  const pocIdx = volByBin.indexOf(Math.max(...volByBin));
  const poc = minP + (pocIdx + 0.5) * step;
  const totalVol = volByBin.reduce((a: number, b: number) => a + b, 0);
  const target = totalVol * 0.70;
  let lo = pocIdx;
  let hi = pocIdx;
  let acc = volByBin[pocIdx];
  while (acc < target && (lo > 0 || hi < bins - 1)) {
    const left = lo > 0 ? volByBin[lo - 1] : 0;
    const right = hi < bins - 1 ? volByBin[hi + 1] : 0;
    if (left >= right && lo > 0) {
      lo -= 1;
      acc += left;
    } else if (hi < bins - 1) {
      hi += 1;
      acc += right;
    } else {
      break;
    }
  }
  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  return {
    poc: round(poc),
    va_high: round(minP + (hi + 1) * step),
    va_low: round(minP + lo * step),
  };
}

// ─── Режим рынка ───

export interface MarketRegimeResult {
  regime: string;
  description: string;
}

export function enhancedMarketRegime(
  mcapChange: number,
  btcDom: number,
  fngVal: number,
  btcRsi = 50,
  btcTrend: 'up' | 'down' | 'flat' = 'up'
): MarketRegimeResult {
  let score = 0;
  if (mcapChange > 3) score += 3;
  else if (mcapChange > 1) score += 2;
  else if (mcapChange > 0.5) score += 1;
  else if (mcapChange < -3) score -= 3;
  else if (mcapChange < -1) score -= 2;
  else if (mcapChange < -0.5) score -= 1;

  if (btcDom > 55) score += 1;
  else if (btcDom < 48) score -= 1;

  if (fngVal > 75) score -= 1;
  else if (fngVal < 25) score += 1;

  if (btcRsi < 40) score += 1;
  else if (btcRsi > 70) score -= 1;

  if (btcTrend === 'up') score += 1;
  else if (btcTrend === 'down') score -= 1;

  if (score >= 4) return { regime: 'bull_btc', description: '🐂 Сильный бычий рынок. BTC доминирует, деньги идут в крупные монеты.' };
  if (score >= 2) return { regime: 'bull_mild', description: '📈 Умеренно бычий рынок. Есть аппетит к риску.' };
  if (score <= -4) return { regime: 'bearish', description: '🔻 Сильный медвежий рынок. Лучше держать кэш.' };
  if (score <= -2) return { regime: 'bear_mild', description: '📉 Умеренное снижение. Возможна коррекция.' };
  if (btcDom < 50 && mcapChange > 0) return { regime: 'altseason', description: '🚀 Альтсезон! Деньги перетекают в альткоины.' };
  return { regime: 'neutral', description: '⚖️ Рынок консолидируется.' };
}