// Ре-экспорт языковых функций — чтобы старые импорты не сломались
import { isEN } from './i18n';

// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · UTILS + STATE
// Глобальное состояние + хелперы (fmt, toast, setText...)
// ═══════════════════════════════════════════════════════════════

// ─── ТИПЫ ───

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PlanStep {
  step: number;
  price: number;
  amount: number;
  percent?: number;
  profit_usdt?: number;
}

export interface ToastType {
  info?: string;
  success?: string;
  warn?: string;
  error?: string;
}

// ─── ГЛОБАЛЬНОЕ СОСТОЯНИЕ ───

export const state = {
  // График
  chart: null as any,
  candleSeries: null as any,
  priceLines: [] as any[],
  orderbookLines: [] as any[],

  // Текущий анализ
  lastAdv: null as any,
  currentTicker: 'DASH',

  // Сканер
  scannerRunning: false,
  scannerTimer: null as ReturnType<typeof setInterval> | null,

  // Мониторинг ордеров
  monitorInterval: null as ReturnType<typeof setInterval> | null,
  monitorWs: null as WebSocket | null,
  currentPlan: null as PlanStep[] | null,
  trackingSymbol: null as string | null,

  // Справочники монет
  allPairs: [] as any[],
  allPairsBySymbol: {} as Record<string, any>,

  // Избранное
  favoriteCoins: JSON.parse(localStorage.getItem('smartMoneyFavorites') || '[]') as string[],

  // Торговля
  currentExchange: 'mexc',

  // Квиз риск-профиля
  quizAnswers: {} as Record<string, string>,

  // Последние результаты (заменяют window._lastX)
  lastOracleResult: null as any,
  lastMarketData: null as any,
  lastWhaleData: null as any,

    // ─── DEMO MODE ───
  isDemoMode: false,
  demoBalance: 10000, // Стартовый баланс $10,000
  demoActiveOrders: [] as any[], // Открытые виртуальные сделки
  demoHistory: [] as any[], // Закрытые сделки (для статистики)
};

// ─── СОХРАНЕНИЕ ИЗБРАННОГО ───

export function saveFavorites(): void {
  try {
    localStorage.setItem('smartMoneyFavorites', JSON.stringify(state.favoriteCoins));
  } catch (e) {
    console.warn('[utils] saveFavorites:', e);
  }
}

// ─── ФОРМАТ ЧИСЕЛ ───

/** Форматирует число: < 1 → 5 знаков, иначе 2 знака */
export function fmt(n: number | string): string {
  const num = +n;
  return num < 1 ? num.toFixed(5) : num.toFixed(2);
}

/** Умное форматирование цены — адаптивная точность */
export function fmtP(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const a = Math.abs(v);
  if (a < 1) return v.toFixed(5);
  if (a < 100) return v.toFixed(4);
  return v.toFixed(2);
}

// ─── DOM-ХЕЛПЕРЫ ───

export function setText(id: string, txt: string | number): void {
  const el = document.getElementById(id);
  if (el) el.textContent = String(txt);
}

export function setHTML(id: string, html: string): void {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/** Экранирование HTML-символов для безопасной вставки в innerHTML */
export function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, c => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

// ─── ВРЕМЯ ───

/** Относительное время: "5 мин", "2 ч", "3 дн" */
export function relTime(ts: number): string {
  const s = Math.floor(Date.now() / 1000 - ts);
  const en = isEN();
  if (s < 60) return en ? 'just now' : 'только что';
  if (s < 3600) return Math.floor(s / 60) + (en ? 'm ago' : ' мин');
  if (s < 86400) return Math.floor(s / 3600) + (en ? 'h ago' : ' ч');
  return Math.floor(s / 86400) + (en ? 'd ago' : ' дн');
}

// ─── TOAST ───

export function toast(msg: string, type: 'info' | 'success' | 'warn' | 'error' = 'info', duration = 2800): void {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) {
    console.log(`[toast:${type}] ${msg}`);
    return;
  }
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 280);
  }, duration);
}

// ─── ЯЗЫК ───
// isEN, setLang, getLang, tm теперь живут в i18n.ts.
// Здесь только ре-экспорт для удобства (чтобы не менять импорты везде).
export { isEN, setLang, getLang, tm } from './i18n';
// ─── Экспорт в window для inline-обработчиков ───
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    state,
    fmt,
    fmtP,
    setText,
    setHTML,
    esc,
    relTime,
    toast,
    saveFavorites,
  });
}