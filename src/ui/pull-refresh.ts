// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · PULL TO REFRESH
// Свайп вниз от верха экрана → обновление данных текущего экрана
// ═══════════════════════════════════════════════════════════════

import { state } from '../utils';

const THRESHOLD = 70;      // пикселей до срабатывания (после сопротивления)
const MAX_PULL = 110;      // максимум визуального сдвига
const RESISTANCE = 0.55;   // чем меньше — тем "туже" тянется

let startX = 0;
let startY = 0;
let active = false;
let currentPull = 0;
let refreshing = false;
let refreshInFlight = false;
let indicator: HTMLElement | null = null;

// ─── Индикатор ───

function ensureIndicator(): HTMLElement {
  if (indicator) return indicator;

  indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = `
    <div class="ptr-spinner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v12"/>
        <path d="M7 8l5-5 5 5"/>
      </svg>
    </div>
  `;
  document.body.appendChild(indicator);

  if (!document.getElementById('ptr-styles')) {
    const style = document.createElement('style');
    style.id = 'ptr-styles';
    style.textContent = `
      .ptr-indicator {
        position: fixed;
        top: -60px;
        left: 50%;
        transform: translateX(-50%);
        width: 44px; height: 44px;
        border-radius: 50%;
        background: rgba(20, 30, 50, 0.92);
        border: 1px solid rgba(94, 203, 255, 0.35);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999;
        pointer-events: none;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        will-change: top, transform;
      }
      .ptr-indicator svg {
        width: 22px; height: 22px;
        color: var(--cyan, #5ecbff);
        transition: transform 0.15s ease-out;
      }
      .ptr-indicator.ready .ptr-spinner {
        animation: ptr-bounce 0.6s ease-in-out infinite;
      }
      .ptr-indicator.loading {
        top: 20px !important;
        transition: top 0.3s ease-out;
      }
      .ptr-indicator.loading svg {
        animation: ptr-spin 0.9s linear infinite;
      }
      @keyframes ptr-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes ptr-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(3px); }
      }
    `;
    document.head.appendChild(style);
  }

  return indicator;
}

// ─── Проверки ───

function getActiveScreen(): HTMLElement | null {
  return document.querySelector('.screen.active') as HTMLElement | null;
}

function isAtTop(screen: HTMLElement | null): boolean {
  if (!screen) return true;
  if (screen.scrollTop > 0) return false;

  const main = document.querySelector('.screens') as HTMLElement | null;
  if (main && main.scrollTop > 0) return false;

  if (window.scrollY > 0) return false;
  return true;
}

function shouldIgnore(target: HTMLElement | null): boolean {
  if (!target) return true;
  // Не мешаем графику — у lightweight-charts свой зум/пан
  if (target.closest('#chart-container')) return true;
  // Горизонтальный скролл таймфреймов
  if (target.closest('.tf-bar')) return true;
  // Поля ввода и элементы управления
  if (target.closest('input, textarea, select')) return true;
  if (target.closest('button[type="range"]')) return true;
  return false;
}

// ─── Touch handlers ───

function onTouchStart(e: TouchEvent): void {
  if (refreshing) return;
  if (e.touches.length !== 1) return;

  const t = e.touches[0];
  const target = e.target as HTMLElement;

  if (shouldIgnore(target)) return;
  if (!isAtTop(getActiveScreen())) return;

  startX = t.clientX;
  startY = t.clientY;
  active = true;
  currentPull = 0;
}

function onTouchMove(e: TouchEvent): void {
  if (!active || refreshing) return;
  if (e.touches.length !== 1) { active = false; return; }

  const t = e.touches[0];
  const dx = t.clientX - startX;
  const dy = t.clientY - startY;

  // Горизонтальный жест — отдаём другим обработчикам
  if (Math.abs(dx) > Math.abs(dy) * 1.2) {
    active = false;
    return;
  }

  // Свайп вверх — обычный скролл, не трогаем
  if (dy < 0) {
    active = false;
    return;
  }

  // Пользователь уже начал скроллить вниз? — не мешаем
  if (!isAtTop(getActiveScreen())) {
    active = false;
    return;
  }

  // Сопротивление
  const pulled = Math.min(dy * RESISTANCE, MAX_PULL);
  currentPull = pulled;

  if (pulled > 5) {
    // Начинаем "оттягивать" — блокируем нативный скролл
    e.preventDefault();

    const ind = ensureIndicator();
    ind.style.top = `${Math.max(-60 + pulled, -60)}px`;
    ind.classList.toggle('ready', pulled >= THRESHOLD);

    const svg = ind.querySelector('svg');
    if (svg) {
      if (pulled >= THRESHOLD) {
        (svg as SVGElement).style.transform = 'rotate(180deg)';
      } else {
        const angle = (pulled / THRESHOLD) * 180;
        (svg as SVGElement).style.transform = `rotate(${angle}deg)`;
      }
    }
  }
}

function onTouchEnd(): void {
  if (!active) return;

  const shouldRefresh = currentPull >= THRESHOLD;
  active = false;
  currentPull = 0;

  if (refreshing) return;

  const ind = ensureIndicator();

  if (shouldRefresh) {
    triggerRefresh();
  } else {
    ind.style.top = '-60px';
    ind.classList.remove('ready');
    const svg = ind.querySelector('svg');
    if (svg) (svg as SVGElement).style.transform = 'rotate(0deg)';
  }
}

// ─── Само обновление ───

async function triggerRefresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;

  const ind = ensureIndicator();
  ind.classList.remove('ready');
  ind.classList.add('loading');
  ind.style.top = '20px';

  const svg = ind.querySelector('svg');
  if (svg) (svg as SVGElement).style.transform = 'rotate(0deg)';

  // Тактильный отклик
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch { /* silent */ }
  }

  try {
    await refreshCurrentScreen();
  } catch (e) {
    console.warn('[ptr] refresh failed:', e);
  } finally {
    // Минимальная видимость спиннера, чтобы не мигал
    await new Promise(r => setTimeout(r, 400));

    ind.classList.remove('loading');
    ind.style.top = '-60px';
    refreshing = false;
  }
}

async function refreshCurrentScreen(): Promise<void> {
  if (refreshInFlight) return;
  refreshInFlight = true;

  try {
    const screen = getActiveScreen();
    if (!screen) return;
    const id = screen.id;

    switch (id) {
      case 'screen-home': {
        const vd = document.getElementById('verdict');
        const isAnalyzing = vd?.classList.contains('loading');

        const jobs: Promise<any>[] = [];

        // Переанализ — только если сейчас ничего не грузится
        if (!isAnalyzing && (window as any).mobileAnalyze) {
          jobs.push(Promise.resolve((window as any).mobileAnalyze()));
        }

        // BTC-карточка — всегда
        try {
          const screensMod = await import('./screens');
          if (screensMod.loadBTC) jobs.push(Promise.resolve(screensMod.loadBTC()));
        } catch { /* silent */ }

        await Promise.allSettled(jobs);
        break;
      }

      case 'screen-scanner': {
        if ((window as any).runScanner) {
          await (window as any).runScanner();
        }
        break;
      }

      case 'screen-fav': {
        try {
          const m = await import('./scanner');
          m.renderFavorites?.();
        } catch { /* silent */ }
        break;
      }

      case 'screen-oracle': {
        try {
          const m = await import('./oracle');
          const fn = (m as any).renderOracleDashboard;
          if (typeof fn === 'function') await fn();
        } catch { /* silent */ }
        break;
      }

      case 'screen-portfolio': {
        if ((window as any).mobileSyncPortfolio) {
          await (window as any).mobileSyncPortfolio(true);
        }
        break;
      }

      case 'screen-pro': {
        if ((window as any).mobileAnalyze) {
          await (window as any).mobileAnalyze();
        }
        break;
      }

      default:
        // Неизвестный экран — просто индикатор покрутится и уедет
        break;
    }
  } finally {
    refreshInFlight = false;
  }
}

// ─── Init ───

let attached = false;

export function initPullToRefresh(): void {
  if (attached) return;
  attached = true;

  // Только touch-устройства (Android / мобильный браузер)
  if (!('ontouchstart' in window)) {
    console.log('[ptr] skipped (no touch support)');
    return;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', () => {
    active = false;
    currentPull = 0;
    if (!refreshing && indicator) {
      indicator.style.top = '-60px';
      indicator.classList.remove('ready');
    }
  }, { passive: true });

  console.log('[ptr] pull-to-refresh initialized');
}

if (typeof window !== 'undefined') {
  (window as any).initPullToRefresh = initPullToRefresh;
  (window as any).triggerPullRefresh = triggerRefresh;
}