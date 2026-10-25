// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · TIMEFRAMES + WEBSOCKET real-time
// WS primary, REST fallback
// ═══════════════════════════════════════════════════════════════

import { state } from '../utils';
import { fetchCandlesWithSource, TF_CONFIG } from '../sources/candles';
import type { Timeframe } from '../sources/candles';
import { updateCandles, updateLastCandle, drawNowLine } from '../chart';
import { PriceStream } from '../sources/stream';

const LS_KEY = 'nebulaTimeframe';
const ORDER: Timeframe[] = ['1m', '15m', '1h', '1d', '1w', '1M', 'max'];

const WS_FALLBACK_MS = 8_000;
const NOW_LINE_THROTTLE_MS = 3_000;

function refreshIntervalMs(tf: Timeframe): number {
  switch (tf) {
    case '1m': return 15_000;
    case '15m': return 30_000;
    case '1h': return 60_000;
    case '1d': return 300_000;
    case '1w': return 900_000;
    case '1M': return 1_800_000;
    case 'max': return 3_600_000;
    default: return 60_000;
  }
}

let _stream: PriceStream | null = null;
let _restTimer: ReturnType<typeof setInterval> | null = null;
let _wsFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let _lastNowLineUpdate = 0;

export function getCurrentTimeframe(): Timeframe {
  return (state as any).currentTimeframe || '1d';
}

export function setTimeframe(tf: Timeframe): void {
  if (!ORDER.includes(tf)) tf = '1d';
  (state as any).currentTimeframe = tf;
  try { localStorage.setItem(LS_KEY, tf); }
  catch { /* silent */ }

  document.querySelectorAll<HTMLElement>('[data-tf]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tf === tf);
  });

  (window as any).mobileAnalyze?.();
  reconnectStream();
}

async function refreshChartViaRest(): Promise<void> {
  const ticker = (state as any).currentTicker;
  if (!ticker) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  const tf = getCurrentTimeframe();
  try {
    const { data } = await fetchCandlesWithSource(ticker, tf, undefined, true);
    if (!data || data.length < 25) return;
    updateCandles(data as any);
  }
  catch { /* silent */ }
}

function startRestFallback(): void {
  stopRestFallback();
  const tf = getCurrentTimeframe();
  const ms = refreshIntervalMs(tf);
  _restTimer = setInterval(refreshChartViaRest, ms);
  console.log(`[tf] REST fallback ${tf} -> every ${Math.round(ms / 1000)}s`);
}

function stopRestFallback(): void {
  if (_restTimer) { clearInterval(_restTimer); _restTimer = null; }
}

function connectStream(): void {
  disconnectStream();

  const ticker = (state as any).currentTicker;
  const tf = getCurrentTimeframe();

  if (!ticker) return;
  if (tf === 'max') {
    startRestFallback();
    return;
  }

  _stream = new PriceStream({
    ticker,
    timeframe: tf,
    onCandle: (candle) => {
      updateLastCandle(candle);

      const now = Date.now();
      if (now - _lastNowLineUpdate > NOW_LINE_THROTTLE_MS) {
        _lastNowLineUpdate = now;
        drawNowLine(candle.close);
      }
    },
    onOpen: () => {
      stopRestFallback();
      if (_wsFallbackTimer) {
        clearTimeout(_wsFallbackTimer);
        _wsFallbackTimer = null;
      }
      console.log('[tf] WebSocket connected - real-time mode');
    },
    onClose: () => {
      if (!_restTimer) startRestFallback();
    },
    onError: (err) => {
      console.warn('[tf] stream error:', err);
    },
  });

  _wsFallbackTimer = setTimeout(() => {
    if (!_stream?.isOpen() && !_restTimer) {
      console.log('[tf] WS slow - starting REST fallback');
      startRestFallback();
    }
  }, WS_FALLBACK_MS);
}

function disconnectStream(): void {
  if (_wsFallbackTimer) {
    clearTimeout(_wsFallbackTimer);
    _wsFallbackTimer = null;
  }
  if (_stream) {
    try { _stream.destroy(); }
    catch { /* silent */ }
    _stream = null;
  }
}

function reconnectStream(): void {
  stopRestFallback();
  connectStream();
}

export function startAutoRefresh(): void {
  connectStream();
}

export function stopAutoRefresh(): void {
  disconnectStream();
  stopRestFallback();
}

// ─── UI bar ───

function injectStyles(): void {
  if (document.getElementById('tf-styles')) return;
  const style = document.createElement('style');
  style.id = 'tf-styles';
  style.textContent = `
    .tf-bar {
      display: flex; gap: 6px; padding: 6px 10px 8px 10px;
      overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
      background: linear-gradient(180deg, rgba(0,0,0,.15), transparent);
      border-bottom: 1px solid rgba(140,170,220,.08);
    }
    .tf-bar::-webkit-scrollbar { display: none; }
    .tf-btn {
      flex-shrink: 0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px; font-weight: 600; letter-spacing: .3px;
      padding: 6px 12px; border-radius: 8px;
      color: var(--mut);
      background: rgba(0,0,0,.4);
      border: 1px solid rgba(140,170,220,.12);
      cursor: pointer; transition: all .12s;
      user-select: none;
    }
    .tf-btn:hover { color: var(--hi); border-color: rgba(94,203,255,.3); }
    .tf-btn.active {
      color: #000;
      background: var(--cyan, #5ecbff);
      border-color: var(--cyan, #5ecbff);
      box-shadow: 0 0 12px rgba(94,203,255,.35);
    }
    .tf-btn:active { transform: scale(.95); }
  `;
  document.head.appendChild(style);
}

function buildBar(): void {
  const host = document.getElementById('tf-bar');
  if (!host) return;
  injectStyles();
  const current = getCurrentTimeframe();

  host.className = 'tf-bar';
  host.innerHTML = ORDER.map(tf =>
    `<button class="tf-btn${tf === current ? ' active' : ''}" data-tf="${tf}">${TF_CONFIG[tf].label}</button>`
  ).join('');

  host.querySelectorAll<HTMLElement>('[data-tf]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tf = btn.dataset.tf as Timeframe;
      if (tf && tf !== getCurrentTimeframe()) setTimeframe(tf);
    });
  });
}

export function initTimeframeBar(): void {
  buildBar();
  startAutoRefresh();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      reconnectStream();
      setTimeout(() => refreshChartViaRest(), 500);
    }
    else {
      stopAutoRefresh();
    }
  });

  window.addEventListener('beforeunload', stopAutoRefresh);

  console.log(`[tf] init: ${getCurrentTimeframe()} (real-time stream)`);
}

// Poll ticker changes to reconnect WS
let _lastTicker = (state as any).currentTicker;
setInterval(() => {
  const t = (state as any).currentTicker;
  if (t && t !== _lastTicker) {
    _lastTicker = t;
    reconnectStream();
  }
}, 1000);

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    setTimeframe,
    getCurrentTimeframe,
    startAutoRefresh,
    stopAutoRefresh,
    initTimeframeBar,
  });
}