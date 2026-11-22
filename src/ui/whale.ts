// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · WHALE
// Радар китов + Рентген толпы + Стенки в стакане
// ═══════════════════════════════════════════════════════════════

import { tm, isEN } from '../i18n';
import { fmtP, setHTML } from '../utils';
import { getAggregatedFunding } from '../sources/funding';
import { getAggregatedOrderbook } from '../sources/orderbook';
import { state } from '../utils';
import { audioService } from '../services/audio';

let _extrasTimer: ReturnType<typeof setInterval> | null = null;

// ─── ТИПЫ ───

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WhaleSpotData {
  spikeRatio: number;
  zScore: number;
  obvSlope: number;
  pressure: 'buying' | 'selling' | 'absorption' | 'neutral';
  pressureStrength: number;
  spotScore: number;
  score: number;
  isRising: boolean;
  isFalling: boolean;
  isWhaleActive: boolean;
  obvTrend: string;
}

export interface WhaleFuturesInput {
  oi?: number;
  oi_change_24h_pct?: number;
  oi_trend?: 'rising' | 'falling' | 'flat';
  lsr_top_accounts?: number;
  lsr_global?: number;
  taker_ratio?: number;
  sources?: string[];
}

export interface WhaleMergedData {
  spikeRatio: number;
  zScore: number;
  obvSlope: number;
  pressure: 'buying' | 'selling' | 'absorption' | 'neutral';
  pressureStrength: number;
  isRising: boolean;
  isFalling: boolean;
  isWhaleActive: boolean;
  obvTrend: string;
  oi: number | null;
  oiChangePct: number | null;
  oiTrend: string | null;
  lsrTop: number | null;
  lsrGlobal: number | null;
  takerRatio: number | null;
  hasFutures: boolean;
  sources: string[];
  score: number;
  futuresVerdict: 'new_longs' | 'new_shorts' | 'short_cover' | 'long_liq' | 'neutral';
}

const T = (ru: string, en: string): string => (isEN() ? en : ru);

// ─── РАСЧЁТ АНОМАЛИЙ ───

export function calculateVolumeAnomalies(data: Candle[]): WhaleSpotData | null {
  if (!data || data.length < 30) return null;

  const recentVols = data.slice(-31, -1).map(c => c.volume);
  const n = recentVols.length;
  const mean = recentVols.reduce((a, b) => a + b, 0) / n;
  const variance = recentVols.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance) || 1;

  const lastVol = data[data.length - 1].volume;
  const prevVol = data[data.length - 2].volume;
  const maxRecentVol = Math.max(lastVol, prevVol);

  const zScore = (maxRecentVol - mean) / std;
  const isWhaleActive = zScore > 2.5;

  const lastCandle = data[data.length - 1];
  const prevCandle = data[data.length - 2];
  const range = lastCandle.high - lastCandle.low;
  const closePosition = range > 0 ? (lastCandle.close - lastCandle.low) / range : 0.5;

  const priceUp = lastCandle.close > prevCandle.close;
  const volumeUp = lastVol > prevVol;

  let pressure: 'buying' | 'selling' | 'absorption' | 'neutral' = 'neutral';
  let pressureStrength = 0;

  if (volumeUp && priceUp && closePosition > 0.6) {
    pressure = 'buying';
    pressureStrength = Math.min(100, (closePosition - 0.5) * 200 + zScore * 15);
  } else if (volumeUp && !priceUp && closePosition < 0.4) {
    pressure = 'selling';
    pressureStrength = Math.min(100, (0.5 - closePosition) * 200 + zScore * 15);
  } else if (volumeUp && Math.abs(lastCandle.close - prevCandle.close) / prevCandle.close < 0.005) {
    pressure = 'absorption';
    pressureStrength = Math.min(100, zScore * 25);
  }

  let obv = 0;
  const obvHistory: number[] = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) obv += data[i].volume;
    else if (data[i].close < data[i - 1].close) obv -= data[i].volume;
    obvHistory.push(obv);
  }

  const obvSlope = (() => {
    const recent = obvHistory.slice(-20);
    const m = recent.length;
    if (m < 2) return 0;
    const sumX = (m * (m - 1)) / 2;
    const sumY = recent.reduce((a, b) => a + b, 0);
    const sumXY = recent.reduce((a, v, i) => a + i * v, 0);
    const sumX2 = (m * (m - 1) * (2 * m - 1)) / 6;
    const denom = m * sumX2 - sumX * sumX;
    return denom !== 0 ? (m * sumXY - sumX * sumY) / denom : 0;
  })();

  const normalizedSlope = mean > 0 ? (obvSlope / mean) * 100 : 0;
  const isRising = normalizedSlope > 0.5;
  const isFalling = normalizedSlope < -0.5;

  let zsPart: number;
  if (zScore >= 3) zsPart = Math.min(50, 42 + (zScore - 3) * 8);
  else if (zScore >= 2) zsPart = 30 + (zScore - 2) * 12;
  else if (zScore >= 1) zsPart = 15 + (zScore - 1) * 15;
  else zsPart = Math.max(0, zScore * 15);

  const absSlope = Math.abs(normalizedSlope);
  let slopePart: number;
  if (absSlope >= 3) slopePart = Math.min(30, 25 + (absSlope - 3) * 2);
  else if (absSlope >= 1) slopePart = 10 + (absSlope - 1) * 7.5;
  else slopePart = absSlope * 10;

  let pressurePart = 0;
  if (pressure !== 'neutral') {
    if (pressureStrength >= 50) pressurePart = 10 + (pressureStrength - 50) / 5;
    else pressurePart = pressureStrength / 5;
  }

  const spotScore = Math.min(100, zsPart + slopePart + pressurePart);

  return {
    spikeRatio: Math.round((maxRecentVol / mean) * 100),
    zScore: Math.round(zScore * 100) / 100,
    obvSlope: Math.round(normalizedSlope * 100) / 100,
    pressure,
    pressureStrength: Math.round(pressureStrength),
    spotScore: Math.round(spotScore),
    score: Math.round(spotScore),
    isRising,
    isFalling,
    isWhaleActive,
    obvTrend: isRising
      ? tm('whale_buying')
      : (isFalling ? tm('whale_selling') : tm('whale_flat')),
  };
}

// ─── ОБЪЕДИНЕНИЕ SPOT + FUTURES ───

export function mergeWhaleMetrics(
  spot: WhaleSpotData | null,
  futures: WhaleFuturesInput | null,
  _price: number
): WhaleMergedData | null {
  if (!spot && !futures) return null;

  const result: WhaleMergedData = {
    spikeRatio: spot ? spot.spikeRatio : 0,
    zScore: spot ? spot.zScore : 0,
    obvSlope: spot ? spot.obvSlope : 0,
    pressure: spot ? spot.pressure : 'neutral',
    pressureStrength: spot ? spot.pressureStrength : 0,
    isRising: spot ? spot.isRising : false,
    isFalling: spot ? spot.isFalling : false,
    isWhaleActive: spot ? spot.isWhaleActive : false,
    obvTrend: spot ? spot.obvTrend : tm('whale_flat'),
    oi: futures?.oi ?? null,
    oiChangePct: futures?.oi_change_24h_pct ?? null,
    oiTrend: futures?.oi_trend ?? null,
    lsrTop: futures?.lsr_top_accounts ?? null,
    lsrGlobal: futures?.lsr_global ?? null,
    takerRatio: futures?.taker_ratio ?? null,
    hasFutures: !!(futures && futures.sources && futures.sources.length > 0),
    sources: futures?.sources || [],
    score: 0,
    futuresVerdict: 'neutral',
  };

  const spotPart = spot ? (spot.spotScore / 100) * 60 : 0;

  let futuresPart = 0;
  if (futures) {
    let fp = 0;
    if (futures.oi_change_24h_pct != null) {
      const absChg = Math.abs(futures.oi_change_24h_pct);
      if (absChg >= 10) fp += 20;
      else if (absChg >= 5) fp += 10 + (absChg - 5) * 2;
      else if (absChg >= 2) fp += (absChg - 2) * (10 / 3);
    }
    if (futures.taker_ratio != null) {
      const dev = Math.abs(futures.taker_ratio - 1);
      if (dev >= 0.3) fp += 15;
      else if (dev >= 0.15) fp += 8 + (dev - 0.15) * (7 / 0.15);
      else if (dev >= 0.05) fp += (dev - 0.05) * (8 / 0.10);
    }
    if (futures.lsr_top_accounts != null && futures.lsr_global != null) {
      const div = Math.abs(futures.lsr_top_accounts - futures.lsr_global);
      if (div >= 0.3) fp += 5;
      else if (div >= 0.1) fp += (div - 0.1) * 25;
    }
    futuresPart = Math.min(40, fp);
  }

  result.score = Math.round(Math.min(100, spotPart + futuresPart));

  if (futures?.oi_trend && spot) {
    const oiUp = futures.oi_trend === 'rising';
    const oiDown = futures.oi_trend === 'falling';
    const priceUp = spot.pressure === 'buying';
    const priceDown = spot.pressure === 'selling';
    if (oiUp && priceUp) result.futuresVerdict = 'new_longs';
    else if (oiUp && priceDown) result.futuresVerdict = 'new_shorts';
    else if (oiDown && priceUp) result.futuresVerdict = 'short_cover';
    else if (oiDown && priceDown) result.futuresVerdict = 'long_liq';
  }

  return result;
}

// ─── ХЕЛПЕРЫ ───

function sourcesCoverage(sources: string[]): string {
  if (!sources || !sources.length) return '';
  const map: Record<string, string> = {};
  sources.forEach(s => {
    const idx = s.indexOf(':');
    if (idx > 0) map[s.slice(0, idx)] = s.slice(idx + 1);
  });
  const parts: string[] = [];
  if (map.oi) parts.push(`OI ${map.oi}`);
  if (map.lsr_top) parts.push(`LSR-top ${map.lsr_top}`);
  if (map.lsr) parts.push(`LSR-crowd ${map.lsr}`);
  if (map.taker) parts.push(`Taker ${map.taker}`);
  return parts.join(' · ');
}

interface SignalItem {
  key: string;
  title: string;
  value: string;
  color: string;
  strength: 'strong' | 'medium' | 'weak';
  what: string;
  react: string;
  active: boolean;
}

function buildSignals(v: WhaleMergedData): SignalItem[] {
  const out: SignalItem[] = [];

  // 1. Объём (Z-score)
  {
    const z = v.zScore;
    const strength: SignalItem['strength'] = z >= 3 ? 'strong' : z >= 2 ? 'medium' : 'weak';
    out.push({
      key: 'volume',
      title: tm('whale_sig_volume'),
      value: `${z.toFixed(2)}σ`,
      color: z >= 2.5 ? 'var(--cyan)' : z >= 1.5 ? 'var(--amber)' : 'var(--mut)',
      strength,
      what: `
        <span class="pc-only">${T(
          'Z-score показывает, насколько объём последних свечей выше обычного. 2.5σ — это крупный вход, в 2.5 раза выше стандартного разброса за 30 дней.',
          'Z-score shows how much the recent volume exceeds the norm. 2.5σ means a large entry — 2.5x the standard deviation over 30 days.'
        )}</span>
        <span class="mobile-only">${T(
          'Объём в 2.5σ раз выше нормы. Крупный игрок вошёл в рынок.',
          'Volume is 2.5σ above normal. A big player entered the market.'
        )}</span>
      `,
      react: z >= 2.5
        ? `<span class="pc-only">${T('Смотри на свечу: растёт на объёме — покупают, падает — продают, стоит на месте — кто-то копит (поглощение).', 'Look at the candle: rising on volume — buyers, falling — sellers, flat — someone is accumulating (absorption).')}</span>
           <span class="mobile-only">${T('📈 Растёт = покупают. 📉 Падает = продают. 😐 Стоит = копят.', '📈 Up = buying. 📉 Down = selling. 😐 Flat = accumulating.')}</span>`
        : `<span class="pc-only">${T('Объём в норме, крупных входов не видно.', 'Volume is normal, no big entries visible.')}</span>
           <span class="mobile-only">${T('Объём в норме. Ждём.', 'Volume is normal. Waiting.')}</span>`,
      active: z >= 2.5,
    });
  }

  // 2. OBV
  {
    out.push({
      key: 'obv',
      title: tm('whale_sig_obv'),
      value: v.obvTrend,
      color: v.isRising ? 'var(--mint)' : v.isFalling ? 'var(--coral)' : 'var(--mut)',
      strength: v.isRising || v.isFalling ? 'medium' : 'weak',
      what: `
        <span class="pc-only">${T('On-Balance Volume — суммарный объём с учётом направления свечей. Показывает, кто давит — покупатели или продавцы, даже если цена стоит.', 'On-Balance Volume — cumulative volume weighted by candle direction. Shows who is pushing — buyers or sellers — even if the price is flat.')}</span>
        <span class="mobile-only">${T('Накопление объёма. Показывает скрытое давление покупателей.', 'Volume accumulation. Shows hidden buyer pressure.')}</span>
      `,
      react: v.isRising
        ? `<span class="pc-only">${T('Идёт накопление. Если цена при этом в боковике — крупный тихо набирает позицию.', 'Accumulation is underway. If price is sideways meanwhile — someone big is quietly building a position.')}</span>
           <span class="mobile-only">${T('🟢 Идёт набор позиции. Цена может выстрелить.', '🟢 Accumulation. Price may shoot up.')}</span>`
        : v.isFalling
          ? `<span class="pc-only">${T('Распределение. Даже если цена растёт — за этим могут стоять продажи крупных.', 'Distribution. Even if price rises — big players may be selling into it.')}</span>
           <span class="mobile-only">${T('🔴 Крупные сбрасывают. Осторожно.', '🔴 Big players selling. Be careful.')}</span>`
          : `<span class="pc-only">${T('Нейтрально, явного перевеса нет.', 'Neutral, no clear bias.')}</span>
           <span class="mobile-only">${T('⚖️ Нейтрально.', '⚖️ Neutral.')}</span>`,
      active: v.isRising || v.isFalling,
    });
  }

  // 3. Open Interest
  if (v.hasFutures && v.oiChangePct != null) {
    const chg = v.oiChangePct;
    const abs = Math.abs(chg);
    const strength: SignalItem['strength'] = abs >= 10 ? 'strong' : abs >= 5 ? 'medium' : 'weak';
    const fvColor =
      v.futuresVerdict === 'new_longs' ? 'var(--mint)'
      : v.futuresVerdict === 'new_shorts' ? 'var(--coral)'
      : v.futuresVerdict === 'short_cover' ? 'var(--amber)'
      : v.futuresVerdict === 'long_liq' ? 'var(--coral)'
      : 'var(--mut)';
    out.push({
      key: 'oi',
      title: tm('whale_sig_oi'),
      value: `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% · ${v.oiTrend || 'flat'}`,
      color: fvColor,
      strength,
      what: `
        <span class="pc-only">${T('Open Interest — сумма всех открытых фьючерсных позиций. Показывает, заходят ли в рынок новые деньги или закрываются старые.', 'Open Interest — the sum of all open futures positions. Shows whether new money enters the market or old positions are closed.')}</span>
        <span class="mobile-only">${T('Сумма всех открытых фьючерсных позиций.', 'Total open futures positions.')}</span>
      `,
      react:
        v.futuresVerdict === 'new_longs' ? `<span class="pc-only">${T('OI растёт, цена растёт — новые лонги. Тренд сильный, но следи за funding: если он высокий, возможна коррекция.', 'OI rises, price rises — new longs. Trend is strong, but watch funding: if it is high, a correction may come.')}</span><span class="mobile-only">${T('🚀 Новые лонги. Тренд вверх, но следи за перегревом.', '🚀 New longs. Uptrend, but watch for overheat.')}</span>`
        : v.futuresVerdict === 'new_shorts' ? `<span class="pc-only">${T('OI растёт, цена падает — новые шорты. Давление вниз, но при негативном funding возможен сквиз вверх.', 'OI rises, price falls — new shorts. Downward pressure, but a squeeze up is possible with negative funding.')}</span><span class="mobile-only">${T('🔻 Новые шорты. Давят вниз.', '🔻 New shorts. Pushing down.')}</span>`
        : v.futuresVerdict === 'short_cover' ? `<span class="pc-only">${T('OI падает, цена растёт — шорты закрываются. Импульс вверх на закрытиях, но это не новые деньги.', 'OI falls, price rises — shorts are covering. Upward impulse on closes, but not new money.')}</span><span class="mobile-only">${T('⚡ Шорты закрываются. Растёт на закрытиях.', '⚡ Shorts covering. Rising on closures.')}</span>`
        : v.futuresVerdict === 'long_liq' ? `<span class="pc-only">${T('OI падает, цена падает — лонги ликвидируются. Возможна капитуляция, но не входи против тренда без подтверждения.', 'OI falls, price falls — longs are being liquidated. Capitulation possible, but do not trade against the trend without confirmation.')}</span><span class="mobile-only">${T('💀 Ликвидация лонгов. Возможна капитуляция.', '💀 Long liquidation. Capitulation possible.')}</span>`
        : `<span class="pc-only">${T('OI без явного сигнала.', 'OI without a clear signal.')}</span><span class="mobile-only">${T('OI без сигнала.', 'OI no signal.')}</span>`,
      active: abs >= 3,
    });
  }

  // 4. LSR
  if (v.lsrTop != null) {
    const top = v.lsrTop;
    const glob = v.lsrGlobal;
    const div = glob != null ? Math.abs(top - glob) : 0;
    const isBull = glob != null && top > glob * 1.05;
    const isBear = glob != null && top < glob * 0.95;
    const strength: SignalItem['strength'] = div >= 0.3 ? 'strong' : div >= 0.1 ? 'medium' : 'weak';
    out.push({
      key: 'lsr',
      title: tm('whale_sig_lsr'),
      value: glob != null ? `${top.toFixed(2)} / ${glob.toFixed(2)}` : top.toFixed(2),
      color: isBull ? 'var(--mint)' : isBear ? 'var(--coral)' : 'var(--mut)',
      strength,
      what: `
        <span class="pc-only">${T('Long/Short Ratio. Первое число — топ-трейдеры, второе — толпа. Показывает, на чьей стороне умные деньги.', 'Long/Short Ratio. First number — top traders, second — the crowd. Shows which side smart money is on.')}</span>
        <span class="mobile-only">${T('Топ-трейдеры / Толпа. Умные против толпы.', 'Top traders / Crowd. Smart vs crowd.')}</span>
      `,
      react: isBull
        ? `<span class="pc-only">${T('Топ в лонгах, толпа в шортах — классический бычий сигнал. Умные против толпы.', 'Top in longs, crowd in shorts — classic bullish. Smart money against the crowd.')}</span><span class="mobile-only">${T('🟢 Топ в лонг, толпа в шорт. Бычий.', '🟢 Top in long, crowd in short. Bullish.')}</span>`
        : isBear
          ? `<span class="pc-only">${T('Топ в шортах, толпа в лонгах — тревожно. Умные фиксируются, толпа покупает.', 'Top in shorts, crowd in longs — warning. Smart money is taking profit, crowd is buying.')}</span><span class="mobile-only">${T('🔴 Топ в шорт, толпа в лонг. Медвежий.', '🔴 Top in short, crowd in long. Bearish.')}</span>`
          : `<span class="pc-only">${T('Топ и толпа смотрят в одну сторону — сигнала нет.', 'Top and crowd on the same side — no signal.')}</span><span class="mobile-only">${T('⚖️ Смотрят в одну сторону.', '⚖️ Same side.')}</span>`,
      active: isBull || isBear,
    });
  }

  // 5. Taker Buy/Sell
  if (v.takerRatio != null) {
    const t = v.takerRatio;
    const isBull = t > 1.15;
    const isBear = t < 0.85;
    const dev = Math.abs(t - 1);
    const strength: SignalItem['strength'] = dev >= 0.3 ? 'strong' : dev >= 0.15 ? 'medium' : 'weak';
    out.push({
      key: 'taker',
      title: tm('whale_sig_taker'),
      value: t.toFixed(2),
      color: isBull ? 'var(--mint)' : isBear ? 'var(--coral)' : 'var(--mut)',
      strength,
      what: `
        <span class="pc-only">${T('Соотношение агрессивных рыночных покупок и продаж. Показывает, кто бьёт по рынку прямо сейчас.', 'Ratio of aggressive market buys to sells. Shows who is hitting the market right now.')}</span>
        <span class="mobile-only">${T('Агрессия. Кто бьёт по рынку прямо сейчас.', 'Aggression. Who hits the market now.')}</span>
      `,
      react: isBull
        ? `<span class="pc-only">${T('Покупатели агрессивнее. Краткосрочно бычий, но если funding уже высокий — риск перегрева.', 'Buyers are more aggressive. Short-term bullish, but if funding is already high — risk of overheat.')}</span><span class="mobile-only">${T('🟢 Покупатели давят. Следи за funding.', '🟢 Buyers pushing. Watch funding.')}</span>`
        : isBear
          ? `<span class="pc-only">${T('Продавцы агрессивнее. Краткосрочно медвежий, но если funding отрицательный — возможен сквиз.', 'Sellers are more aggressive. Short-term bearish, but a squeeze is possible with negative funding.')}</span><span class="mobile-only">${T('🔴 Продавцы давят. Возможен сквиз.', '🔴 Sellers pushing. Squeeze possible.')}</span>`
          : `<span class="pc-only">${T('Паритет. Рынок не определился.', 'Parity. Market is undecided.')}</span><span class="mobile-only">${T('⚖️ Паритет.', '⚖️ Parity.')}</span>`,
      active: isBull || isBear,
    });
  }

  const order = { strong: 0, medium: 1, weak: 2 };
  return out.sort((a, b) => order[a.strength] - order[b.strength]);
}

// ─── РЕНДЕР КАРТОЧКИ WHALE ───

export function renderWhaleData(volData: WhaleMergedData | null): void {
  const card = document.getElementById('whale-card');
  const content = document.getElementById('whale-content');
  const badge = document.getElementById('whale-status-badge');
  if (!card || !content) return;

  if (!volData) {
    if (badge) {
      badge.textContent = '—';
      badge.style.color = 'var(--dim)';
      badge.style.textShadow = 'none';
    }
    card.style.borderColor = 'rgba(94,203,255,.3)';
    card.style.boxShadow = '';
    content.innerHTML = `<div class="empty-msg" style="padding:14px 0;">${tm('whale_no_data')}</div>`;
    card.style.display = 'block';
    return;
  }

  const isActive = volData.isWhaleActive || volData.score > 50;
  
  // Если не PRO — оставляем только Volume и OBV
  let signals = buildSignals(volData);
  if (!state.isPro) {
    signals = signals.filter(s => s.key === 'volume' || s.key === 'obv');
  }
  
  const activeSignals = signals.filter(s => s.active);

  if (badge) {
    if (isActive) {
      badge.textContent = T('🐋 АКТИВЕН', '🐋 ACTIVE');
      badge.style.color = 'var(--cyan)';
      badge.style.textShadow = '0 0 10px rgba(94,203,255,.6)';
    } else {
      badge.textContent = T('СПОКОЙНО', 'CALM');
      badge.style.color = 'var(--dim)';
      badge.style.textShadow = 'none';
    }
  }

  if (isActive) {
    card.style.borderColor = 'rgba(94,203,255,.55)';
    card.style.boxShadow = '0 12px 40px -12px rgba(94,203,255,.5), inset 0 1px 0 var(--glass)';
  } else {
    card.style.borderColor = 'rgba(94,203,255,.3)';
    card.style.boxShadow = '';
  }

  const scoreColor = volData.score > 60 ? 'var(--cyan)' : volData.score > 30 ? 'var(--amber)' : 'var(--mut)';

  let verdictText = '';
  let verdictColor = 'var(--mut)';
  if (volData.score > 60) { verdictText = tm('whale_verdict_strong'); verdictColor = 'var(--cyan)'; }
  else if (volData.score > 40) { verdictText = tm('whale_verdict_moderate'); verdictColor = 'var(--amber)'; }
  else { verdictText = tm('whale_verdict_calm'); verdictColor = 'var(--mut)'; }

  const srcCov = sourcesCoverage(volData.sources);

  const signalsHtml = signals.map(s => `
    <div class="whale-signal whale-strength-${s.strength}">
      <div class="whale-signal-head">
        <div class="whale-signal-title">${s.title}</div>
        <div class="whale-signal-value" style="color:${s.color}">${s.value}</div>
      </div>
      <div class="whale-signal-what">${s.what}</div>
      <div class="whale-signal-react">💡 ${s.react}</div>
    </div>
  `).join('');

const audioOn = audioService.isEnabled();
  const audioBtnLabel = audioOn ? T('🔊 Звук ВКЛ', '🔊 Sound ON') : T('🔇 Звук ВЫКЛ', '🔇 Sound OFF');

  content.innerHTML = `
    <div class="whale-score-block">
      <div class="whale-score-row">
        <div>
          <div class="whale-score-label">${tm('whale_score')}</div>
          <div class="whale-score-value" style="color:${scoreColor}">${volData.score}<span>/100</span></div>
        </div>
        <div class="whale-signals-count">
          <div class="whale-score-label">${tm('whale_signals_label')}</div>
          <div class="whale-score-value" style="color:${scoreColor}">${activeSignals.length}<span>/${signals.length}</span></div>
        </div>
      </div>
      <div class="whale-score-bar"><div class="whale-score-fill" style="width:${volData.score}%;background:${scoreColor}"></div></div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;">
        <div class="whale-verdict-line" style="color:${verdictColor};margin:0;">${verdictText}</div>
        <button id="whale-audio-toggle" type="button" style="cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:10px;padding:4px 9px;border-radius:8px;border:1px solid ${audioOn ? 'rgba(94,203,255,.5)' : 'rgba(255,255,255,.12)'};background:${audioOn ? 'rgba(94,203,255,.14)' : 'rgba(255,255,255,.04)'};color:${audioOn ? 'var(--cyan)' : 'var(--mut)'};white-space:nowrap;">${audioBtnLabel}</button>
      </div>
      ${srcCov ? `<div class="whale-sources">${tm('whale_sources_label')}: ${srcCov}</div>` : ''}
    </div>

    <div class="whale-signals">${signalsHtml}</div>

    <div class="whale-footer-hint">${tm('whale_footer_warn')}</div>
  `;

  const audioBtn = document.getElementById('whale-audio-toggle');
  if (audioBtn) {
    audioBtn.addEventListener('click', () => {
      const nowOn = audioService.toggle();
      audioBtn.textContent = nowOn ? T('🔊 Звук ВКЛ', '🔊 Sound ON') : T('🔇 Звук ВЫКЛ', '🔇 Sound OFF');
      audioBtn.style.borderColor = nowOn ? 'rgba(94,203,255,.5)' : 'rgba(255,255,255,.12)';
      audioBtn.style.background = nowOn ? 'rgba(94,203,255,.14)' : 'rgba(255,255,255,.04)';
      audioBtn.style.color = nowOn ? 'var(--cyan)' : 'var(--mut)';
    });
  }

  if (isActive) {
    const sym = (state as any).symbol || (state as any).coin || 'active';
    audioService.playWhaleAlert(volData.pressure, volData.score, `whale:${sym}:${volData.pressure}`);
  }

  card.style.display = 'block';
}

// ─── XRAY + WALLS ───

export async function fetchExtras(ticker: string): Promise<void> {
  if (_extrasTimer) {
    clearInterval(_extrasTimer);
    _extrasTimer = null;
  }

  // Если не PRO — показываем заглушки вместо X-Ray и Walls
  if (!state.isPro) {
    const xrayCard = document.getElementById('xray-card');
    const wallsCard = document.getElementById('walls-card');
    
    if (xrayCard) {
      xrayCard.style.display = 'block';
      setHTML('xray-content', `
        <div style="text-align:center; padding: 20px; color: var(--mut); font-size: 12px;">
          🔒 Рентген толпы и Плиты в стакане доступны в PRO.<br>
          <button class="btn-primary btn-mint" onclick="openProModal()" style="margin-top: 10px; font-size: 10px; padding: 8px 16px;">Открыть PRO</button>
        </div>
      `);
    }
    if (wallsCard) {
      wallsCard.style.display = 'none'; // Или тоже заглушку, если хочешь
    }
    return;
  }

  const load = async () => {
    try {
      const [xray, walls] = await Promise.all([fetchXray(ticker), scanWalls(ticker)]);
      renderXray(xray);
      renderWalls(walls);
    } catch (e) {
      console.warn('[whale] fetchExtras:', e);
    }
  };

  await load();

  _extrasTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      load();
    }
  }, 45000);
}

export interface XrayData {
  fundingText: string;
  obText: string;
  mood: string;
  pressure: string;
}

async function fetchXray(ticker: string): Promise<XrayData> {
  const en = isEN();
  const noFutures = en ? 'Futures unavailable' : 'Фьючерсы недоступны';
  const noBook = en ? 'Book unavailable' : 'Стакан недоступен';
  const crowdShort = en ? 'Crowd is shorting 🚀' : 'Толпа шортит 🚀';
  const crowdEuphoria = en ? 'Crowd euphoric ⚠️' : 'Толпа в эйфории ⚠️';
  const neutralTxt = en ? 'Neutral.' : 'Нейтрально.';
  const bidsBelow = en ? 'Bids below 🛡️' : 'Снизу тазики 🛡️';
  const asksPressure = en ? 'Sellers push 🧱' : 'Давят сверху 🧱';
  const fight = en ? 'Fight ⚔️' : 'Позиционная борьба ⚔️';
  const mood = en ? 'Crowd mood' : 'Настроение толпы';
  const pressure = en ? 'Order book pressure' : 'Давление в стакане';
  const exLabel = tm('exchange_count');

  let fundingText = `<span style="color:var(--dim)">${noFutures}</span>`;
  let obText = `<span style="color:var(--dim)">${noBook}</span>`;

  try {
    const [fundingRes, orderbookRes] = await Promise.all([
      getAggregatedFunding(ticker),
      getAggregatedOrderbook(ticker),
    ]);

    if (fundingRes && fundingRes.status === 'success') {
      const avg = fundingRes.avgFunding;
      const srcCount = fundingRes.sourceCount;
      (window as any).updateFundingRate?.(avg, ticker);
      if (avg < -0.01) {
        fundingText = `<span style="color:var(--mint)"><b>${avg.toFixed(4)}%</b><br><span style="font-size:10px; color:var(--mut);">${crowdShort} · ${srcCount} ${exLabel}</span></span>`;
      } else if (avg > 0.01) {
        fundingText = `<span style="color:var(--coral)"><b>${avg.toFixed(4)}%</b><br><span style="font-size:10px; color:var(--mut);">${crowdEuphoria} · ${srcCount} ${exLabel}</span></span>`;
      } else {
        fundingText = `<span style="color:var(--amber)"><b>${avg.toFixed(4)}%</b><br><span style="font-size:10px; color:var(--mut);">${neutralTxt} · ${srcCount} ${exLabel}</span></span>`;
      }
    }

    if (orderbookRes && orderbookRes.status === 'success') {
      const bidsPct = orderbookRes.bidsPct;
      const asksPct = orderbookRes.asksPct;
      const srcCount = orderbookRes.sourceCount;
      const failed = (orderbookRes.sourcesFailed || []).length;
      const partial = failed > 0 ? ` · ${tm('book_partial')}` : '';

      if (bidsPct > 60) {
        obText = `<span style="color:var(--mint)"><b>${bidsPct.toFixed(0)}% / ${asksPct.toFixed(0)}%</b><br><span style="font-size:10px; color:var(--mut);">${bidsBelow} · ${srcCount} ${exLabel}${partial}</span></span>`;
      } else if (asksPct > 60) {
        obText = `<span style="color:var(--coral)"><b>${bidsPct.toFixed(0)}% / ${asksPct.toFixed(0)}%</b><br><span style="font-size:10px; color:var(--mut);">${asksPressure} · ${srcCount} ${exLabel}${partial}</span></span>`;
      } else {
        obText = `<span style="color:var(--amber)"><b>${bidsPct.toFixed(0)}% / ${asksPct.toFixed(0)}%</b><br><span style="font-size:10px; color:var(--mut);">${fight} · ${srcCount} ${exLabel}${partial}</span></span>`;
      }
    }
  } catch (e) {
    console.warn('[whale] aggregated xray failed', e);
  }

  return { fundingText, obText, mood, pressure };
}

function renderXray(x: XrayData): void {
  const card = document.getElementById('xray-card');
  if (!card) return;
  card.style.display = 'block';

  const whatFunding = `
    <span class="pc-only">${T('Funding rate — периодическая плата между лонгами и шортами (обычно каждые 8 часов). Показывает, куда перекошены позиции.', 'Funding rate — periodic payment between longs and shorts (usually every 8 hours). Shows which side positions are skewed to.')}</span>
    <span class="mobile-only">${T('Плата между лонгами и шортами. Показывает перекос.', 'Payment between longs and shorts. Shows skew.')}</span>
  `;
  const reactFunding = `
    <span class="pc-only">${T('Отрицательный funding = много шортов, возможен резкий рост (сквиз). Положительный > 0.05% = эйфория в лонгах, риск коррекции.', 'Negative funding = many shorts, sharp rise (squeeze) possible. Positive > 0.05% = long euphoria, risk of correction.')}</span>
    <span class="mobile-only">${T('Минус = сквиз вверх. Плюс > 0.05% = перегрев лонгов.', 'Minus = squeeze up. Plus > 0.05% = long overheat.')}</span>
  `;
  const whatBook = `
    <span class="pc-only">${T('Стакан — лимитные заявки на покупку (bids) и продажу (asks), агрегированные с нескольких бирж. Показывает, где стоят крупные лимитники.', 'Order book — limit orders to buy (bids) and sell (asks) aggregated from several exchanges. Shows where big limit orders sit.')}</span>
    <span class="mobile-only">${T('Лимитные заявки. Где стоят крупные.', 'Limit orders. Where the big ones sit.')}</span>
  `;
  const reactBook = `
    <span class="pc-only">${T('Bids > 60% — плотная поддержка снизу. Asks > 60% — давление сверху. Но крупная заявка может быть снята перед движением — это спуфинг.', 'Bids > 60% — dense support below. Asks > 60% — pressure above. But a big order can be pulled before the move — that is spoofing.')}</span>
    <span class="mobile-only">${T('Bids > 60% = поддержка. Asks > 60% = давление. Осторожно: заявку могут снять (спуфинг).', 'Bids > 60% = support. Asks > 60% = pressure. Careful: order can be pulled (spoofing).')}</span>
  `;

  setHTML('xray-content', `
    <div class="xray-item">
      <div class="xray-label">${x.mood}</div>
      <div class="xray-value" style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;margin-bottom:8px">${x.fundingText}</div>
      <div class="xray-explain">${whatFunding}</div>
      <div class="xray-react">💡 ${reactFunding}</div>
    </div>
    <div class="xray-item">
      <div class="xray-label">${x.pressure}</div>
      <div class="xray-value" style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;margin-bottom:8px">${x.obText}</div>
      <div class="xray-explain">${whatBook}</div>
      <div class="xray-react">💡 ${reactBook}</div>
    </div>
  `);
}

export interface WallSideView {
  price: number;
  total: number;
  distPct: number;
  sharePct: number;
  exchangeCount: number;
  exchanges: string[];
  status: 'new' | 'steady' | 'growing' | 'shrinking' | 'pulled';
  changePct: number;
}

export interface WallsData {
  bestBidWall: WallSideView;
  bestAskWall: WallSideView;
  sourceCount: number;
  sourcesFailed: string[];
  summary: {
    dominantSide: 'bid' | 'ask' | 'balanced';
    ratio: number;
    closerSide: 'bid' | 'ask' | 'equal';
    alertNote: string | null;
  } | null;
}

async function scanWalls(ticker: string): Promise<WallsData | null> {
  try {
    const res = await getAggregatedOrderbook(ticker);
    if (res.status !== 'success' || !res.bestBidWall || !res.bestAskWall) return null;
    return {
      bestBidWall: res.bestBidWall,
      bestAskWall: res.bestAskWall,
      sourceCount: res.sourceCount,
      sourcesFailed: res.sourcesFailed || [],
      summary: res.wallSummary || null,
    };
  } catch (e) {
    console.warn('[whale] aggregated walls failed', e);
    return null;
  }
}

function formatWallStatusBadge(
  status: WallSideView['status'],
  changePct: number,
  en: boolean
): { text: string; color: string } | null {
  if (status === 'pulled') {
    return {
      text: en ? `PULLED (${changePct.toFixed(0)}%)` : `СНЯТА (${changePct.toFixed(0)}%)`,
      color: 'var(--coral)',
    };
  }
  if (status === 'growing') {
    return {
      text: en ? `GROWING +${changePct.toFixed(0)}%` : `РАСТЁТ +${changePct.toFixed(0)}%`,
      color: 'var(--mint)',
    };
  }
  if (status === 'shrinking') {
    return {
      text: en ? `FALLING ${changePct.toFixed(0)}%` : `ТАЕТ ${changePct.toFixed(0)}%`,
      color: 'var(--amber)',
    };
  }
  if (status === 'steady') {
    return {
      text: en ? 'STEADY' : 'ДЕРЖИТСЯ',
      color: 'var(--cyan)',
    };
  }
  return null;
}

function buildSmartWallsHint(w: WallsData, en: boolean): string {
  const bid = w.bestBidWall;
  const ask = w.bestAskWall;
  const sum = w.summary;

  if (bid.status === 'pulled') {
    return en
      ? `Buy wall near ${fmtP(bid.price)} dropped sharply — watch for support weakness below.`
      : `Плита покупки у ${fmtP(bid.price)} резко просела — возможна слабость поддержки ниже.`;
  }
  if (ask.status === 'pulled') {
    return en
      ? `Sell wall near ${fmtP(ask.price)} dropped sharply — watch for resistance thinning above.`
      : `Плита продажи у ${fmtP(ask.price)} резко просела — сопротивление сверху могло ослабнуть.`;
  }

  const parts: string[] = [];

  if (sum) {
    if (sum.dominantSide === 'bid') {
      parts.push(
        en
          ? `Buy wall is ${sum.ratio.toFixed(1)}x larger than sell wall.`
          : `Плита покупки крупнее плиты продажи в ${sum.ratio.toFixed(1)}x.`
      );
    } else if (sum.dominantSide === 'ask') {
      parts.push(
        en
          ? `Sell wall is ${(1 / Math.max(sum.ratio, 0.01)).toFixed(1)}x larger than buy wall.`
          : `Плита продажи крупнее плиты покупки в ${(1 / Math.max(sum.ratio, 0.01)).toFixed(1)}x.`
      );
    } else {
      parts.push(
        en
          ? 'Buy and sell walls are fairly balanced in size.'
          : 'Плиты покупки и продажи сопоставимы по объёму.'
      );
    }

    if (sum.closerSide === 'bid') {
      parts.push(
        en
          ? `Support is closer (${bid.distPct.toFixed(2)}% vs ${ask.distPct.toFixed(2)}%).`
          : `Поддержка ближе к цене (${bid.distPct.toFixed(2)}% против ${ask.distPct.toFixed(2)}%).`
      );
    } else if (sum.closerSide === 'ask') {
      parts.push(
        en
          ? `Resistance is closer (${ask.distPct.toFixed(2)}% vs ${bid.distPct.toFixed(2)}%).`
          : `Сопротивление ближе к цене (${ask.distPct.toFixed(2)}% против ${bid.distPct.toFixed(2)}%).`
      );
    }

    if (sum.alertNote === 'single_exchange') {
      parts.push(
        en
          ? 'Both walls sit mostly on 1 exchange — higher spoofing risk.'
          : 'Обе плиты в основном на 1 бирже — выше риск спуфинга.'
      );
    }
  }

  return parts.join(' ');
}

function renderBadgePill(badge: { text: string; color: string } | null): string {
  if (!badge) return '';
  return `<span style="font-size:8.5px;font-weight:700;letter-spacing:0.6px;padding:2px 7px;border-radius:999px;color:${badge.color};border:1px solid ${badge.color};background:rgba(255,255,255,0.05);white-space:nowrap;">${badge.text}</span>`;
}

function renderWalls(w: WallsData | null): void {
  const card = document.getElementById('walls-card');
  if (!card) return;
  if (!w || !w.bestBidWall || !w.bestAskWall) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  const en = isEN();
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const totalEx = w.sourceCount || Math.max(w.bestBidWall.exchangeCount, w.bestAskWall.exchangeCount, 1);

  const bid = w.bestBidWall;
  const ask = w.bestAskWall;

  const bidBadge = formatWallStatusBadge(bid.status, bid.changePct, en);
  const askBadge = formatWallStatusBadge(ask.status, ask.changePct, en);

  const sumWalls = Math.max(0, bid.total) + Math.max(0, ask.total);
  const bidShareBarPct = sumWalls > 0
    ? Math.min(88, Math.max(12, Math.round((Math.max(0, bid.total) / sumWalls) * 100)))
    : 50;
  const askShareBarPct = 100 - bidShareBarPct;

  const smartHint = buildSmartWallsHint(w, en);
  const infoText = T(
    'VWAP-зона крупного лимитного объёма в стакане. Сравниваем дистанцию до цены, долю в объёме стороны, подтверждение по биржам и изменение между циклами.',
    'VWAP zone of large limit liquidity in the order book. Compares distance from price, share of side volume, exchange confirmation, and cycle-to-cycle change.'
  );

  setHTML('walls-content', `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--mut);text-transform:uppercase;letter-spacing:1.2px;">
        <span>📊</span>
        <span>${en ? 'Order book depth' : 'Глубина стакана'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <details style="font-family:'JetBrains Mono',monospace;">
          <summary style="list-style:none;cursor:pointer;font-size:9px;color:var(--mut);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:999px;user-select:none;">
            ℹ️ ${en ? 'How it works' : 'Справка'}
          </summary>
          <div style="margin-top:8px;padding:9px 11px;border-radius:10px;background:rgba(15,23,42,0.75);border:1px solid rgba(94,203,255,0.2);font-size:10.5px;line-height:1.45;color:var(--mut);max-width:520px;">
            ${infoText}
          </div>
        </details>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:999px;">
          ${en ? 'Updated' : 'Обновлено'}: ${timeStr}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;font-family:'JetBrains Mono',monospace;">
      <div style="background:linear-gradient(145deg,rgba(45,212,191,0.11),rgba(255,255,255,0.015));border:1px solid rgba(45,212,191,0.3);border-radius:12px;padding:11px 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px;margin-bottom:6px;">
          <span style="color:var(--mut);font-size:9.5px;letter-spacing:1.1px;text-transform:uppercase;font-weight:700;">🛡️ ${en ? 'Buy wall' : 'Плита покупки'}</span>
          ${renderBadgePill(bidBadge)}
        </div>
        <div style="color:var(--mint);font-size:17px;font-weight:800;letter-spacing:0.3px;">${fmtP(bid.price)}</div>
        <div style="font-size:11px;color:var(--fg, #e6edf3);font-weight:600;margin-top:5px;">
          ${en ? 'Volume' : 'Объём'}: <span style="color:var(--mint);">${Math.round(bid.total).toLocaleString()}</span> USDT
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:9.5px;color:var(--dim);margin-top:6px;">
          <span>-${bid.distPct.toFixed(2)}%</span>
          <span>·</span>
          <span>${bid.sharePct.toFixed(1)}% ${en ? 'side' : 'стороны'}</span>
          <span>·</span>
          <span>${bid.exchangeCount}/${totalEx} ${en ? 'ex' : 'бирж'}</span>
        </div>
      </div>

      <div style="background:linear-gradient(145deg,rgba(251,113,133,0.11),rgba(255,255,255,0.015));border:1px solid rgba(251,113,133,0.3);border-radius:12px;padding:11px 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px;margin-bottom:6px;">
          <span style="color:var(--mut);font-size:9.5px;letter-spacing:1.1px;text-transform:uppercase;font-weight:700;">🧱 ${en ? 'Sell wall' : 'Плита продажи'}</span>
          ${renderBadgePill(askBadge)}
        </div>
        <div style="color:var(--coral);font-size:17px;font-weight:800;letter-spacing:0.3px;">${fmtP(ask.price)}</div>
        <div style="font-size:11px;color:var(--fg, #e6edf3);font-weight:600;margin-top:5px;">
          ${en ? 'Volume' : 'Объём'}: <span style="color:var(--coral);">${Math.round(ask.total).toLocaleString()}</span> USDT
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:9.5px;color:var(--dim);margin-top:6px;">
          <span>+${ask.distPct.toFixed(2)}%</span>
          <span>·</span>
          <span>${ask.sharePct.toFixed(1)}% ${en ? 'side' : 'стороны'}</span>
          <span>·</span>
          <span>${ask.exchangeCount}/${totalEx} ${en ? 'ex' : 'бирж'}</span>
        </div>
      </div>
    </div>

    <div style="margin-top:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);font-family:'JetBrains Mono',monospace;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:9px;font-weight:700;margin-bottom:6px;">
        <span style="color:var(--mint);">${en ? 'BID WALL' : 'ПЛИТА ПОКУПКИ'} · ${bidShareBarPct}%</span>
        <span style="color:var(--coral);">${askShareBarPct}% · ${en ? 'ASK WALL' : 'ПЛИТА ПРОДАЖИ'}</span>
      </div>
      <div style="display:flex;height:7px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,0.08);gap:2px;">
        <div style="width:${bidShareBarPct}%;background:var(--mint);border-radius:999px 0 0 999px;transition:width 0.3s ease;"></div>
        <div style="width:${askShareBarPct}%;background:var(--coral);border-radius:0 999px 999px 0;transition:width 0.3s ease;"></div>
      </div>
    </div>

    <div style="margin-top:10px;padding:10px 12px;border-radius:11px;background:linear-gradient(90deg,rgba(94,203,255,0.08),rgba(255,255,255,0.02));border:1px solid rgba(94,203,255,0.22);display:flex;align-items:flex-start;gap:9px;">
      <span style="font-size:14px;line-height:1.2;flex-shrink:0;">💡</span>
      <div style="font-size:11.5px;line-height:1.45;color:var(--fg, #e6edf3);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cyan);font-weight:700;margin-bottom:3px;">
          ${en ? 'LIVE WALL INSIGHT' : 'ИНФО ПО СТАКАНУ'}
        </div>
        <div>${smartHint}</div>
      </div>
    </div>
  `);
}

// ─── Экспорт в window ───
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    calculateVolumeAnomalies,
    mergeWhaleMetrics,
    renderWhaleData,
    fetchExtras,
  });
}