// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SCREENS
// Порт из js/ui.js — вкладки, язык, BTC, sheet
// ═══════════════════════════════════════════════════════════════

import { state, setText, setHTML, toast } from '../utils';
import { tm, isEN, setLang as i18nSetLang, getLang } from '../i18n';
import { getBtcDailyAnalysis } from '../market';
import { renderPro } from './oracle';
import { renderFavorites } from './scanner';
import { mobileSyncPortfolio } from '../trading';
import { renderOracleDashboard } from './oracle';
import { cancelDemoOrder, resetDemo } from '../demo';

// ═══ ВКЛАДКИ ═══

export function switchTab(tab: string): void {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('screen-' + tab);
  if (sc) sc.classList.add('active');

  document.querySelectorAll<HTMLElement>('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  if (tab === 'scanner' && !state.scannerRunning) {
    (window as any).runScanner?.();
  }
  if (tab === 'fav') renderFavorites();
  if (tab === 'portfolio') mobileSyncPortfolio(true);
  if (tab === 'oracle') renderOracleDashboard();

  if (state.chart && tab === 'home') {
    setTimeout(() => {
      const c = document.getElementById('chart-container');
      if (c && c.clientWidth) {
        state.chart.resize(c.clientWidth, c.clientHeight || 240);
      }
    }, 80);
  }
}

// ═══ ЯЗЫК ═══

export function setLanguage(lang: 'ru' | 'en'): void {
  i18nSetLang(lang);
  document.documentElement.lang = lang;

  document.getElementById('lang-ru')?.classList.toggle('active', lang === 'ru');
  document.getElementById('lang-en')?.classList.toggle('active', lang === 'en');

  applyStaticTranslations();

  if (state.lastAdv) renderPro(state.lastAdv);
  if (state.currentTicker) {
    (window as any).mobileAnalyze?.();
  }
  if (document.getElementById('screen-fav')?.classList.contains('active')) {
    renderFavorites();
  }
  if (document.getElementById('screen-oracle')?.classList.contains('active')) {
    renderOracleDashboard();
  }

  toast(lang === 'en' ? 'Language: English' : 'Язык: Русский', 'success', 1500);
}

export function applyStaticTranslations(): void {
  const map: Record<string, string> = {
    'nav-home': 'dashboard', 'nav-pro': 'analytics', 'nav-scanner': 'scanner',
    'nav-fav': 'favorites', 'nav-oracle': 'oracle', 'nav-portfolio': 'portfolio',
    'lbl-rebound': 'rebound', 'lbl-drop': 'drop', 'lbl-trend': 'trend',
    'lbl-plan': 'plan', 'lbl-agent': 'agent', 'lbl-xray': 'xray', 'lbl-walls': 'walls',
    'lbl-whale': 'whale', 'lbl-monitor': 'monitor', 'lbl-scan-acc': 'acc',
    'lbl-fav': 'fav_title', 'lbl-port-total': 'port_total', 'lbl-port-pnl': 'port_pnl',
    'lbl-assets': 'assets', 'lbl-port-sync': 'sync', 'lbl-oracle-name': 'oracle_name',
    'lbl-oracle-status': 'oracle_status', 'lbl-oracle-profile': 'oracle_profile',
    'lbl-oracle-stats': 'oracle_stats', 'lbl-oracle-recent': 'oracle_recent',
    'lbl-oracle-analyze': 'oracle_analyze', 'lbl-oracle-edit': 'oracle_edit',
    'lbl-oracle-refresh': 'oracle_refresh', 'lbl-oracle-edit-hint': 'oracle_edit_hint',
    'lbl-oracle-refresh-hint': 'oracle_refresh_hint', 'lbl-free-usdt': 'free_usdt',
    'lbl-assets-count': 'assets_count', 'lbl-in-portfolio': 'in_portfolio',
    'terms-title': 'terms_title', 'about-title': 'about_title',
    'lbl-ai-mode-insight': 'ai_mode_insight', 'lbl-ai-mode-agent': 'ai_mode_agent',
    'lbl-ai-deposit': 'ai_deposit', 'lbl-ai-run': 'ai_run',
  };

  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = tm(map[id]);
  });

  const inp = document.getElementById('ticker') as HTMLInputElement | null;
  if (inp) inp.placeholder = isEN() ? 'Ticker' : 'Тикер';

  const aiInp = document.getElementById('ai-cmd-input') as HTMLTextAreaElement | null;
  if (aiInp) {
    aiInp.placeholder = isEN()
      ? 'Buy DASH for 10% of deposit / Grid on BTC 60000-65000, 5 steps'
      : 'Купи DASH на 10% депо / Поставь сетку на BTC 60000-65000 на 5 шагов';
  }

  const hint = document.getElementById('oracle-ticker-hint');
  if (hint) hint.textContent = state.currentTicker;

  const stopBtn = document.querySelector('#monitor-panel button') as HTMLElement | null;
  if (stopBtn) stopBtn.textContent = tm('stop');
}

// ═══ BTC ═══

export async function loadBTC(): Promise<void> {
  try {
    const d = await getBtcDailyAnalysis();
    if (d.status !== 'success') return;

    setText('btc-price', '$' + d.price.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }));

    const ch = document.getElementById('btc-change');
    if (ch) {
      ch.textContent = (d.change_24h >= 0 ? '+' : '') + d.change_24h.toFixed(2) + '%';
      ch.style.color = d.change_24h >= 0 ? 'var(--mint)' : 'var(--coral)';
    }

    const r = document.getElementById('btc-rsi');
    if (r) {
      r.textContent = d.rsi.toFixed(1);
      r.style.color = d.rsi < 35 ? 'var(--mint)' : d.rsi > 65 ? 'var(--coral)' : 'var(--hi)';
    }

    setText('btc-rebound', '+' + d.rebound_pct.toFixed(1) + '%');
    setText('btc-drop', '-' + d.drop_pct.toFixed(1) + '%');

    const tr = document.getElementById('btc-trend');
    if (tr) {
      tr.textContent = d.trend === 'up' ? '📈' : '📉';
      tr.style.color = d.trend === 'up' ? 'var(--mint)' : 'var(--coral)';
    }

    setText('btc-advice', d.advice);
  } catch { /* silent */ }
}

// ═══ SHEET ═══

export function openSheet(title: string, bodyHtml: string): void {
  setText('sheet-title', title);
  setHTML('sheet-body', bodyHtml);
  document.getElementById('sheet-overlay')?.classList.add('open');
  document.getElementById('sheet')?.classList.add('open');
}

export function closeSheet(): void {
  document.getElementById('sheet-overlay')?.classList.remove('open');
  document.getElementById('sheet')?.classList.remove('open');
}

// ═══ DEMO MODE ═══

export function enterDemoMode() {
  state.isDemoMode = true;
  document.body.classList.add('in-demo-mode');
  switchTab('home');

  const demoInp = document.getElementById('demo-ticker') as HTMLInputElement | null;
  if (demoInp) {
    demoInp.value = state.currentTicker || 'DASH';
  }

  initDemoAutocomplete();

  import('../demo').then(m => {
    m.startDemoEngine();
  });
}

export function exitDemoMode() {
  state.isDemoMode = false;
  document.body.classList.remove('in-demo-mode');

  const mainInp = document.getElementById('ticker') as HTMLInputElement | null;
  if (mainInp) mainInp.value = state.currentTicker;

  import('../demo').then(m => m.stopDemoEngine());

  switchTab('home');
  toast('Вы вышли из демо-режима', 'info');
}

// Автокомплит для демо-поиска (защищён от дублей)
let _demoAutoInit = false;

function initDemoAutocomplete() {
  if (_demoAutoInit) return;

  const input = document.getElementById('demo-ticker') as HTMLInputElement | null;
  const box = document.getElementById('demo-ticker-suggest');
  if (!input || !box) return;

  let debounceT: any;
  input.addEventListener('input', () => {
    if (debounceT) clearTimeout(debounceT);
    debounceT = setTimeout(showSuggest, 150);
  });

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target as Node) && e.target !== input) {
      box.classList.remove('open');
    }
  });

  function showSuggest() {
    const q = (input!.value || '').toUpperCase().trim();
    let items = state.allPairs;
    if (q) items = items.filter(p => p.symbol.startsWith(q));

    if (!items.length && q) {
      box!.classList.remove('open');
      return;
    }

    box!.innerHTML = items.slice(0, 30).map(p => `
      <div class="suggest-item" onclick="document.getElementById('demo-ticker').value='${p.symbol}';document.getElementById('demo-ticker-suggest').classList.remove('open');mobileAnalyze();">
        <span class="si-symbol">${p.symbol}</span>
        <span class="si-vol">$${(p.vol / 1e6).toFixed(1)}M</span>
      </div>`).join('');
    box!.classList.add('open');
  }

  _demoAutoInit = true;
}

// ═══ Быстрый выбор % от баланса ═══

export function setDemoAmount(pct: number): void {
  const inp = document.getElementById('demo-entry-amount') as HTMLInputElement | null;
  if (!inp) return;
  const amount = Math.floor(state.demoBalance * (pct / 100));
  inp.value = String(amount > 0 ? amount : 0);
  inp.focus();
  inp.select();
}

// ═══ РЕНДЕР ПЛАНА ОРАКУЛА (в демо) ═══

export function renderDemoPlan() {
  const box = document.getElementById('demo-oracle-content');
  if (!box) return;

  const prevAmount = (document.getElementById('demo-entry-amount') as HTMLInputElement | null)?.value || '';

  if (!state.lastMarketData || !state.lastMarketData.current_price) {
    box.innerHTML = `<div class="empty-msg">Введи монету и нажми GO, чтобы Оракул составил план</div>`;
    (window as any)._currentDemoPlan = null;
    return;
  }

  const price = state.lastMarketData.current_price;
  const min = state.lastMarketData.min_120;
  const max = state.lastMarketData.max_120;

  const tr = max - price;
  const plan = {
    entry: price, tp1: price + tr * 0.3, tp2: price + tr * 0.6, tp3: max * 0.98, stop: min * 0.92,
  };

  (window as any)._currentDemoPlan = plan;

  const is3Steps = document.getElementById('demo-strat-3')?.classList.contains('active') || false;
  const steps = is3Steps ? 3 : 2;

  let stratHtml = '<div class="demo-strategy-box">';
  stratHtml += `<div class="demo-strat-step"><span class="lbl">Вход (Market)</span> <span class="val">${price.toFixed(4)}</span></div>`;

  if (steps === 2) {
    stratHtml += `<div class="demo-strat-step"><span class="lbl">Шаг 1 (50%)</span> <span class="val tp">TP1: ${plan.tp1.toFixed(4)}</span></div>`;
    stratHtml += `<div class="demo-strat-step"><span class="lbl">Шаг 2 (50%)</span> <span class="val tp">TP2: ${plan.tp2.toFixed(4)}</span></div>`;
  } else {
    stratHtml += `<div class="demo-strat-step"><span class="lbl">Шаг 1 (34%)</span> <span class="val tp">TP1: ${plan.tp1.toFixed(4)}</span></div>`;
    stratHtml += `<div class="demo-strat-step"><span class="lbl">Шаг 2 (33%)</span> <span class="val tp">TP2: ${plan.tp2.toFixed(4)}</span></div>`;
    stratHtml += `<div class="demo-strat-step"><span class="lbl">Шаг 3 (33%)</span> <span class="val tp">TP3: ${plan.tp3.toFixed(4)}</span></div>`;
  }
  stratHtml += `<div class="demo-strat-step"><span class="lbl">Стоп-лосс</span> <span class="val" style="color:var(--coral)">${plan.stop.toFixed(4)}</span></div>`;
  stratHtml += `</div>`;

  const placeholder = `20% от баланса ($${Math.floor(state.demoBalance * 0.2)})`;

  box.innerHTML = `
    <div class="demo-strat-selector">
      <button class="demo-strat-btn ${!is3Steps ? 'active' : ''}" id="demo-strat-2"
        onclick="document.getElementById('demo-strat-3').classList.remove('active');document.getElementById('demo-strat-2').classList.add('active');renderDemoPlan();">2 шага</button>
      <button class="demo-strat-btn ${is3Steps ? 'active' : ''}" id="demo-strat-3"
        onclick="document.getElementById('demo-strat-2').classList.remove('active');document.getElementById('demo-strat-3').classList.add('active');renderDemoPlan();">3 шага</button>
    </div>

    ${stratHtml}

    <div class="demo-amount-block">
      <div class="demo-amount-lbl">Сумма входа (USDT)</div>
      <div class="demo-amount-row">
        <input type="number" id="demo-entry-amount" class="demo-amount-input"
               value="${prevAmount}" placeholder="${placeholder}"
               min="1" step="1" autocomplete="off">
        <button class="demo-amount-pct" onclick="setDemoAmount(10)">10%</button>
        <button class="demo-amount-pct" onclick="setDemoAmount(25)">25%</button>
        <button class="demo-amount-pct" onclick="setDemoAmount(50)">50%</button>
        <button class="demo-amount-pct" onclick="setDemoAmount(100)">MAX</button>
      </div>
    </div>

    <button class="btn-primary btn-mint" onclick="executeDemoTrade()" style="margin-top:12px;">
      🤖 Выполнить план Оракула
    </button>
  `;
}

// ═══ РАДАРНОЕ МЕНЮ (ПОЛУКРУГ + ЛАЗЕР) ═══

export function initRadarMenu() {
  const trigger = document.getElementById('radar-trigger');
  const overlay = document.getElementById('radar-overlay');
  const items = document.querySelectorAll<HTMLElement>('.radar-item');
  const laserLine = document.querySelector('.radar-laser-line line') as SVGLineElement;
  
  if (!trigger || !overlay || !laserLine) return;

  let isDragging = false;
  let currentActiveIndex = -1;
  let startX = 0;
  let startY = 0;

  // Нажали на кнопку
  trigger.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isDragging = true;
    overlay.classList.add('open');
    currentActiveIndex = -1;
    items.forEach(i => i.classList.remove('active'));

    // Точка старта лазера = центр кнопки-триггера
    const rect = trigger.getBoundingClientRect();
    startX = rect.left + rect.width / 2;
    startY = rect.top + rect.height / 2;

    laserLine.setAttribute('x1', startX.toString());
    laserLine.setAttribute('y1', startY.toString());
    laserLine.setAttribute('x2', startX.toString());
    laserLine.setAttribute('y2', startY.toString());
    laserLine.style.opacity = '1';

    if (navigator.vibrate) navigator.vibrate(20);
  });

  // Ведем пальцем
  document.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const x = e.clientX;
    const y = e.clientY;
    
    laserLine.setAttribute('x2', x.toString());
    laserLine.setAttribute('y2', y.toString());

    let closestIndex = -1;
    let minDistance = Infinity;

    items.forEach((item, index) => {
      const rect = item.getBoundingClientRect();
      const itemCenterX = rect.left + rect.width / 2;
      const itemCenterY = rect.top + rect.height / 2;
      
      const dist = Math.hypot(x - itemCenterX, y - itemCenterY);
      
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = index;
      }
    });

    // Магнитный эффект (если палец ближе 100px к иконке)
    if (minDistance < 100) {
      if (currentActiveIndex !== closestIndex) {
        currentActiveIndex = closestIndex;
        
        items.forEach((item, idx) => {
          item.classList.toggle('active', idx === closestIndex);
        });

        const rect = items[closestIndex].getBoundingClientRect();
        laserLine.setAttribute('x2', (rect.left + rect.width / 2).toString());
        laserLine.setAttribute('y2', (rect.top + rect.height / 2).toString());

        if (navigator.vibrate) navigator.vibrate(10);
      }
    } else {
      if (currentActiveIndex !== -1) {
        currentActiveIndex = -1;
        items.forEach(i => i.classList.remove('active'));
      }
    }
  });

  // Отпустили палец
  document.addEventListener('pointerup', () => {
    if (!isDragging) return;
    isDragging = false;
    laserLine.style.opacity = '0';

    if (currentActiveIndex !== -1) {
      const activeItem = items[currentActiveIndex];
      const action = activeItem.getAttribute('data-action');
      const value = activeItem.getAttribute('data-value');

      if (navigator.vibrate) navigator.vibrate([10, 30, 20]);

      setTimeout(() => {
        if (action === 'tab' && value) {
          switchTab(value);
        } else if (action === 'func' && value) {
          const fn = (window as any)[value];
          if (typeof fn === 'function') fn();
        }
      }, 50);
    }

    overlay.classList.remove('open');
    items.forEach(i => i.classList.remove('active'));
  });

  trigger.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
}

// ═══ Экспорт в window ═══

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    switchTab,
    setLanguage,
    applyStaticTranslations,
    loadBTC,
    openSheet,
    closeSheet,
    enterDemoMode,
    exitDemoMode,
    renderDemoPlan,
    setDemoAmount,
    cancelDemoOrder,
    resetDemo,
    initRadarMenu,
  });

  setTimeout(initRadarMenu, 500);
}