// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · INIT
// Точка входа UI. Заменяет js/main.js
// ═══════════════════════════════════════════════════════════════

import { toast, isEN } from '../utils';
import { setLang } from '../i18n';

// ─── Реальные модули ───
import { applyStaticTranslations, loadBTC } from './screens';
import { initAutocomplete, renderFavorites, updateStarButton } from './scanner';
import { checkMasterPassword } from '../trading';
import { runFullDiagnostics } from './diagnostics';

// ═══════════════════════════════════════════════════════════════
// ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════

export function initApp(): void {
  console.log('[init] NEBULA v2 стартует...');

  // ─── 1. Язык ───
  const lang = (localStorage.getItem('nebulaLang') as 'ru' | 'en') || 'ru';
  setLang(lang);
  document.documentElement.lang = lang;
  updateLangButtons();
  applyStaticTranslations();

  // ─── 2. Автодополнение тикера ───
  try { initAutocomplete(); } catch (e) { console.warn('initAutocomplete:', e); }

  // ─── 3. BTC-карточка + периодическое обновление ───
  setInterval(() => { try { loadBTC(); } catch { /* silent */ } }, 90000);
  // Первичная загрузка BTC после первого рендера, чтобы не блокировать старт
  setTimeout(() => { try { loadBTC(); } catch { /* silent */ } }, 100);

  // ─── 4. Основной анализ при старте ───
  setTimeout(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { (window as any).mobileAnalyze?.(); } catch (e) { console.warn('mobileAnalyze:', e); }
  }, 100);

  // ─── 5. Dash Network — ленивая загрузка через 8 секунд ───
  setTimeout(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const st = (window as any).state;
    if (st?.currentTicker?.toUpperCase() === 'DASH') {
      try {
        const m = await import('./dash');
        m.renderDashNetwork();
      } catch { /* silent */ }
    }
  }, 8000);

  // ─── 6. Оптимизация: снять will-change ───
  setTimeout(() => {
    document.querySelectorAll<HTMLElement>('.screen:not(.active)').forEach(s => {
      s.style.willChange = 'auto';
    });
  }, 500);

  // ─── 7. Избранное и звезда ───
  try { renderFavorites(); } catch { /* silent */ }
  try { updateStarButton(); } catch { /* silent */ }

  // ─── 8. Enter в поле тикера ───
  const tickerEl = document.getElementById('ticker');
  if (tickerEl) {
    tickerEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).mobileAnalyze?.();
      }
    });
  }

  // ─── 9. Мастер-пароль — через 3.5 секунды после старта ───
  setTimeout(() => {
    try { checkMasterPassword(); } catch (e) { console.warn('[init] checkMasterPassword:', e); }
  }, 3500);

  // ─── 10. Восстановление мониторинга из localStorage ───
  setTimeout(() => {
    try {
      const saved = localStorage.getItem('nebulaMonitor');
      if (!saved) return;
      const data = JSON.parse(saved);
      if (data.symbol && Array.isArray(data.plan) && data.plan.length) {
        if (Date.now() - (data.started || 0) > 14 * 86400 * 1000) {
          localStorage.removeItem('nebulaMonitor');
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const st = (window as any).state;
        if (st) {
          st.trackingSymbol = data.symbol;
          st.currentPlan = data.plan;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).startMonitoring?.(true);
      }
    } catch { /* silent */ }
  }, 2500);

  // ─── 11. Автодиагностика — раз в сутки ───
  setTimeout(async () => {
    try {
      const lastRun = parseInt(localStorage.getItem('nebulaDiagnosticsLastRun') || '0', 10);
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      if (now - lastRun > day) {
        localStorage.setItem('nebulaDiagnosticsLastRun', String(now));
        const report = await runFullDiagnostics({ silent: true });
        if (report.overall === 'error') {
          toast(
            `Диагностика: ${report.summary.failed} ошибок. Открой отчёт иконкой 🩺 в топбаре.`,
            'error',
            6000
          );
        } else if (report.overall === 'warn') {
          console.info('🔍 Diagnostics warnings:', report.summary.warned);
        } else {
          console.info('✅ Diagnostics: всё работает');
        }
      }
    } catch (e) {
      console.warn('auto-diagnostics failed', e);
    }
  }, 8000);

  console.log('[init] NEBULA v2 готов ✓');
    // ─── Загрузка и применение темы ───
  setTimeout(async () => {
    try {
      const themesMod = await import('../themes');
      await themesMod.loadThemes();
      const activeId = themesMod.getActiveThemeId();
      if (activeId && activeId !== 'default') {
        themesMod.applyTheme(activeId);
      }
    } catch (e) {
      console.warn('[init] themes failed:', e);
    }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════════

function updateLangButtons(): void {
  const ru = document.getElementById('lang-ru');
  const en = document.getElementById('lang-en');
  const isRu = !isEN();
  ru?.classList.toggle('active', isRu);
  en?.classList.toggle('active', !isRu);
}