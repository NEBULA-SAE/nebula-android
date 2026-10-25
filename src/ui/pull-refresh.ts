// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · PULL TO REFRESH v3
// Clean SVG ring, centered, no vibration
// ═══════════════════════════════════════════════════════════════

import { state } from '../utils';

const THRESHOLD = 70;
const MAX_PULL = 110;
const RESISTANCE = 0.55;
const HIDDEN_Y = -100;   // hidden above screen
const VISIBLE_Y = 20;    // fully visible (top offset)

let startX = 0;
let startY = 0;
let active = false;
let currentPull = 0;
let refreshing = false;
let refreshInFlight = false;
let indicator: HTMLElement | null = null;
let ringCircle: SVGCircleElement | null = null;
let textEl: HTMLElement | null = null;

const RING_RADIUS = 18;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ensureIndicator(): HTMLElement {
  if (indicator) return indicator;

  indicator = document.createElement('div');
  indicator.className = 'ptr-indicator';
  indicator.innerHTML = `
    <div class="ptr-ring-wrap">
      <svg class="ptr-ring" viewBox="0 0 48 48">
        <circle class="ptr-ring-bg" cx="24" cy="24" r="${RING_RADIUS}" />
        <circle class="ptr-ring-fg" cx="24" cy="24" r="${RING_RADIUS}"
                stroke-dasharray="${RING_CIRCUMFERENCE}"
                stroke-dashoffset="${RING_CIRCUMFERENCE}" />
      </svg>
      <svg class="ptr-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 4v12"/>
        <path d="M7 11l5 5 5-5"/>
      </svg>
    </div>
    <div class="ptr-text">Потяни вниз</div>
  `;
  document.body.appendChild(indicator);

  ringCircle = indicator.querySelector('.ptr-ring-fg') as SVGCircleElement;
  textEl = indicator.querySelector('.ptr-text') as HTMLElement;

  if (!document.getElementById('ptr-styles')) {
    const style = document.createElement('style');
    style.id = 'ptr-styles';
    style.textContent = `
      .ptr-indicator {
        position: fixed;
        top: 0;
        left: 50%;
        transform: translate(-50%, ${HIDDEN_Y}px);
        width: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        z-index: 9999;
        pointer-events: none;
        will-change: transform;
        opacity: 0;
        transition: opacity 0.12s ease-out;
      }
      .ptr-indicator.visible { opacity: 1; }
      .ptr-ring-wrap {
        position: relative;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(12, 20, 35, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
      }
      .ptr-ring {
        width: 48px;
        height: 48px;
        transform: rotate(-90deg);
      }
      .ptr-ring-bg {
        fill: none;
        stroke: rgba(140, 170, 220, 0.2);
        stroke-width: 3;
      }
      .ptr-ring-fg {
        fill: none;
        stroke: var(--cyan, #5ecbff);
        stroke-width: 3;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.08s linear, stroke 0.15s;
      }
      .ptr-arrow {
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) rotate(0deg);
        width: 20px; height: 20px;
        color: var(--cyan, #5ecbff);
        transition: transform 0.2s, opacity 0.2s, color 0.2s;
      }
      .ptr-indicator.ready .ptr-ring-fg { stroke: var(--mint, #45e0a8); }
      .ptr-indicator.ready .ptr-arrow {
        color: var(--mint, #45e0a8);
        transform: translate(-50%, -50%) rotate(180deg);
      }
      .ptr-indicator.loading .ptr-arrow { opacity: 0; }
      .ptr-indicator.loading .ptr-ring-fg {
        stroke: var(--cyan, #5ecbff);
        animation: ptr-rotate 1s linear infinite;
        transform-origin: 24px 24px;
      }
      .ptr-text {
        font-family: 'JetBrains Mono', monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.3px;
        color: var(--cyan, #5ecbff);
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
        white-space: nowrap;
        transition: color 0.15s;
        padding: 3px 8px;
        background: rgba(12, 20, 35, 0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border-radius: 10px;
      }
      .ptr-indicator.ready .ptr-text { color: var(--mint, #45e0a8); }
      @keyframes ptr-rotate {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  return indicator;
}

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
  if (target.closest('#chart-container')) return true;
  if (target.closest('.tf-bar')) return true;
  if (target.closest('input, textarea, select')) return true;
  if (target.closest('button[type="range"]')) return true;
  return false;
}

function updateVisual(pulled: number): void {
  if (!indicator || !ringCircle || !textEl) return;

  const progress = Math.min(1, pulled / THRESHOLD);

  // Position: HIDDEN_Y (-100) -> VISIBLE_Y (+20)
  // Fast appearance: reaches full position at 40% pull
  const eased = Math.min(1, progress * 2.5);
  const y = HIDDEN_Y + (VISIBLE_Y - HIDDEN_Y) * eased;
  indicator.style.transform = `translate(-50%, ${y}px)`;

  // Opacity: fast fade-in
  const opacity = Math.min(1, pulled / 20);
  indicator.classList.toggle('visible', opacity > 0.1);

  // Ring fill: linear with progress
  const offset = RING_CIRCUMFERENCE * (1 - progress);
  ringCircle.style.strokeDashoffset = String(offset);

  const ready = pulled >= THRESHOLD;
  indicator.classList.toggle('ready', ready);

  if (!refreshing) {
    textEl.textContent = ready ? 'Отпусти' : 'Потяни вниз';
  }
}

function resetVisual(): void {
  if (!indicator) return;
  indicator.classList.remove('ready', 'visible', 'loading');
  indicator.style.transform = `translate(-50%, ${HIDDEN_Y}px)`;
  if (ringCircle) {
    ringCircle.style.strokeDashoffset = String(RING_CIRCUMFERENCE);
    ringCircle.style.animation = '';
  }
  if (textEl) textEl.textContent = 'Потяни вниз';
  currentPull = 0;
}

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

  if (Math.abs(dx) > Math.abs(dy) * 1.2) { active = false; return; }
  if (dy < 0) { active = false; resetVisual(); return; }
  if (!isAtTop(getActiveScreen())) { active = false; resetVisual(); return; }

  const pulled = Math.min(dy * RESISTANCE, MAX_PULL);
  currentPull = pulled;

  if (pulled > 3) {
    e.preventDefault();
    ensureIndicator();
    updateVisual(pulled);
  }
}

function onTouchEnd(): void {
  if (!active) return;
  const shouldRefresh = currentPull >= THRESHOLD;
  active = false;

  if (refreshing) return;

  if (shouldRefresh) {
    triggerRefresh();
  }
  else {
    resetVisual();
  }
}

async function triggerRefresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;

  ensureIndicator();
  if (!indicator) return;

  indicator.classList.remove('ready');
  indicator.classList.add('loading', 'visible');
  indicator.style.transform = `translate(-50%, ${VISIBLE_Y}px)`;
  if (textEl) textEl.textContent = 'Обновление...';

  try {
    await refreshCurrentScreen();
  }
  catch (e) {
    console.warn('[ptr] refresh failed:', e);
  }
  finally {
    await new Promise(r => setTimeout(r, 400));
    indicator.classList.remove('loading');
    resetVisual();
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

        if (!isAnalyzing && (window as any).mobileAnalyze) {
          jobs.push(Promise.resolve((window as any).mobileAnalyze()));
        }
        try {
          const screensMod = await import('./screens');
          if (screensMod.loadBTC) jobs.push(Promise.resolve(screensMod.loadBTC()));
        }
        catch { /* silent */ }

        await Promise.allSettled(jobs);
        break;
      }
      case 'screen-scanner': {
        if ((window as any).runScanner) await (window as any).runScanner();
        break;
      }
      case 'screen-fav': {
        try {
          const m = await import('./scanner');
          m.renderFavorites?.();
        }
        catch { /* silent */ }
        break;
      }
      case 'screen-oracle': {
        try {
          const m = await import('./oracle');
          const fn = (m as any).renderOracleDashboard;
          if (typeof fn === 'function') await fn();
        }
        catch { /* silent */ }
        break;
      }
      case 'screen-portfolio': {
        if ((window as any).mobileSyncPortfolio) {
          await (window as any).mobileSyncPortfolio(true);
        }
        break;
      }
      case 'screen-pro': {
        if ((window as any).mobileAnalyze) await (window as any).mobileAnalyze();
        break;
      }
    }
  }
  finally {
    refreshInFlight = false;
  }
}

let attached = false;

export function initPullToRefresh(): void {
  if (attached) return;
  attached = true;

  if (!('ontouchstart' in window)) {
    console.log('[ptr] skipped (no touch support)');
    return;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', () => {
    active = false;
    if (!refreshing) resetVisual();
  }, { passive: true });

  console.log('[ptr] initialized (v3, centered, no vibration)');
}

if (typeof window !== 'undefined') {
  (window as any).initPullToRefresh = initPullToRefresh;
  (window as any).triggerPullRefresh = triggerRefresh;
}