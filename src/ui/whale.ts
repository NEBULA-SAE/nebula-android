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
import { setModuleSignal } from './master-signal';

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
      react: z >= 2.5
        ? T('Аномальный всплеск. Рост = покупают, падение = льют, флэт = поглощение.', 'Volume spike. Up = buying, down = selling, flat = absorption.')
        : T('Объём в норме, крупных входов не видно.', 'Volume is normal, no big entries.'),
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
      react: v.isRising
        ? T('Идёт скрытое накопление объёма покупателями.', 'Quiet buyer accumulation underway.')
        : v.isFalling
          ? T('Идёт распределение — крупные могут сбрасывать.', 'Distribution — big players may be selling.')
          : T('Нейтрально, явного перевеса нет.', 'Neutral, no clear bias.'),
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
      react:
        v.futuresVerdict === 'new_longs' ? T('Новые лонги заходят в рынок. Тренд поддержан деньгами.', 'New longs entering. Trend backed by money.')
        : v.futuresVerdict === 'new_shorts' ? T('Новые шорты давят вниз. При минус-фандинге риск сквиза.', 'New shorts pushing down. Watch for squeeze.')
        : v.futuresVerdict === 'short_cover' ? T('Рост на закрытии шортов, не на новых покупках.', 'Rising on short covering, not fresh buys.')
        : v.futuresVerdict === 'long_liq' ? T('Ликвидация лонгов. Не лови ножи без подтверждения.', 'Long liquidations. Do not catch knives.')
        : T('OI без явного перекоса.', 'OI without a clear signal.'),
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
      react: isBull
        ? T('Топ в лонгах, толпа в шортах — умные против толпы.', 'Top long, crowd short — smart money bullish.')
        : isBear
          ? T('Топ в шортах, толпа в лонгах — умные фиксируются.', 'Top short, crowd long — smart money exiting.')
          : T('Топ и толпа смотрят в одну сторону.', 'Top and crowd on the same side.'),
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
      react: isBull
        ? T('Покупатели бьют по рынку агрессивнее продавцов.', 'Buyers hitting the market more aggressively.')
        : isBear
          ? T('Продавцы агрессивнее бьют по рынку прямо сейчас.', 'Sellers hitting the market more aggressively.')
          : T('Паритет по рыночным сделкам.', 'Market orders are balanced.'),
      active: isBull || isBear,
    });
  }

  const order = { strong: 0, medium: 1, weak: 2 };
  return out.sort((a, b) => order[a.strength] - order[b.strength]);
}

function buildSmartWhaleInsight(v: WhaleMergedData, activeCount: number, en: boolean): string {
  const parts: string[] = [];

  if (v.isWhaleActive) {
    if (v.pressure === 'buying') {
      parts.push(en ? `Strong whale buying spike (${v.zScore.toFixed(1)}σ).` : `Зафиксирован крупный вход покупателей (${v.zScore.toFixed(1)}σ).`);
    } else if (v.pressure === 'selling') {
      parts.push(en ? `Heavy whale selling spike (${v.zScore.toFixed(1)}σ).` : `Зафиксирован крупный сброс объёма (${v.zScore.toFixed(1)}σ).`);
    } else if (v.pressure === 'absorption') {
      parts.push(en ? `High volume absorption (${v.zScore.toFixed(1)}σ) with flat price — big player quietly building.` : `Поглощение на высоком объёме (${v.zScore.toFixed(1)}σ) при стоящей цене — идёт скрытый набор.`);
    }
  }

  if (v.futuresVerdict === 'new_longs') {
    parts.push(en ? 'Futures confirm fresh longs entering.' : 'Фьючерсы подтверждают приток новых лонгов.');
  } else if (v.futuresVerdict === 'new_shorts') {
    parts.push(en ? 'Futures show fresh short pressure.' : 'На фьючерсах заходят новые шорты.');
  } else if (v.futuresVerdict === 'short_cover') {
    parts.push(en ? 'Move is fueled by short covering rather than new demand.' : 'Движение идёт на закрытии шортов, а не на новых деньгах.');
  } else if (v.futuresVerdict === 'long_liq') {
    parts.push(en ? 'Long liquidations underway — wait for stabilization.' : 'Идёт вынос лонгов — лучше дождаться стабилизации.');
  }

  if (!parts.length) {
    if (activeCount >= 2) {
      parts.push(en ? 'Moderate capital flow detected across multiple metrics — keep an eye on confirmation.' : 'Умеренная активность капитала сразу по нескольким метрикам — следи за подтверждением.');
    } else {
      parts.push(en ? 'No anomalous whale entries right now. Market is moving on regular flow.' : 'Аномальных входов китов сейчас нет. Рынок движется на обычном потоке.');
    }
  }

  return parts.join(' ');
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

  const en = isEN();
  const isActive = volData.isWhaleActive || volData.score > 50;

  let signals = buildSignals(volData);
  if (!state.isPro) {
    signals = signals.filter(s => s.key === 'volume' || s.key === 'obv');
  }

  const activeSignals = signals.filter(s => s.active);

  if (badge) {
    badge.classList.remove('whale-badge-calm', 'whale-badge-waking', 'whale-badge-active');
    if (volData.isWhaleActive || volData.score >= 60) {
      badge.textContent = T('🐋 КАПИТАЛ ВОШЁЛ', '🐋 WHALE IN');
      badge.classList.add('whale-badge-active');
    } else if (volData.score >= 35 || activeSignals.length >= 2) {
      badge.textContent = T('⚡ ПОЯВЛЯЕТСЯ', '⚡ WAKING UP');
      badge.classList.add('whale-badge-waking');
    } else {
      badge.textContent = T('СПОКОЙНО', 'CALM');
      badge.classList.add('whale-badge-calm');
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
  const srcCov = sourcesCoverage(volData.sources);
  const audioOn = audioService.isEnabled();
  const audioBtnLabel = audioOn ? T('🔊 Звук ВКЛ', '🔊 Sound ON') : T('🔇 Звук ВЫКЛ', '🔇 Sound OFF');

  const infoText = T(
    'Радар объединяет спотовый объём (Z-score за 30 свечей и наклон OBV) с фьючерсами (изменение Open Interest, перекос LSR топ-трейдеров против толпы и агрессию Taker Buy/Sell). Чем выше балл, тем сильнее след крупного капитала.',
    'Radar combines spot volume (30-candle Z-score & OBV slope) with futures (Open Interest delta, top-vs-crowd LSR skew, and Taker Buy/Sell aggression). Higher score means stronger institutional footprint.'
  );

  const signalsHtml = signals.map(s => {
    const borderCol =
      s.active
        ? (s.color === 'var(--mint)' ? 'rgba(45,212,191,0.32)'
          : s.color === 'var(--coral)' ? 'rgba(251,113,133,0.32)'
          : s.color === 'var(--cyan)' ? 'rgba(94,203,255,0.38)'
          : 'rgba(251,191,36,0.3)')
        : 'rgba(255,255,255,0.08)';

    const pill = s.strength === 'strong'
      ? { text: en ? 'STRONG' : 'СИЛЬНЫЙ', color: s.color }
      : s.active
        ? { text: en ? 'ACTIVE' : 'АКТИВЕН', color: s.color }
        : { text: en ? 'CALM' : 'НОРМА', color: 'var(--dim)' };

    return `
      <div style="background:linear-gradient(145deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01));border:1px solid ${borderCol};border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;justify-content:space-between;gap:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:18px;">
          <span style="font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--mut);text-transform:uppercase;letter-spacing:0.9px;font-weight:700;">${s.title}</span>
          ${renderBadgePill(pill)}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:800;color:${s.color};letter-spacing:0.2px;">${s.value}</div>
        <div style="font-size:11px;line-height:1.4;color:var(--dim);">${s.react}</div>
      </div>
    `;
  }).join('');

  const smartInsight = buildSmartWhaleInsight(volData, activeSignals.length, en);

  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:12px;font-family:'JetBrains Mono',monospace;">
        <div>
          <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;">${tm('whale_score')}</div>
          <div style="font-size:20px;font-weight:800;color:${scoreColor};line-height:1.15;">${volData.score}<span style="font-size:11px;color:var(--dim);font-weight:600;">/100</span></div>
        </div>
        <div style="width:1px;height:26px;background:rgba(255,255,255,0.08);"></div>
        <div>
          <div style="font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;">${tm('whale_signals_label')}</div>
          <div style="font-size:20px;font-weight:800;color:${scoreColor};line-height:1.15;">${activeSignals.length}<span style="font-size:11px;color:var(--dim);font-weight:600;">/${signals.length}</span></div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:6px;">
        <details style="font-family:'JetBrains Mono',monospace;">
          <summary style="list-style:none;cursor:pointer;font-size:9px;color:var(--mut);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:4px 9px;border-radius:999px;user-select:none;">
            ℹ️ ${en ? 'How it works' : 'Справка'}
          </summary>
          <div style="margin-top:8px;padding:9px 11px;border-radius:10px;background:rgba(15,23,42,0.75);border:1px solid rgba(94,203,255,0.2);font-size:10.5px;line-height:1.45;color:var(--mut);max-width:520px;">
            ${infoText}
          </div>
        </details>
        <button id="whale-audio-toggle" type="button" style="cursor:pointer;font-family:'JetBrains Mono',monospace;font-size:9.5px;padding:4px 9px;border-radius:999px;border:1px solid ${audioOn ? 'rgba(94,203,255,.5)' : 'rgba(255,255,255,.12)'};background:${audioOn ? 'rgba(94,203,255,.14)' : 'rgba(255,255,255,.04)'};color:${audioOn ? 'var(--cyan)' : 'var(--mut)'};white-space:nowrap;">${audioBtnLabel}</button>
      </div>
    </div>

    <div style="height:6px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,0.07);margin-bottom:8px;">
      <div style="width:${volData.score}%;height:100%;background:${scoreColor};border-radius:999px;transition:width 0.35s ease;"></div>
    </div>

    ${srcCov ? `<div style="font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--dim);margin-bottom:10px;">${tm('whale_sources_label')}: ${srcCov}</div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
      ${signalsHtml}
    </div>

    <div style="margin-top:10px;padding:10px 12px;border-radius:11px;background:linear-gradient(90deg,rgba(94,203,255,0.08),rgba(255,255,255,0.02));border:1px solid rgba(94,203,255,0.22);display:flex;align-items:flex-start;gap:9px;">
      <span style="font-size:14px;line-height:1.2;flex-shrink:0;">💡</span>
      <div style="font-size:11.5px;line-height:1.45;color:var(--fg, #e6edf3);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cyan);font-weight:700;margin-bottom:3px;">
          ${en ? 'WHALE RADAR INSIGHT' : 'ИНФО ПО КИТАМ'}
        </div>
        <div>${smartInsight}</div>
      </div>
    </div>
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

  const whaleLamp =
    volData.pressure === 'buying' || volData.futuresVerdict === 'new_longs'
      ? 'green'
      : volData.pressure === 'selling' || volData.futuresVerdict === 'new_shorts' || volData.futuresVerdict === 'long_liq'
        ? 'red'
        : volData.score >= 50
          ? 'cyan'
          : 'yellow';
  setModuleSignal('whale', whaleLamp);

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
  funding: {
    ok: boolean;
    avg: number;
    apr: number;
    sourceCount: number;
    regime: 'short_heavy' | 'long_heavy' | 'extreme_long' | 'neutral';
  };
  book: {
    ok: boolean;
    bidsPct: number;
    asksPct: number;
    pressureNear: number;
    pressureWeighted: number;
    totalBidsUsdt: number;
    totalAsksUsdt: number;
    sourceCount: number;
    failedCount: number;
    regime: 'bids' | 'asks' | 'fight';
    nearDivergence: 'fake_bids' | 'fake_asks' | null;
  };
}

function fmtCompactUsdt(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${Math.round(val / 1_000)}K`;
  return `$${Math.round(val)}`;
}

async function fetchXray(ticker: string): Promise<XrayData> {
  const data: XrayData = {
    funding: { ok: false, avg: 0, apr: 0, sourceCount: 0, regime: 'neutral' },
    book: {
      ok: false,
      bidsPct: 50,
      asksPct: 50,
      pressureNear: 0,
      pressureWeighted: 0,
      totalBidsUsdt: 0,
      totalAsksUsdt: 0,
      sourceCount: 0,
      failedCount: 0,
      regime: 'fight',
      nearDivergence: null,
    },
  };

  try {
    const [fundingRes, orderbookRes] = await Promise.all([
      getAggregatedFunding(ticker),
      getAggregatedOrderbook(ticker),
    ]);

    if (fundingRes && fundingRes.status === 'success') {
      const avg = fundingRes.avgFunding;
      (window as any).updateFundingRate?.(avg, ticker);
      const regime: XrayData['funding']['regime'] =
        avg < -0.01 ? 'short_heavy'
        : avg >= 0.05 ? 'extreme_long'
        : avg > 0.01 ? 'long_heavy'
        : 'neutral';

      data.funding = {
        ok: true,
        avg,
        apr: avg * 3 * 365,
        sourceCount: fundingRes.sourceCount,
        regime,
      };
    }

    if (orderbookRes && orderbookRes.status === 'success') {
      const bidsRound = Math.min(99, Math.max(1, Math.round(orderbookRes.bidsPct)));
      const asksRound = 100 - bidsRound;
      const pNear = orderbookRes.pressureNear ?? 0;
      const pWeight = orderbookRes.pressureWeighted ?? 0;

      const regime: XrayData['book']['regime'] =
        bidsRound >= 60 ? 'bids' : asksRound >= 60 ? 'asks' : 'fight';

      let nearDivergence: XrayData['book']['nearDivergence'] = null;
      if (bidsRound >= 58 && pNear <= -0.15) nearDivergence = 'fake_bids';
      else if (asksRound >= 58 && pNear >= 0.15) nearDivergence = 'fake_asks';

      data.book = {
        ok: true,
        bidsPct: bidsRound,
        asksPct: asksRound,
        pressureNear: pNear,
        pressureWeighted: pWeight,
        totalBidsUsdt: orderbookRes.totalBidsUsdt || 0,
        totalAsksUsdt: orderbookRes.totalAsksUsdt || 0,
        sourceCount: orderbookRes.sourceCount,
        failedCount: (orderbookRes.sourcesFailed || []).length,
        regime,
        nearDivergence,
      };
    }
  } catch (e) {
    console.warn('[whale] aggregated xray failed', e);
  }

  return data;
}

function buildSmartXrayInsight(x: XrayData, en: boolean): string {
  const f = x.funding;
  const b = x.book;
  const parts: string[] = [];

  if (f.ok && b.ok) {
    if (f.regime === 'short_heavy' && b.regime === 'bids') {
      parts.push(
        en
          ? 'Strong short-squeeze setup: crowd is heavily short while dense bids support price below.'
          : 'Сильный сетап на шорт-сквиз: толпа перегружена в шортах, а снизу стоит плотная поддержка.'
      );
    } else if ((f.regime === 'long_heavy' || f.regime === 'extreme_long') && b.regime === 'asks') {
      parts.push(
        en
          ? 'Overheated longs facing sell pressure above — elevated pullback risk.'
          : 'Перегретые лонги упираются в давление продавцов сверху — повышенный риск отката.'
      );
    } else if (f.regime === 'extreme_long') {
      parts.push(
        en
          ? 'Extreme positive funding — longs are paying a steep premium, watch for a flush.'
          : 'Экстремальный фандинг — лонги переплачивают, высокий риск резкого сброса.'
      );
    } else if (f.regime === 'short_heavy') {
      parts.push(
        en
          ? 'Negative funding shows short crowding — any upward impulse can trigger a squeeze.'
          : 'Отрицательный фандинг указывает на скопление шортов — импульс вверх может дать сквиз.'
      );
    } else if (b.regime === 'bids') {
      parts.push(
        en
          ? `Funding is neutral, while order book leans bullish (${b.bidsPct}% bids).`
          : `Фандинг нейтральный, но стакан перевешивает в сторону покупателей (${b.bidsPct}% бидов).`
      );
    } else if (b.regime === 'asks') {
      parts.push(
        en
          ? `Funding is neutral, while sellers dominate the order book (${b.asksPct}% asks).`
          : `Фандинг нейтральный, но в стакане доминируют продавцы (${b.asksPct}% асков).`
      );
    } else {
      parts.push(
        en
          ? 'Market is balanced across both funding and order book — waiting for a clear trigger.'
          : 'Баланс и по фандингу, и по стакану — явного перекоса нет, ждём триггер.'
      );
    }
  } else if (f.ok) {
    parts.push(
      f.regime === 'short_heavy'
        ? T('Отрицательный фандинг — много шортов, возможен сквиз вверх.', 'Negative funding — heavy shorts, squeeze possible.')
        : f.regime === 'neutral'
          ? T('Фандинг в нейтральной зоне, перегрева нет.', 'Funding is neutral, no overheat.')
          : T('Положительный фандинг — лонги перегреты, осторожнее с входом в рост.', 'Positive funding — longs are crowded, be careful chasing.')
    );
  } else if (b.ok) {
    parts.push(
      b.regime === 'bids'
        ? T(`В стакане перевес покупателей (${b.bidsPct}% / ${b.asksPct}%).`, `Buyers lead the book (${b.bidsPct}% / ${b.asksPct}%).`)
        : b.regime === 'asks'
          ? T(`В стакане давление продавцов (${b.bidsPct}% / ${b.asksPct}%).`, `Sellers press the book (${b.bidsPct}% / ${b.asksPct}%).`)
          : T('В стакане позиционная борьба без явного лидера.', 'Order book shows balanced tug-of-war.')
    );
  } else {
    return T('Нет данных от бирж для оценки перекоса.', 'No exchange data available for skew analysis.');
  }

  if (b.ok && b.nearDivergence === 'fake_bids') {
    parts.push(
      en
        ? 'Caution: near-spread (±0.3%) sellers are pressing despite deep bids — watch for bid spoofing.'
        : 'Осторожно: прямо у цены (±0.3%) давят продавцы вопреки глубоким бидам — возможны фейковые тазики.'
    );
  } else if (b.ok && b.nearDivergence === 'fake_asks') {
    parts.push(
      en
        ? 'Note: near-spread (±0.3%) buyers are stronger than deep asks — resistance may be thin close to price.'
        : 'Нюанс: у самой цены (±0.3%) покупатели сильнее общих асков — ближнее сопротивление слабее.'
    );
  }

  return parts.join(' ');
}

function renderXray(x: XrayData): void {
  const card = document.getElementById('xray-card');
  if (!card) return;
  card.style.display = 'block';

  const xrayLamp =
    (x.funding.regime === 'short_heavy' || x.book.regime === 'bids') && x.funding.regime !== 'extreme_long'
      ? 'green'
      : x.funding.regime === 'extreme_long' || x.funding.regime === 'long_heavy' || x.book.regime === 'asks'
        ? 'red'
        : 'yellow';
  setModuleSignal('xray', xrayLamp);

  const en = isEN();
  const exLabel = tm('exchange_count');
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const f = x.funding;
  const b = x.book;

  // ── Карточка 1: Funding ──
  const fColor =
    !f.ok ? 'var(--dim)'
    : f.regime === 'short_heavy' ? 'var(--mint)'
    : f.regime === 'long_heavy' || f.regime === 'extreme_long' ? 'var(--coral)'
    : 'var(--amber)';

  const fBadge = !f.ok ? null : (
    f.regime === 'short_heavy' ? { text: en ? 'SHORTS CROWDED' : 'ШОРТЫ ДАВЯТ', color: 'var(--mint)' }
    : f.regime === 'extreme_long' ? { text: en ? 'EXTREME LONGS' : 'ПЕРЕГРЕВ ЛОНГОВ', color: 'var(--coral)' }
    : f.regime === 'long_heavy' ? { text: en ? 'LONGS CROWDED' : 'ЭЙФОРИЯ', color: 'var(--coral)' }
    : { text: en ? 'NEUTRAL' : 'НЕЙТРАЛЬНО', color: 'var(--amber)' }
  );

  // Позиция маркера на биполярной шкале (-0.05% .. +0.05%)
  const clampedFund = Math.max(-0.05, Math.min(0.05, f.avg));
  const fundMarkerPct = 50 + (clampedFund / 0.05) * 46;

  const fundingCardHtml = !f.ok
    ? `<div style="color:var(--dim);font-size:12px;padding:12px 0;">${en ? 'Futures unavailable' : 'Фьючерсы недоступны'}</div>`
    : `
      <div style="color:${fColor};font-size:18px;font-weight:800;letter-spacing:0.3px;">
        ${f.avg > 0 ? '+' : ''}${f.avg.toFixed(4)}%
      </div>
      <div style="font-size:10.5px;color:var(--mut);margin-top:4px;">
        APR: <span style="color:var(--fg,#e6edf3);font-weight:600;">${f.apr > 0 ? '+' : ''}${f.apr.toFixed(1)}%</span> · ${f.sourceCount} ${exLabel}
      </div>
      <div style="margin-top:9px;">
        <div style="position:relative;height:7px;border-radius:999px;background:linear-gradient(90deg,var(--mint) 0%,rgba(255,255,255,0.18) 50%,var(--coral) 100%);border:1px solid rgba(255,255,255,0.1);">
          <div style="position:absolute;left:50%;top:-1px;bottom:-1px;width:1px;background:rgba(255,255,255,0.35);"></div>
          <div style="position:absolute;left:${fundMarkerPct}%;top:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;background:${fColor};box-shadow:0 0 8px ${fColor};border:1.5px solid #0b111a;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:8.5px;color:var(--dim);margin-top:4px;">
          <span>-0.05%</span>
          <span>0%</span>
          <span>+0.05%</span>
        </div>
      </div>
    `;

  // ── Карточка 2: Order book pressure ──
  const bColor =
    !b.ok ? 'var(--dim)'
    : b.regime === 'bids' ? 'var(--mint)'
    : b.regime === 'asks' ? 'var(--coral)'
    : 'var(--amber)';

  const bBadge = !b.ok ? null : (
    b.regime === 'bids' ? { text: en ? 'BIDS BELOW' : 'СНИЗУ ТАЗИКИ', color: 'var(--mint)' }
    : b.regime === 'asks' ? { text: en ? 'SELLERS PUSH' : 'ДАВЯТ СВЕРХУ', color: 'var(--coral)' }
    : { text: en ? 'BALANCED' : 'БОРЬБА', color: 'var(--amber)' }
  );

  const nearBidPct = Math.round(((b.pressureNear + 1) / 2) * 100);
  const nearColor = nearBidPct >= 58 ? 'var(--mint)' : nearBidPct <= 42 ? 'var(--coral)' : 'var(--mut)';
  const partialTxt = b.failedCount > 0 ? ` · ${tm('book_partial')}` : '';

  const bookCardHtml = !b.ok
    ? `<div style="color:var(--dim);font-size:12px;padding:12px 0;">${en ? 'Order book unavailable' : 'Стакан недоступен'}</div>`
    : `
      <div style="display:flex;align-items:baseline;gap:6px;">
        <span style="color:var(--mint);font-size:18px;font-weight:800;">${b.bidsPct}%</span>
        <span style="color:var(--dim);font-size:13px;">/</span>
        <span style="color:var(--coral);font-size:18px;font-weight:800;">${b.asksPct}%</span>
      </div>
      <div style="display:flex;height:6px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,0.08);gap:2px;margin-top:7px;">
        <div style="width:${b.bidsPct}%;background:var(--mint);border-radius:999px 0 0 999px;transition:width 0.3s ease;"></div>
        <div style="width:${b.asksPct}%;background:var(--coral);border-radius:0 999px 999px 0;transition:width 0.3s ease;"></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:9.5px;color:var(--dim);margin-top:7px;">
        <span>${en ? 'Near ±0.3%' : 'У цены ±0.3%'}: <b style="color:${nearColor}">${nearBidPct}%</b></span>
        <span>·</span>
        <span>${fmtCompactUsdt(b.totalBidsUsdt)} / ${fmtCompactUsdt(b.totalAsksUsdt)}</span>
        <span>·</span>
        <span>${b.sourceCount} ${exLabel}${partialTxt}</span>
      </div>
    `;

  const smartInsight = buildSmartXrayInsight(x, en);
  const infoText = T(
    'Funding rate — ставка между лонгами и шортами каждые 8ч (минус = толпа в шортах, риск сквиза; плюс > 0.05% = перегрев лонгов). Давление в стакане сравнивает общий объём лимиток с давлением прямо у спреда (±0.3%), чтобы отличать реальную поддержку от дальних фейковых заявок.',
    'Funding rate is the 8h fee between longs and shorts (negative = crowded shorts / squeeze risk; positive > 0.05% = overheated longs). Book pressure compares total depth against near-spread (±0.3%) liquidity to separate real support from far spoof orders.'
  );

  const fBorder = f.regime === 'short_heavy' ? 'rgba(45,212,191,0.3)' : (f.regime === 'long_heavy' || f.regime === 'extreme_long') ? 'rgba(251,113,133,0.3)' : 'rgba(251,191,36,0.24)';
  const bBorder = b.regime === 'bids' ? 'rgba(45,212,191,0.3)' : b.regime === 'asks' ? 'rgba(251,113,133,0.3)' : 'rgba(251,191,36,0.24)';

  setHTML('xray-content', `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--mut);text-transform:uppercase;letter-spacing:1.2px;">
        <span>🧬</span>
        <span>${en ? 'Funding & Book Skew' : 'Фандинг и перекос стакана'}</span>
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

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;font-family:'JetBrains Mono',monospace;">
      <div style="background:linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01));border:1px solid ${fBorder};border-radius:12px;padding:11px 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px;margin-bottom:6px;">
          <span style="color:var(--mut);font-size:9.5px;letter-spacing:1.1px;text-transform:uppercase;font-weight:700;">🔥 ${en ? 'Crowd mood (Funding)' : 'Настроение толпы'}</span>
          ${renderBadgePill(fBadge)}
        </div>
        ${fundingCardHtml}
      </div>

      <div style="background:linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01));border:1px solid ${bBorder};border-radius:12px;padding:11px 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px;margin-bottom:6px;">
          <span style="color:var(--mut);font-size:9.5px;letter-spacing:1.1px;text-transform:uppercase;font-weight:700;">⚖️ ${en ? 'Order book pressure' : 'Давление в стакане'}</span>
          ${renderBadgePill(bBadge)}
        </div>
        ${bookCardHtml}
      </div>
    </div>

    <div style="margin-top:10px;padding:10px 12px;border-radius:11px;background:linear-gradient(90deg,rgba(94,203,255,0.08),rgba(255,255,255,0.02));border:1px solid rgba(94,203,255,0.22);display:flex;align-items:flex-start;gap:9px;">
      <span style="font-size:14px;line-height:1.2;flex-shrink:0;">💡</span>
      <div style="font-size:11.5px;line-height:1.45;color:var(--fg, #e6edf3);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cyan);font-weight:700;margin-bottom:3px;">
          ${en ? 'LIVE X-RAY INSIGHT' : 'ИНФО ПО РЕНТГЕНУ'}
        </div>
        <div>${smartInsight}</div>
      </div>
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

  const wallsLamp =
    w.bestBidWall.status === 'pulled' || w.summary?.dominantSide === 'ask'
      ? 'red'
      : w.summary?.dominantSide === 'bid'
        ? 'green'
        : 'yellow';
  setModuleSignal('walls', wallsLamp);

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