// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · ORACLE OVERLAY (Level 2)
// Кнопка 🔮 на графике — показывает, ЧТО увидел Oracle:
//   🐋  аномальный объём (киты)
//   ●   пересечения MACD (зелёный = бычий, красный = медвежий)
//   ○   касания Bollinger Bands (синий = низ, фиолетовый = верх)
//   ■   экстремальный funding на последней свече
// ═══════════════════════════════════════════════════════════════

import { state } from '../utils';
import { tm } from '../i18n';
import type { Candle } from '../sources/candles';

export interface OverlayData {
  candles: Candle[];
  fundingRate: number;
  price: number;
  ticker?: string;
}

interface Marker {
  time: number;
  position: 'aboveBar' | 'belowBar' | 'inBar';
  color: string;
  shape: 'circle' | 'square' | 'arrowUp' | 'arrowDown';
  text?: string;
  size?: number;
}

let _enabled = false;
let _lastData: OverlayData | null = null;
let _button: HTMLButtonElement | null = null;
let _helpBtn: HTMLButtonElement | null = null;
let _legendEl: HTMLElement | null = null;
let _lastKnownFunding = 0;
let _lastTicker = '';

// ─── PUBLIC API ───

export function isOverlayEnabled(): boolean {
  return _enabled;
}

export function initOracleOverlay(): void {
  injectButton();
  console.log('[overlay] ready');
}

export function toggleOracleOverlay(): void {
  _enabled = !_enabled;
  updateButtonUI();
  if (_enabled) {
    showLegend();
    applyMarkers();
  } else {
    hideLegend();
    clearMarkers();
  }
}

export function updateOverlayFromAnalysis(data: OverlayData): void {
  if (data.ticker && data.ticker !== _lastTicker) {
    _lastTicker = data.ticker;
    _lastKnownFunding = 0; // Сбрасываем фандинг при смене тикера
  }
  _lastData = data;
  
  // Если ордербук уже успел вернуть фандинг раньше свечей — применяем его
  if (_lastData.fundingRate === 0 && _lastKnownFunding !== 0) {
    _lastData.fundingRate = _lastKnownFunding;
  }
  if (_enabled) applyMarkers();
}

export function updateFundingRate(rate: number, ticker?: string): void {
  if (ticker && ticker !== _lastTicker) return; // Игнорируем устаревшие данные
  _lastKnownFunding = rate;
  if (_lastData) {
    _lastData.fundingRate = rate;
    if (_enabled) applyMarkers();
  }
}

// ─── UI ───

function injectButton(): void {
  if (_button) return;
  const host = document.getElementById('chart-container');
  if (!host) return;

  if (getComputedStyle(host).position === 'static') {
    host.style.position = 'relative';
  }

  // Создаем контейнер для двух кнопок, чтобы они стояли ровно в ряд
  const btnWrap = document.createElement('div');
  btnWrap.style.cssText = `
    position: absolute; top: 8px; right: 75px; z-index: 10;
    display: flex; gap: 4px; align-items: center;
  `;

  _button = document.createElement('button');
  _button.id = 'oracle-overlay-btn';
  _button.innerHTML = tm('overlay_btn_off');
  _button.style.cssText = `
    height: 26px; padding: 0 10px; border-radius: 13px;
    background: rgba(0,0,0,.85); border: 1px solid rgba(140,170,220,.25);
    color: #6b7a94; font-size: 11px; font-family: 'JetBrains Mono', monospace;
    font-weight: 600; letter-spacing: 0.3px;
    cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center; gap: 4px;
    white-space: nowrap;
  `;
  _button.addEventListener('click', toggleOracleOverlay);

  _helpBtn = document.createElement('button');
  _helpBtn.id = 'oracle-help-btn';
  _helpBtn.innerHTML = 'ℹ️';
  _helpBtn.title = tm('overlay_btn_hint_off');
  _helpBtn.style.cssText = `
    height: 26px; width: 26px; padding: 0; border-radius: 50%;
    background: rgba(0,0,0,.85); border: 1px solid rgba(140,170,220,.25);
    color: #6b7a94; font-size: 12px;
    cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center;
  `;
  _helpBtn.addEventListener('click', showOverlayHelp);

  btnWrap.appendChild(_button);
  btnWrap.appendChild(_helpBtn);
  host.appendChild(btnWrap);
}

function updateButtonUI(): void {
  if (!_button) return;
  if (_enabled) {
    _button.innerHTML = tm('overlay_btn_on');
    _button.style.background = 'rgba(94,203,255,.2)';
    _button.style.borderColor = 'rgba(94,203,255,.75)';
    _button.style.color = '#5ecbff';
    _button.style.boxShadow = '0 0 12px rgba(94,203,255,.4)';
    _button.title = tm('overlay_btn_hint_on');
  } else {
    _button.innerHTML = tm('overlay_btn_off');
    _button.style.background = 'rgba(0,0,0,.85)';
    _button.style.borderColor = 'rgba(140,170,220,.25)';
    _button.style.color = '#6b7a94';
    _button.style.boxShadow = 'none';
    _button.title = tm('overlay_btn_hint_off');
  }
}

function showLegend(): void {
  if (_legendEl) return;
  const host = document.getElementById('chart-container');
  if (!host) return;

  _legendEl = document.createElement('div');
  // Переносим легенду вниз влево, чтобы она не мешала верхней панели графика
  _legendEl.style.cssText = `
    position: absolute; bottom: 8px; left: 8px; z-index: 9;
    background: rgba(0,0,0,.85); border-radius: 6px;
    padding: 4px 8px; font-size: 9.5px;
    font-family: 'JetBrains Mono', monospace;
    color: #6b7a94; display: flex; gap: 6px; flex-wrap: wrap;
    max-width: calc(100% - 80px); pointer-events: none;
    border: 1px solid rgba(140,170,220,.15);
  `;
  _legendEl.innerHTML = `
    <span>🐋 ${tm('overlay_legend_whale')}</span>
    <span style="color:#45e0a8">● ${tm('overlay_legend_bull')}</span>
    <span style="color:#ff6584">● ${tm('overlay_legend_bear')}</span>
    <span style="color:#5ecbff">○ ${tm('overlay_legend_bb_low')}</span>
    <span style="color:#a78bfa">○ ${tm('overlay_legend_bb_high')}</span>
  `;
  host.appendChild(_legendEl);
}

function hideLegend(): void {
  if (_legendEl) {
    _legendEl.remove();
    _legendEl = null;
  }
}

// ─── MARKERS ───

function clearMarkers(): void {
  if (!state.candleSeries) return;
  try { (state.candleSeries as any).setMarkers?.([]); }
  catch { /* silent */ }
}

function applyMarkers(): void {
  if (!_lastData || !state.candleSeries) return;
  const { candles, fundingRate } = _lastData;
  if (!candles || candles.length < 30) return;

  const markers: Marker[] = [];
  markers.push(...computeWhaleVolume(candles));
  markers.push(...computeMacdMarkers(candles));
  markers.push(...computeBBMarkers(candles));

  if (Math.abs(fundingRate) >= 0.05) {
    const last = candles[candles.length - 1];
    markers.push({
      time: last.time as any,
      position: fundingRate > 0 ? 'aboveBar' : 'belowBar',
      color: '#ffb858',
      shape: 'square',
      text: `⚠️ ${fundingRate > 0 ? '+' : ''}${fundingRate.toFixed(3)}%`,
      size: 1,
    });
  }

  markers.sort((a, b) => a.time - b.time);

  try {
    (state.candleSeries as any).setMarkers?.(markers);
    console.log(`[overlay] ${markers.length} markers applied`);
  } catch (e) {
    console.warn('[overlay] setMarkers failed:', e);
  }
}

// ─── COMPUTATIONS ───

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function emaSeries(arr: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = arr[0] ?? 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function computeWhaleVolume(candles: Candle[]): Marker[] {
  const lookback = 30;
  const out: Marker[] = [];
  for (let i = lookback; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - lookback; j < i; j++) sum += candles[j].volume;
    const a = sum / lookback;
    if (a > 0 && candles[i].volume > a * 2) {
      out.push({
        time: candles[i].time as any,
        position: 'belowBar',
        color: '#5ecbff',
        shape: 'arrowUp',
        text: '🐋',
        size: 1.2,
      });
    }
  }
  return out.slice(-5);
}

function computeMacdMarkers(candles: Candle[]): Marker[] {
  if (candles.length < 35) return [];
  const closes = candles.map(c => c.close);
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = emaSeries(macd, 9);

  const bullish: Marker[] = [];
  const bearish: Marker[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prevDiff = macd[i - 1] - signal[i - 1];
    const curDiff = macd[i] - signal[i];
    if (prevDiff < 0 && curDiff >= 0) {
      bullish.push({
        time: candles[i].time as any,
        position: 'belowBar',
        color: '#45e0a8',
        shape: 'circle',
        size: 0.8,
      });
    } else if (prevDiff > 0 && curDiff <= 0) {
      bearish.push({
        time: candles[i].time as any,
        position: 'aboveBar',
        color: '#ff6584',
        shape: 'circle',
        size: 0.8,
      });
    }
  }

  return [...bullish.slice(-3), ...bearish.slice(-3)];
}

function computeBBMarkers(candles: Candle[]): Marker[] {
  if (candles.length < 25) return [];
  const period = 20;
  const mult = 2;
  const oversold: Marker[] = [];
  const overbought: Marker[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    const mean = sum / period;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (candles[j].close - mean) ** 2;
    variance /= period;
    const std = Math.sqrt(variance);
    const upper = mean + mult * std;
    const lower = mean - mult * std;

    const c = candles[i];
    if (c.low <= lower) {
      oversold.push({
        time: c.time as any,
        position: 'belowBar',
        color: '#5ecbff',
        shape: 'circle',
        size: 0.5,
      });
    } else if (c.high >= upper) {
      overbought.push({
        time: c.time as any,
        position: 'aboveBar',
        color: '#a78bfa',
        shape: 'circle',
        size: 0.5,
      });
    }
  }

  return [...oversold.slice(-2), ...overbought.slice(-2)];
}

// ─── WINDOW EXPORTS ───

// ─── HELP MODAL ───

function showOverlayHelp(): void {
  const openSheet = (window as any).openSheet;

  const html = `
    <div style="font-size: 13.5px; color: var(--tx); line-height: 1.6;">
      <div style="margin-bottom: 16px; color: var(--dim);">
        ${tm('overlay_help_desc')}
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center;">🐋</div>
          <div>
            <div style="font-weight: 700; color: var(--cyan); margin-bottom: 2px;">${tm('overlay_help_whale')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('overlay_help_whale_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center; color: #45e0a8;">●</div>
          <div>
            <div style="font-weight: 700; color: #45e0a8; margin-bottom: 2px;">${tm('overlay_help_macd_up')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('overlay_help_macd_up_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center; color: #ff6584;">●</div>
          <div>
            <div style="font-weight: 700; color: #ff6584; margin-bottom: 2px;">${tm('overlay_help_macd_down')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('overlay_help_macd_down_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center; color: #5ecbff;">○</div>
          <div>
            <div style="font-weight: 700; color: #5ecbff; margin-bottom: 2px;">${tm('overlay_help_bb_low')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('overlay_help_bb_low_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center; color: #a78bfa;">○</div>
          <div>
            <div style="font-weight: 700; color: #a78bfa; margin-bottom: 2px;">${tm('overlay_help_bb_high')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('overlay_help_bb_high_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center; color: #ffb858;">■</div>
          <div>
            <div style="font-weight: 700; color: #ffb858; margin-bottom: 2px;">${tm('overlay_help_funding')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('overlay_help_funding_desc')}</div>
          </div>
        </div>
      </div>

      <button class="btn-primary btn-mint" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="margin-top: 20px;">
        ${tm('overlay_help_close')}
      </button>
    </div>
  `;

  if (openSheet) {
    openSheet(tm('overlay_help_title'), html);
  } else {
    alert('Error: openSheet not found');
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    initOracleOverlay,
    toggleOracleOverlay,
    isOverlayEnabled,
    updateOverlayFromAnalysis,
    updateFundingRate,
    showOverlayHelp, // <-- добавили сюда
  });
}