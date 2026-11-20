// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · INIT
// Точка входа UI
// ═══════════════════════════════════════════════════════════════

import { toast, isEN, state } from '../utils';
import { setLang, tm } from '../i18n';
import './white-paper';
import './hub';
import { checkLocalProStatus } from '../pro';
import { openExternalService } from '../platform/browser';

// ─── Реальные модули ───
import { applyStaticTranslations, loadActiveCoinCard } from './screens';
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

  // Проверка PRO статуса
  const proStatus: any = checkLocalProStatus();
  state.isPro = proStatus.active;
  if (state.isPro) {
    console.log('[init] PRO License Active ✓');
    
    // 1. Меняем текст на NEBULA PRO и включаем золотой цвет (ОТКЛЮЧЕНО ДЛЯ НОВОГО СКИНА)
    // const updateBrand = (textId: string, brandId: string) => {
    //   const textEl = document.getElementById(textId);
    //   const brandEl = document.getElementById(brandId);
    //   if (textEl) textEl.textContent = 'NEBULA PRO';
    //   if (brandEl) brandEl.classList.add('pro-active');
    // };
    // 
    // updateBrand('brand-text', 'main-brand');
    // updateBrand('brand-text-pc', 'main-brand-pc');

    // 2. Вывод срока действия подписки
    const expEl = document.getElementById('pro-expiry-text');
    if (expEl) {
      let expiresAt = proStatus.expiresAt || proStatus.expires_at || proStatus.expiry;

      // Если в статусе нет даты, пробуем достать из токена (если это JWT)
      if (!expiresAt) {
        try {
          const token = localStorage.getItem('nebulaProToken');
          if (token && token.includes('.')) {
            // Декодируем payload JWT
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);
            if (payload.exp) expiresAt = payload.exp * 1000; // JWT выдает время в секундах
            if (payload.expiresAt) expiresAt = payload.expiresAt;
          }
        } catch (e) { /* silent */ }
      }

      if (expiresAt) {
        const daysLeft = Math.ceil((expiresAt - Date.now()) / (1000 * 3600 * 24));
        if (daysLeft > 36500) {
           expEl.textContent = `(∞)`;
        } else if (daysLeft > 0) {
           expEl.textContent = `(${daysLeft} дн.)`;
        } else {
           expEl.textContent = `(истекла)`;
           expEl.style.color = 'var(--coral)';
        }
      } else {
        expEl.textContent = `(бессрочно)`;
      }
      expEl.style.display = 'inline';
    }
  }

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

// ─── 3. Периодическое обновление карточки активной монеты ───
  setInterval(() => { try { loadActiveCoinCard(); } catch { /* silent */ } }, 90000);

  // ─── 4. Основной анализ при старте (сам обновит и карточку монеты) ───
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
      if (activeId && activeId !== 'default') {
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

  // ─── 12b. Oracle overlay (кнопка 🔮 на графике) ───
  setTimeout(async () => {
    try {
      const m = await import('./chart-overlay');
      m.initOracleOverlay();
    } catch (e) {
      console.warn('[init] chart-overlay failed:', e);
    }
  }, 500);

  // ─── 13. Pull-to-refresh (свайп вниз для обновления экрана) ───
  setTimeout(async () => {
    try {
      const m = await import('./pull-refresh');
      m.initPullToRefresh();
    } catch (e) {
      console.warn('[init] pull-refresh failed:', e);
    }
  }, 400);

    // ─── 14. Alerts engine (price / whale / funding) ───
  setTimeout(async () => {
    try {
      const m = await import('../alerts');
      m.startAlertsLoop();
    } catch (e) {
      console.warn('[init] alerts failed:', e);
    }
  }, 1000);

    // ─── 14b. Инициализация базы данных Оракула (IndexedDB) ───
  setTimeout(async () => {
    try {
      const m = await import('../oracle');
      await m.initOracleDb();
      console.log('[init] Oracle DB ready');
    } catch (e) {
      console.warn('[init] Oracle DB failed:', e);
    }
  }, 500);

  // ─── 15. Risk Center — первый рендер (когда данные уже есть) ───
  setTimeout(async () => {
    try {
      const m = await import('./risk');
      m.renderRiskCenter();
    } catch (e) {
      console.warn('[init] risk failed:', e);
    }
  }, 3000);

  // ─── 16. Web3 / P2P Integration ───
  (window as any).openXgramSwap = () => {
    openExternalService('https://xgram.io/ru');
  };

  (window as any).openP2PMarket = () => {
    openExternalService('https://p2p.binance.com/ru');
  };

    (window as any).openMiningWhatToMine = () => {
    openExternalService('https://whattomine.com/');
  };

  (window as any).openExchangeMenu = () => {
    const html = `
      <div style="text-align:center; padding: 8px 0;">
        <div style="font-size:42px; margin-bottom:10px;">💱</div>
        <div style="font-family:'Space Grotesk'; font-size:16px; font-weight:700; color:var(--mint); margin-bottom:12px;">
          ${tm('exchange_menu_title')}
        </div>
        <div style="font-size:12px; color:var(--mut); line-height:1.55; margin-bottom:20px;">
          ${tm('exchange_menu_desc')}
        </div>

      <!-- Xgram -->
        <div style="text-align:left; background:var(--skin-bg, rgba(167,139,250,.08)); border:1px solid var(--skin-border, rgba(167,139,250,.3)); border-radius:12px; padding:14px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <div style="font-size:20px;">🔄</div>
            <div style="font-family:'Space Grotesk'; font-size:14px; font-weight:700; color:#a78bfa;">Xgram (Swap)</div>
          </div>
          <div style="font-size:11px; color:var(--mut); line-height:1.5; margin-bottom:10px;">
            ${tm('xgram_desc')}
          </div>
          <button class="btn-primary btn-mint" onclick="closeSheet();openXgramSwap()" style="margin-top:0;">${tm('xgram_btn')}</button>
        </div>

        <!-- Binance P2P -->
        <div style="text-align:left; background:var(--skin-bg, rgba(252,213,53,.08)); border:1px solid var(--skin-border, rgba(252,213,53,.3)); border-radius:12px; padding:14px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <div style="font-size:20px;">🤝</div>
            <div style="font-family:'Space Grotesk'; font-size:14px; font-weight:700; color:#fcd535;">Binance P2P</div>
          </div>
          <div style="font-size:11px; color:var(--mut); line-height:1.5; margin-bottom:10px;">
            ${tm('p2p_desc')}
          </div>
          <button class="btn-primary btn-mint" onclick="closeSheet();openP2PMarket()" style="margin-top:0;">${tm('p2p_btn')}</button>
        </div>

        <!-- Mining Calculator (WhatToMine) -->
        <div style="text-align:left; background:var(--skin-bg, rgba(69,224,168,.08)); border:1px solid var(--skin-border, rgba(69,224,168,.3)); border-radius:12px; padding:14px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
            <div style="font-size:20px;">⛏️</div>
            <div style="font-family:'Space Grotesk'; font-size:14px; font-weight:700; color:#45e0a8;">${tm('mining_calc_title')}</div>
          </div>
          <div style="font-size:11px; color:var(--mut); line-height:1.5; margin-bottom:10px;">
            ${tm('mining_desc')}
          </div>
          <button class="btn-primary btn-mint" onclick="closeSheet();openMiningWhatToMine()" style="margin-top:0;">${tm('mining_btn_open')}</button>
        </div>

        <button class="btn-primary" onclick="closeSheet()" style="margin-top:8px;">${tm('tools_close')}</button>
      </div>
    `;
    (window as any).openSheet?.(tm('exchange_menu_title'), html);
  };

initHotkeys();
  console.log('[init] NEBULA v2 готов ✓');
}

function initHotkeys(): void {
  document.addEventListener('keydown', (e) => {
    const tag = (e.target as HTMLElement)?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Esc — закрыть любую открытую шторку, модалку или подсказки поиска
    if (e.key === 'Escape') {
      (window as any).closeSheet?.();
      (window as any).closeBtcOutlook?.();
      (window as any).hideAbout?.();
      (window as any).closeDiagnostics?.();
      document.getElementById('ticker-suggest')?.classList.remove('open');
      document.getElementById('demo-ticker-suggest')?.classList.remove('open');
      return;
    }

    // Ctrl+K или / — фокус на поиск тикера
    if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (!isTyping && e.key === '/')) {
      e.preventDefault();
      const inp = document.getElementById(state.isDemoMode ? 'demo-ticker' : 'ticker') as HTMLInputElement | null;
      if (inp) {
        inp.focus();
        inp.select();
      }
      return;
    }

    // Цифры 1–6 (вне полей ввода) — быстрое переключение таймфреймов
    if (!isTyping && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const tfMap: Record<string, string> = {
        '1': '1m',
        '2': '15m',
        '3': '1h',
        '4': '1d',
        '5': '1w',
        '6': '1M',
      };
      const tf = tfMap[e.key];
      if (tf) {
        (window as any).setTimeframe?.(tf);
      }
    }
  });
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