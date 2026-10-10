// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · WHALE
// Радар китов + Рентген толпы + Стенки в стакане
// ═══════════════════════════════════════════════════════════════

import { tm, isEN } from '../i18n';
import { fmtP, setHTML } from '../utils';
import { getAggregatedFunding } from '../sources/funding';
import { getAggregatedOrderbook } from '../sources/orderbook';

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

  // OBV slope
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

  // Score
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

  // Futures verdict — соотношение OI и давления
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

// ─── ХЕЛПЕР: строка источников ───

function sourcesLabel(sources: string[]): string {
  if (!sources || !sources.length) return '';
  const map: Record<string, string> = {};
  sources.forEach(s => {
    const [k, v] = s.split(':');
    if (k && v) map[k] = v;
  });
  const parts: string[] = [];
  if (map.oi) parts.push(`OI: ${map.oi}`);
  if (map.lsr) parts.push(`LSR: ${map.lsr}`);
  if (map.taker) parts.push(`Taker: ${map.taker}`);
  return parts.join(' · ');
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

  if (badge) {
    if (isActive) {
      badge.textContent = tm('whale_active') + ' 🐋';
      badge.style.color = 'var(--cyan)';
      badge.style.textShadow = '0 0 10px rgba(94,203,255,.6)';
    } else {
      badge.textContent = tm('whale_calm');
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

  const scoreColor =
    volData.score > 60 ? 'var(--cyan)' :
    volData.score > 30 ? 'var(--amber)' : 'var(--mut)';

  const pressureColor =
    volData.pressure === 'buying' ? 'var(--mint)' :
    volData.pressure === 'selling' ? 'var(--coral)' :
    volData.pressure === 'absorption' ? 'var(--amber)' : 'var(--mut)';

  const pressureText =
    volData.pressure === 'buying' ? tm('whale_pressure_buying') :
    volData.pressure === 'selling' ? tm('whale_pressure_selling') :
    volData.pressure === 'absorption' ? tm('whale_pressure_absorption') :
    tm('whale_pressure_neutral');

  const obvColor = volData.isRising
    ? 'var(--mint)'
    : (volData.isFalling ? 'var(--coral)' : 'var(--mut)');

  let futuresHTML = '';
  if (volData.hasFutures) {
    let oiColor = 'var(--mut)';
    if (volData.futuresVerdict === 'new_longs') oiColor = 'var(--mint)';
    else if (volData.futuresVerdict === 'new_shorts') oiColor = 'var(--coral)';
    else if (volData.futuresVerdict === 'short_cover') oiColor = 'var(--amber)';
    else if (volData.futuresVerdict === 'long_liq') oiColor = 'var(--coral)';

    const oiChangeText = volData.oiChangePct != null
      ? `${volData.oiChangePct > 0 ? '+' : ''}${volData.oiChangePct}%`
      : '—';

    const takerColor = (volData.takerRatio ?? 1) > 1.15
      ? 'var(--mint)'
      : (volData.takerRatio ?? 1) < 0.85 ? 'var(--coral)' : 'var(--mut)';

    let lsrText = '—';
    let lsrColor = 'var(--hi)';
    if (volData.lsrTop != null && volData.lsrGlobal != null) {
      lsrText = `${volData.lsrTop.toFixed(2)} / ${volData.lsrGlobal.toFixed(2)}`;
      if (volData.lsrTop > volData.lsrGlobal * 1.05) lsrColor = 'var(--mint)';
      else if (volData.lsrTop < volData.lsrGlobal * 0.95) lsrColor = 'var(--coral)';
    } else if (volData.lsrTop != null) {
      lsrText = volData.lsrTop.toFixed(2);
    }

    let comboText = '';
    let comboColor = 'var(--mut)';
    if (volData.futuresVerdict === 'new_longs') {
      comboText = isEN() ? 'New longs 🚀' : 'Новые лонги 🚀';
      comboColor = 'var(--mint)';
    } else if (volData.futuresVerdict === 'new_shorts') {
      comboText = isEN() ? 'New shorts 🔻' : 'Новые шорты 🔻';
      comboColor = 'var(--coral)';
    } else if (volData.futuresVerdict === 'short_cover') {
      comboText = isEN() ? 'Short cover ⚡' : 'Закрытие шортов ⚡';
      comboColor = 'var(--amber)';
    } else if (volData.futuresVerdict === 'long_liq') {
      comboText = isEN() ? 'Long squeeze 💀' : 'Ликвидации лонгов 💀';
      comboColor = 'var(--coral)';
    }

    const srcLabel = sourcesLabel(volData.sources);

    futuresHTML = `
      <div style="margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase;">${tm('whale_futures')}</div>
          ${srcLabel ? `<div style="font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--dim);letter-spacing:.5px;">${srcLabel}</div>` : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">${tm('whale_oi_change')}</div>
            <div class="tip-wrap" data-tip="Open Interest — сумма всех открытых фьючерсных позиций. Рост OI = входят новые деньги." style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${oiColor};">${oiChangeText}</div>
          </div>
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">${tm('whale_taker')}</div>
            <div class="tip-wrap" data-tip="Taker Buy/Sell — соотношение агрессивных покупок и продаж. Больше 1.15 — покупатели давят." style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${takerColor};">${volData.takerRatio != null ? volData.takerRatio.toFixed(2) : '—'}</div>
          </div>
          <div style="grid-column:1/-1;">
            <div style="font-family:'JetBrains Mono',monospace;font-size:8.5px;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;">${tm('whale_lsr_top')} / ${tm('whale_lsr_global')}</div>
            <div class="tip-wrap" data-tip="Long/Short Ratio. Топ-трейдеры / толпа. Если топ в лонге, а толпа в шорте — бычий сигнал." style="font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:${lsrColor};">${lsrText}</div>
          </div>
          ${comboText ? `
          <div style="grid-column:1/-1;padding-top:6px;border-top:1px dashed rgba(255,255,255,.05);">
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:${comboColor};">${comboText}</div>
          </div>` : ''}
        </div>
      </div>
    `;
  } else {
    futuresHTML = `
      <div style="margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.06);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">${tm('whale_futures')}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mut);">${tm('whale_not_traded')}</div>
      </div>
    `;
  }

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">${tm('whale_score')}</div>
        <div class="tip-wrap" data-tip="Whale Score = сумма баллов: спотовые метрики (до 60) + фьючерсные метрики (до 40)." style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:800;color:${scoreColor};">${volData.score}<span style="font-size:10px;color:var(--mut);font-weight:400;">/100</span></div>
      </div>
      <div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">${tm('whale_zscore')}</div>
        <div class="tip-wrap" data-tip="Z-score = на сколько стандартных отклонений текущий объём превышает средний за 30 дней." style="font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;color:${volData.zScore > 2.5 ? 'var(--cyan)' : 'var(--hi)'};">${volData.zScore}σ</div>
      </div>
    </div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.06);">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">${tm('whale_pressure')}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${pressureColor};">
        ${pressureText} <span style="font-size:10px;color:var(--mut);font-weight:400;">${volData.pressureStrength}%</span>
      </div>
    </div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.06);">
      <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:6px;">${tm('whale_obv')}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;color:${obvColor};">
        ${volData.obvTrend} <span style="font-size:10px;color:var(--mut);font-weight:400;">${volData.obvSlope > 0 ? '+' : ''}${volData.obvSlope}</span>
      </div>
    </div>
    ${futuresHTML}
  `;
  card.style.display = 'block';
}

// ─── XRAY + WALLS ───

export async function fetchExtras(ticker: string): Promise<void> {
  try {
    const [xray, walls] = await Promise.all([fetchXray(ticker), scanWalls(ticker)]);
    renderXray(xray);
    renderWalls(walls);
    // drawOrderbookWalls пока не подключено (в chart.ts)
  } catch (e) {
    console.warn('[whale] fetchExtras:', e);
  }
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

export interface WallsData {
  bestBidWall: { price: number; total: number };
  bestAskWall: { price: number; total: number };
  sourceCount: number;
  sourcesFailed: string[];
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
    };
  } catch (e) {
    console.warn('[whale] aggregated walls failed', e);
    return null;
  }
}

function renderXray(x: XrayData): void {
  const card = document.getElementById('xray-card');
  if (!card) return;
  card.style.display = 'block';
  setHTML('xray-content', `
    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6;margin-bottom:12px">
      <div style="color:var(--dim);font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:6px">${x.mood}</div>
      <div>${x.fundingText}</div>
    </div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:1.6">
      <div style="color:var(--dim);font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:6px">${x.pressure}</div>
      <div>${x.obText}</div>
    </div>`);
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
  const srcInfo = w.sourceCount ? ` · ${w.sourceCount} ${tm('exchange_count')}` : '';
  setHTML('walls-content', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-family:'JetBrains Mono',monospace">
      <div>
        <div style="color:var(--dim);font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:6px">🛡️ ${en ? 'Buy wall' : 'Плита покупки'}</div>
        <div style="color:var(--mint);font-size:16px;font-weight:800">${fmtP(w.bestBidWall.price)}</div>
        <div style="font-size:10.5px;color:var(--mut);margin-top:4px">${en ? 'Volume' : 'Объём'}: ${Math.round(w.bestBidWall.total).toLocaleString()} USDT${srcInfo}</div>
      </div>
      <div>
        <div style="color:var(--dim);font-size:9.5px;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:6px">🧱 ${en ? 'Sell wall' : 'Плита продажи'}</div>
        <div style="color:var(--coral);font-size:16px;font-weight:800">${fmtP(w.bestAskWall.price)}</div>
        <div style="font-size:10.5px;color:var(--mut);margin-top:4px">${en ? 'Volume' : 'Объём'}: ${Math.round(w.bestAskWall.total).toLocaleString()} USDT${srcInfo}</div>
      </div>
    </div>`);
}
// ─── Экспорт в window для диагностики ───
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    calculateVolumeAnomalies,
    mergeWhaleMetrics,
    renderWhaleData,
    fetchExtras,
  });
}