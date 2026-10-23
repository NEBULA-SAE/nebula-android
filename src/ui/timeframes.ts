// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · TIMEFRAMES
// Панель переключения таймфреймов + автообновление графика
// ═══════════════════════════════════════════════════════════════

import { state } from '../utils';
import { fetchCandlesWithSource, TF_CONFIG } from '../sources/candles';
import type { Timeframe } from '../sources/candles';
import { setCandlesAndFit, drawNowLine } from '../chart';

const LS_KEY = 'nebulaTimeframe';
const ORDER: Timeframe[] = ['1m', '15m', '1h', '1d', '1w', '1M', 'max'];

// ─── Автообновление: как часто дёргать сеть для текущего tf ───
// Короткие tf — чаще, длинные — реже, max — почти никогда.

function refreshIntervalMs(tf: Timeframe): number {
  switch (tf) {
    case '1m':  return 20_000;    // 20 сек
    case '15m': return 45_000;    // 45 сек
    case '1h':  return 120_000;   // 2 мин
    case '1d':  return 300_000;   // 5 мин
    case '1w':  return 900_000;   // 15 мин
    case '1M':  return 1_800_000; // 30 мин
    case 'max': return 3_600_000; // 1 час
    default:    return 60_000;
  }
}

// ─── Публичное API ───

export function getCurrentTimeframe(): Timeframe {
  return (state as any).currentTimeframe || '1d';
}

export function setTimeframe(tf: Timeframe): void {
  if (!ORDER.includes(tf)) tf = '1d';
  (state as any).currentTimeframe = tf;
  try { localStorage.setItem(LS_KEY, tf); } catch { /* silent */ }

  // Подсвечиваем активную кнопку
  document.querySelectorAll<HTMLElement>('[data-tf]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tf === tf);
  });

  // Перезапускаем анализ с новым tf
  (window as any).mobileAnalyze?.();

  // Перезапускаем автообновление
  startAutoRefresh();
}

// ─── Тихий refresh: только график, без Oracle/Pro/Whale ───

async function refreshChartSilently(): Promise<void> {
  const ticker = (state as any).currentTicker;
  if (!ticker) return;

  // Не обновляем, если вкладка в фоне — экономим батарею
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  const tf = getCurrentTimeframe();
  try {
    const { data } = await fetchCandlesWithSource(ticker, tf, undefined, true);
    if (!data || data.length < 25) return;
    const price = data[data.length - 1].close;
    setCandlesAndFit(data as any);
    drawNowLine(price);
  } catch { /* silent */ }
}

// ─── Таймер ───

let _timer: ReturnType<typeof setInterval> | null = null;

export function startAutoRefresh(): void {
  stopAutoRefresh();
  const tf = getCurrentTimeframe();
  const ms = refreshIntervalMs(tf);
  _timer = setInterval(refreshChartSilently, ms);
  console.log(`[tf] auto-refresh ${tf} → каждые ${Math.round(ms / 1000)}с`);
}

export function stopAutoRefresh(): void {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

// ─── UI ───

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

// ─── Инициализация ───

export function initTimeframeBar(): void {
  // Восстанавливаем сохранённый tf
  let saved: Timeframe = '1d';
  try {
    const ls = localStorage.getItem(LS_KEY) as Timeframe | null;
    if (ls && ORDER.includes(ls)) saved = ls;
  } catch { /* silent */ }
  (state as any).currentTimeframe = saved;

  buildBar();
  startAutoRefresh();

  // Останавливаем при скрытии вкладки, запускаем при появлении
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startAutoRefresh();
    else stopAutoRefresh();
  });

  // При закрытии приложения — гасим таймер
  window.addEventListener('beforeunload', stopAutoRefresh);

  console.log(`[tf] init: ${saved}`);
}

// Экспорт в window для inline-обработчиков
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    setTimeframe,
    getCurrentTimeframe,
    startAutoRefresh,
    stopAutoRefresh,
    initTimeframeBar,
  });
}