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

// ═══ ВКЛАДКИ ═══

export function switchTab(tab: string): void {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('screen-' + tab);
  if (sc) sc.classList.add('active');

  document.querySelectorAll<HTMLElement>('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  if (tab === 'scanner' && !state.scannerRunning) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    'lbl-whale': 'whale',
    'lbl-monitor': 'monitor',
    'lbl-scan-acc': 'acc',
    'lbl-fav': 'fav_title',
    'lbl-port-total': 'port_total', 'lbl-port-pnl': 'port_pnl',
    'lbl-assets': 'assets',
    'lbl-port-sync': 'sync',
    'lbl-oracle-name': 'oracle_name',
    'lbl-oracle-status': 'oracle_status',
    'lbl-oracle-profile': 'oracle_profile',
    'lbl-oracle-stats': 'oracle_stats',
    'lbl-oracle-recent': 'oracle_recent',
    'lbl-oracle-analyze': 'oracle_analyze',
    'lbl-oracle-edit': 'oracle_edit',
    'lbl-oracle-refresh': 'oracle_refresh',
    'lbl-oracle-edit-hint': 'oracle_edit_hint',
    'lbl-oracle-refresh-hint': 'oracle_refresh_hint',
    'lbl-free-usdt': 'free_usdt',
    'lbl-assets-count': 'assets_count',
    'lbl-in-portfolio': 'in_portfolio',
    'terms-title': 'terms_title',
    'about-title': 'about_title',
    'lbl-ai-mode-insight': 'ai_mode_insight',
    'lbl-ai-mode-agent': 'ai_mode_agent',
    'lbl-ai-deposit': 'ai_deposit',
    'lbl-ai-run': 'ai_run',
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }));

    const ch = document.getElementById('btc-change');
    if (ch) {
      ch.textContent = (d.change_24h >= 0 ? '+' : '') + d.change_24h.toFixed(2) + '%';
      ch.style.color = d.change_24h >= 0 ? 'var(--mint)' : 'var(--coral)';
    }

    const r = document.getElementById('btc-rsi');
    if (r) {
      r.textContent = d.rsi.toFixed(1);
      r.style.color = d.rsi < 35 ? 'var(--mint)'
                     : d.rsi > 65 ? 'var(--coral)'
                     : 'var(--hi)';
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

// ═══ Экспорт в window ═══

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.assign(window as any, {
    switchTab,
    setLanguage,
    applyStaticTranslations,
    loadBTC,
    openSheet,
    closeSheet,
  });
}