// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · INIT
// Точка входа UI
// ═══════════════════════════════════════════════════════════════

import { toast, isEN, state } from '../utils';
import { setLang } from '../i18n';

// ─── Реальные модули ───
import { applyStaticTranslations, loadBTC } from './screens';
import { initAutocomplete, renderFavorites, updateStarButton } from './scanner';
import { runFullDiagnostics } from './diagnostics';

// ─── Список валидных таймфреймов (дублируем из candles.ts) ───
const VALID_TFS = ['1m', '15m', '1h', '1d', '1w', '1M', 'max'] as const;
type TF = typeof VALID_TFS[number];

// ═══════════════════════════════════════════════════════════════
// ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════

export function initApp(): void {
  console.log('[init] NEBULA v2 стартует...');

  // ─── 0. Восстанавливаем сохранённый таймфрейм ДО первого анализа ───
  //        (иначе первый mobileAnalyze стартует с дефолтным '1d',
  //        а initTimeframeBar через 300мс подсветит другую кнопку)
  try {
    const savedTf = localStorage.getItem('nebulaTimeframe') as TF | null;
    if (savedTf && (VALID_TFS as readonly string[]).includes(savedTf)) {
      (state as any).currentTimeframe = savedTf;
    } else {
      (state as any).currentTimeframe = '1d';
    }
  } catch {
    (state as any).currentTimeframe = '1d';
  }

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
        m.refreshDashSection?.();
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

  // ─── 9. Восстановление мониторинга из localStorage ───
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

  // ─── 10. Автодиагностика — раз в сутки ───
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
            `Диагностика: ${report.summary.failed} ошибок. Открой отчёт через ⚙️ → Диагностика.`,
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

  // ─── 11. Загрузка и применение темы ───
  setTimeout(async () => {
    try {
      const themesMod = await import('../themes');
      await themesMod.loadThemes();
      const activeId = themesMod.getActiveThemeId();
      if (activeId) {
        themesMod.applyTheme(activeId);
        console.log('[init] theme applied:', activeId);
      }
    } catch (e) {
      console.warn('[init] themes failed:', e);
    }
  }, 200);

  // ─── 12. Панель таймфреймов графика ───
  //        DOM #tf-bar уже есть (см. index.html),
  //        сохранённый tf уже применён в пункте 0 — здесь только рисуем UI.
  setTimeout(async () => {
    try {
      const m = await import('./timeframes');
      if (!document.getElementById('tf-bar')) {
        console.warn('[init] #tf-bar не найден в HTML — панель не будет построена');
        return;
      }
      m.initTimeframeBar();
    } catch (e) {
      console.warn('[init] timeframes failed:', e);
    }
  }, 300);

  // ─── 13. Pull-to-refresh (свайп вниз для обновления экрана) ───
  setTimeout(async () => {
    try {
      const m = await import('./pull-refresh');
      m.initPullToRefresh();
    } catch (e) {
      console.warn('[init] pull-refresh failed:', e);
    }
  }, 400);

  console.log('[init] NEBULA v2 готов ✓');
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