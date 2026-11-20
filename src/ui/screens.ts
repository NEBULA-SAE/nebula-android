// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SCREENS
// ═══════════════════════════════════════════════════════════════

import { state, setText, setHTML, toast } from '../utils';
import { tm, isEN, setLang as i18nSetLang, getLang } from '../i18n';
import { getBtcDailyAnalysis } from '../market';
import { fetchCandlesWithSource } from '../sources/candles';
import { P } from '../config';
import { renderPro } from './oracle';
import { renderFavorites } from './scanner';
import { mobileSyncPortfolio } from '../trading';
import { renderOracleDashboard } from './oracle';
import { cancelDemoOrder, resetDemo } from '../demo';
import { openBtcOutlook, closeBtcOutlook, applyBtcGlow } from './btc-outlook';
import { calcRsiSimple, calcAtr, calcAdx } from '../indicators';

// ═══ ВКЛАДКИ ГЛАВНОГО ЭКРАНА (СВАЙП) ═══
export function switchHomeTab(tab: 'main' | 'fav'): void {
  const mainContent = document.getElementById('home-main-content');
  const favContent = document.getElementById('home-fav-content');

  if (!mainContent || !favContent) return;

  if (tab === 'main') {
    mainContent.classList.remove('hidden');
    favContent.classList.add('hidden');
  } else {
    mainContent.classList.add('hidden');
    favContent.classList.remove('hidden');
    import('./scanner').then(m => m.renderFavorites());
  }
}

// ═══ ВКЛАДКИ ═══
export function switchTab(tab: string): void {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const sc = document.getElementById('screen-' + (tab === 'fav' ? 'home' : tab));
  if (sc) sc.classList.add('active');

  document.querySelectorAll<HTMLElement>('.nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  if (tab === 'fav') {
    switchHomeTab('fav'); // Просто открываем Избранное
    return;
  } else {
    switchHomeTab('main'); // Если ушли с Избранного, возвращаем График
  }

  if (tab === 'scanner' && !state.scannerRunning) {
    (window as any).runScanner?.();
  }
  if (tab === 'portfolio') mobileSyncPortfolio(true);
  if (tab === 'oracle') renderOracleDashboard();
  if (tab === 'risk') {
    import('./risk').then(m => m.renderRiskCenter()).catch(() => { /* silent */ });
  }

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

const activeScreen = document.querySelector('.screen.active')?.id;
  const favEl = document.getElementById('home-fav-content');
  if (activeScreen === 'screen-home' && favEl && !favEl.classList.contains('hidden')) {
    renderFavorites();
  }
  if (activeScreen === 'screen-oracle') renderOracleDashboard();
  if (activeScreen === 'screen-risk') import('./risk').then(m => m.renderRiskCenter()).catch(() => { /* silent */ });

  if (document.getElementById('sheet-overlay')?.classList.contains('open')) {
    const title = document.getElementById('sheet-title')?.textContent;
    if (title === '⚙️ Настройки' || title === '⚙️ Settings') {
      (window as any).openSettings?.();
    }
  }
  if (document.getElementById('diag-overlay')?.classList.contains('open')) {
    import('./diagnostics').then(m => m.runFullDiagnostics());
  }

  if (state.isDemoMode) {
    renderDemoPlan();
  }

  toast(lang === 'en' ? 'Language: English' : 'Язык: Русский', 'success', 1500);
}

export function applyStaticTranslations(): void {
  const map: Record<string, string> = {
    // ─── ВКЛАДКИ ГЛАВНОГО ЭКРАНА (График / Избранное) ───
    'lbl-tab-chart': 'fav_tab_chart',
    'lbl-tab-favorites': 'fav_tab_favorites',

    'nav-hub': 'nav_hub',
    'nav-home': 'dashboard', 'nav-pro': 'analytics', 'nav-scanner': 'scanner',
    'nav-fav': 'favorites', 'nav-oracle': 'oracle', 'nav-portfolio': 'portfolio',
    'nav-risk': 'nav_risk',
    'radar-hub': 'nav_hub', 'radar-market': 'radar_market', 
    'radar-fav': 'favorites', 'radar-risk': 'nav_risk', 
    'radar-portfolio': 'portfolio', 'radar-orders': 'orders', 
    'radar-learning': 'learning', 'dash-network-title': 'dash_network',
    'risk-page-title-text': 'risk',
    
    // ... (остальной код функции оставляешь без изменений)
    'lbl-rebound': 'rebound', 'lbl-drop': 'drop', 'lbl-trend': 'trend',
    'lbl-plan': 'plan', 'lbl-agent': 'agent', 'lbl-xray': 'xray', 'lbl-walls': 'walls',
    'lbl-whale': 'whale', 'lbl-monitor': 'monitor', 'lbl-scan-acc': 'acc',
    'lbl-fav': 'fav_title', 'lbl-port-total': 'port_total', 'lbl-port-pnl': 'port_pnl',
    'lbl-assets': 'assets', 'lbl-port-sync': 'sync', 'lbl-oracle-name': 'oracle_name',
    'lbl-oracle-status': 'oracle_status', 'lbl-oracle-profile': 'oracle_profile',
    'lbl-oracle-stats': 'oracle_stats', 'lbl-oracle-recent': 'oracle_recent',
    
    // ─── FAVORITES CARDS (НОВЫЕ ID) ───
    'lbl-fmh-mcap': 'fav_market_cap',
    'lbl-fmh-cmc20': 'fav_cmc20',
    'lbl-fmh-alt': 'fav_altcoin_index',
       'lbl-fmh-fng': 'fav_fear_greed',
    'lbl-btc-outlook': 'btc_outlook_btn',
    
    'lbl-oracle-analyze': 'oracle_analyze', 'lbl-oracle-edit': 'oracle_edit',
    'lbl-oracle-refresh': 'oracle_refresh', 'lbl-oracle-edit-hint': 'oracle_edit_hint',
    'lbl-oracle-refresh-hint': 'oracle_refresh_hint', 'lbl-free-usdt': 'free_usdt',
    'lbl-assets-count': 'assets_count', 'lbl-in-portfolio': 'in_portfolio',
    'terms-title': 'terms_title', 'about-title': 'about_title',
    'lbl-ai-mode-insight': 'ai_mode_insight', 'lbl-ai-mode-agent': 'ai_mode_agent',
    'lbl-ai-deposit': 'ai_deposit', 'lbl-ai-run': 'ai_run',
    'demo-exit-btn': 'demo_leave', 'demo-reset-btn': 'demo_reset',
    'lbl-demo-free': 'demo_free', 'lbl-demo-invested': 'demo_invested',
    'lbl-demo-pnl': 'demo_pnl', 'lbl-demo-oracle-plan': 'demo_oracle_plan',
    'lbl-demo-virtual-trades': 'demo_virtual_trades',
    'demo-empty-orders': 'demo_no_active', 'demo-empty-oracle': 'demo_enter_coin',
    'oracle-analogs-empty': 'oracle_analogs_empty',
    'lbl-oracle-analogs': 'oracle_analogs_title',
    'diag-title': 'diag_title',
    'lbl-confluence': 'conf_title_short',

    // ABOUT IDS
    'about-what': 'about_what',
    'about-what-desc': 'about_what_desc',
    'about-who': 'about_who',
    'about-who-desc': 'about_who_desc',
    'about-can': 'about_can',
    'about-platforms': 'about_platforms',
    'about-plat-web': 'about_plat_web',
    'about-plat-win': 'about_plat_win',
    'about-plat-and': 'about_plat_and',
    'about-security': 'about_security',
    'about-security-desc': 'about_security_desc',
    'about-tech': 'about_tech',
    'about-version': 'about_version',
    'about-build': 'about_build',
    'about-feedback': 'about_feedback',
    'about-feedback-desc': 'about_feedback_desc',
    'about-warn': 'about_warn'
  };

  const htmlIds = [
    'about-who-desc', 'about-security-desc', 'about-warn',
    'about-plat-web', 'about-plat-win', 'about-plat-and'
  ];

  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (htmlIds.includes(id)) {
        el.innerHTML = tm(map[id]);
      } else {
        el.textContent = tm(map[id]);
      }
    }
  });

  const featuresList = document.getElementById('about-features-list');
  if (featuresList) featuresList.innerHTML = tm('about_features_html');

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

// ═══ АКТИВНАЯ МОНЕТА (Динамическая карточка) ═══
export async function loadActiveCoinCard(): Promise<void> {
  try {
    const tickerInput = document.getElementById('ticker') as HTMLInputElement;
    const ticker = (tickerInput?.value || state.currentTicker || 'BTC').toUpperCase();

    // 1. Загружаем свечи
    const [dailyRes, maxRes] = await Promise.all([
      fetchCandlesWithSource(ticker, '1d'),
      fetchCandlesWithSource(ticker, 'max')
    ]);
    const data = dailyRes.data;
    const maxData = maxRes.data;
    
    if (!data || data.length < 2) return;

    const price = data[data.length - 1].close;
    const prevPrice = data[data.length - 2].close;
    const change = ((price - prevPrice) / prevPrice) * 100;
    const rsi = calcRsiSimple(data.map(c => c.close), 14);

  // 2. Загружаем ПОЛНЫЕ данные с CoinGecko (с кэшем на 24ч)
    let desc = 'Актив на криптовалютном рынке.';
    let links: any = { homepage: [], twitter: '', telegram: '' };
    try {
      const cacheKey = `nebulaCgCache_${ticker}`;
      const cachedRaw = localStorage.getItem(cacheKey);
      const cached = cachedRaw ? JSON.parse(cachedRaw) : null;

      if (cached && (Date.now() - cached.ts) < 86400000) {
        desc = cached.desc;
        links = cached.links;
      } else {
        const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${ticker}`);
        const searchJson = await searchRes.json();

        if (searchJson.coins && searchJson.coins.length > 0) {
          const matchedCoin = searchJson.coins.find((c: any) => c.symbol.toUpperCase() === ticker);
          const coinId = matchedCoin ? matchedCoin.id : searchJson.coins[0].id;

          const coinRes = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`);
          const coinJson = await coinRes.json();

          if (coinJson.description && coinJson.description.en) {
            const rawDesc = coinJson.description.en;
            desc = rawDesc.length > 250 ? rawDesc.substring(0, 250) + '...' : rawDesc;
          }
          if (coinJson.links) {
            links = {
              homepage: coinJson.links.homepage?.filter((l: string) => l) || [],
              twitter: coinJson.links.twitter_screen_name ? `https://twitter.com/${coinJson.links.twitter_screen_name}` : '',
              telegram: coinJson.links.telegram_channel_identifier ? `https://t.me/${coinJson.links.telegram_channel_identifier}` : ''
            };
          }
          localStorage.setItem(cacheKey, JSON.stringify({ desc, links, ts: Date.now() }));
        }
      }
    } catch (e) { /* ignore */ }

    // 3. Обновляем DOM
    setText('btc-price', '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }));
    
    const titleEl = document.querySelector('.btc-title');
    if (titleEl) titleEl.textContent = ticker;
    
    const subEl = document.querySelector('.btc-sub');
        // Рисуем спарклайн (мини-график)
    try {
      const { data: sparkData } = await fetchCandlesWithSource(ticker, '1h');
      const closesS = sparkData.slice(-24).map((c: any) => c.close);
      const sparkEl = document.getElementById('btc-spark');
      if (sparkEl) {
        if (closesS.length > 1) {
          const mn = Math.min(...closesS);
          const mx = Math.max(...closesS);
          const rng = mx - mn || 1;
          const w = 80, h = 28;
          const pts = closesS.map((v, i) => {
            const x = (i / (closesS.length - 1)) * w;
            const y = h - ((v - mn) / rng) * h;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          }).join(' L ');
          const stroke = change >= 0 ? '#1DB954' : '#ff6584'; // Наш зеленый/красный
          sparkEl.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="M ${pts}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else {
          sparkEl.innerHTML = '';
        }
      }
    } catch { /* silent */ }
    if (subEl) subEl.textContent = `${ticker}/USDT · DAILY`;

    const ch = document.getElementById('btc-change');
    if (ch) {
      ch.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
      ch.style.color = change >= 0 ? 'var(--mint)' : 'var(--coral)';
    }

// Заполняем верхнюю панель (RSI, Отскок 120d, Падение 120d, Тренд)
    const last120 = data.slice(-120);
    const min120 = Math.min(...last120.map(c => c.low));
    const max120 = Math.max(...last120.map(c => c.high));
    const rebound120 = min120 > 0 ? ((price - min120) / min120) * 100 : 0;
    const drop120 = max120 > 0 ? ((max120 - price) / max120) * 100 : 0;

    const r = document.getElementById('btc-rsi');
    if (r) { r.textContent = rsi.toFixed(1); r.style.color = rsi < 35 ? 'var(--mint)' : rsi > 65 ? 'var(--coral)' : 'var(--hi)'; }
    setText('btc-rebound', '+' + rebound120.toFixed(1) + '%');
    setText('btc-drop', '-' + drop120.toFixed(1) + '%');
    const tr = document.getElementById('btc-trend');
    if (tr) { tr.textContent = change >= 0 ? '📈' : '📉'; tr.style.color = change >= 0 ? 'var(--mint)' : 'var(--coral)'; }
    
    setText('btc-advice', desc.split('.')[0] + '.'); // Короткая выжимка для карточки

    // 4. Логотип (без уничтожения <img> при ошибке)
    const logoContainer = document.getElementById('coin-logo-container');
    const logoImg = document.getElementById('coin-logo-img') as HTMLImageElement | null;
    if (logoContainer && logoImg) {
      let fallback = document.getElementById('coin-logo-fallback');
      if (!fallback) {
        fallback = document.createElement('span');
        fallback.id = 'coin-logo-fallback';
        fallback.style.cssText = 'display:none;font-weight:700;font-size:18px;color:#fff;';
        logoContainer.appendChild(fallback);
      }

      const iconUrl = `https://essamamdani.github.io/open-crypto-icons/icons_svg/${ticker.toLowerCase()}.svg`;
      logoImg.onload = () => {
        logoImg.style.display = 'block';
        fallback!.style.display = 'none';
        logoContainer.style.background = 'transparent';
      };
      logoImg.onerror = () => {
        logoImg.style.display = 'none';
        fallback!.textContent = ticker.charAt(0);
        fallback!.style.display = 'inline';
        logoContainer.style.background = 'var(--violet)';
      };
      logoImg.src = iconUrl;
    }

    applyBtcGlow(change);
    
    // Передаем данные в внутренний Outlook
    if (window.innerWidth >= 1024) {
      const outlookBox = document.getElementById('btc-outlook-inline');
      if (outlookBox) {
         import('./btc-outlook').then(m => m.initCoinOutlookInline(ticker, maxData, {
           price, change_24h: change, rsi, desc, links
         }));
      }
    }
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
  toast(isEN() ? 'You have exited demo mode' : 'Вы вышли из демо-режима', 'info');
}

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

export function setDemoAmount(pct: number): void {
  const inp = document.getElementById('demo-entry-amount') as HTMLInputElement | null;
  if (!inp) return;
  const amount = Math.floor(state.demoBalance * (pct / 100));
  inp.value = String(amount > 0 ? amount : 0);
  inp.focus();
  inp.select();
}

export function renderDemoPlan() {
  const box = document.getElementById('demo-oracle-content');
  if (!box) return;

  const prevAmount = (document.getElementById('demo-entry-amount') as HTMLInputElement | null)?.value || '';

  if (!state.lastMarketData || !state.lastMarketData.current_price) {
    box.innerHTML = `<div class="empty-msg">${tm('demo_enter_coin')}</div>`;
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
  stratHtml += `<div class="demo-strat-step"><span class="lbl">${tm('demo_entry_market')}</span> <span class="val">${price.toFixed(4)}</span></div>`;

  if (steps === 2) {
    stratHtml += `<div class="demo-strat-step"><span class="lbl">${tm('demo_step')} 1 (50%)</span> <span class="val tp">TP1: ${plan.tp1.toFixed(4)}</span></div>`;
    stratHtml += `<div class="demo-strat-step"><span class="lbl">${tm('demo_step')} 2 (50%)</span> <span class="val tp">TP2: ${plan.tp2.toFixed(4)}</span></div>`;
  } else {
    stratHtml += `<div class="demo-strat-step"><span class="lbl">${tm('demo_step')} 1 (34%)</span> <span class="val tp">TP1: ${plan.tp1.toFixed(4)}</span></div>`;
    stratHtml += `<div class="demo-strat-step"><span class="lbl">${tm('demo_step')} 2 (33%)</span> <span class="val tp">TP2: ${plan.tp2.toFixed(4)}</span></div>`;
    stratHtml += `<div class="demo-strat-step"><span class="lbl">${tm('demo_step')} 3 (33%)</span> <span class="val tp">TP3: ${plan.tp3.toFixed(4)}</span></div>`;
  }
  stratHtml += `<div class="demo-strat-step"><span class="lbl">${tm('demo_stop_loss')}</span> <span class="val" style="color:var(--coral)">${plan.stop.toFixed(4)}</span></div>`;
  stratHtml += `</div>`;

  const placeholder = `20% ${tm('demo_of_balance')} ($${Math.floor(state.demoBalance * 0.2)})`;

  box.innerHTML = `
    <div class="demo-strat-selector">
      <button class="demo-strat-btn ${!is3Steps ? 'active' : ''}" id="demo-strat-2"
        onclick="document.getElementById('demo-strat-3').classList.remove('active');document.getElementById('demo-strat-2').classList.add('active');renderDemoPlan();">${tm('demo_strat_2')}</button>
      <button class="demo-strat-btn ${is3Steps ? 'active' : ''}" id="demo-strat-3"
        onclick="document.getElementById('demo-strat-2').classList.remove('active');document.getElementById('demo-strat-3').classList.add('active');renderDemoPlan();">${tm('demo_strat_3')}</button>
    </div>

    ${stratHtml}

    <div class="demo-amount-block">
      <div class="demo-amount-lbl">${tm('demo_entry_amount')}</div>
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
      🤖 ${tm('demo_execute')}
    </button>
  `;
}

export function initRadarMenu() {
  const trigger = document.getElementById('radar-trigger');
  const overlay = document.getElementById('radar-overlay');
  const items = Array.from(document.querySelectorAll<HTMLElement>('.radar-item'));
  const centerOrb = document.getElementById('radar-center-orb');

  if (!trigger || !overlay || items.length === 0) return;

  overlay.classList.add('orbital-mode');
  const total = items.length;

  // Создаём декоративные орбитальные кольца и точки-индикаторы (один раз)
if (!overlay.querySelector('.orbital-rings')) {
    const rings = document.createElement('div');
    rings.className = 'orbital-rings';
    rings.innerHTML = `
      <div class="orbital-stage-glow" id="orbital-stage-glow"></div>
      <div class="orbital-track-3d"></div>
      <div class="orbital-track-3d-inner"></div>
    `;
    overlay.prepend(rings);
  }

  let hudTitle = overlay.querySelector('.orbital-hud-title') as HTMLElement | null;
  if (!hudTitle) {
    hudTitle = document.createElement('div');
    hudTitle.className = 'orbital-hud-title';
    overlay.appendChild(hudTitle);
  }

  // Логотип и анимация воронки «чёрной дыры» в нижней кнопке
  if (centerOrb && !centerOrb.querySelector('.orb-logo-img')) {
    centerOrb.innerHTML = `
      <div class="orb-vortex">
        <div class="vortex-disk"></div>
        <div class="vortex-ring vr-1"></div>
        <div class="vortex-ring vr-2"></div>
        <div class="vortex-ring vr-3"></div>
      </div>
      <div class="orb-core">
        <img src="/titlebar-logo.png" class="orb-logo-img" alt="NEBULA" onerror="this.style.display='none'">
      </div>
    `;
  }

  let dotsWrap = overlay.querySelector('.orbital-dots') as HTMLElement | null;
  if (!dotsWrap) {
    dotsWrap = document.createElement('div');
    dotsWrap.className = 'orbital-dots';
    dotsWrap.innerHTML = items.map((_, i) => `<span class="orbital-dot" data-idx="${i}"></span>`).join('');
    overlay.appendChild(dotsWrap);
  }
  const dots = Array.from(dotsWrap.querySelectorAll<HTMLElement>('.orbital-dot'));

  let isOpen = false;
  let anglePos = 0;           // Текущая позиция карусели (в единицах индекса)
  let velocity = 0;           // Инерция
  let snapTarget: number | null = null;
  let rafId: number | null = null;
  let lastFocusedIdx = 0;

  let isPointerDown = false;
  let startX = 0;
  let lastX = 0;
  let totalDragDist = 0;
  let downTarget: HTMLElement | null = null;

  function normIdx(pos: number): number {
    return ((Math.round(pos) % total) + total) % total;
  }

function renderOrbit() {
    const rx = Math.min(window.innerWidth * 0.39, 158);
    const ry = 56; // Глубина наклона кольца по вертикали
    const focused = normIdx(anglePos);

    if (focused !== lastFocusedIdx) {
      lastFocusedIdx = focused;
      if (isOpen && navigator.vibrate) navigator.vibrate(8);
    }

    // Обновляем HUD-заголовок и цвет свечения под активную кнопку
    const activeEl = items[focused];
    if (activeEl && hudTitle) {
      const labelText = activeEl.querySelector('.radar-label')?.textContent?.trim() || '';
      if (hudTitle.textContent !== labelText) {
        hudTitle.textContent = labelText;
      }
      const iconWrap = activeEl.querySelector('.radar-icon-wrap') as HTMLElement | null;
      const accentColor = iconWrap?.style.color || 'var(--cyan)';
      hudTitle.style.setProperty('--hud-accent', accentColor);
      const stageGlow = document.getElementById('orbital-stage-glow');
      if (stageGlow) stageGlow.style.setProperty('--hud-accent', accentColor);
    }

    items.forEach((item, i) => {
      let diff = ((i - anglePos) % total + total) % total;
      if (diff > total / 2) diff -= total;

      const theta = (diff / total) * Math.PI * 2;
      const x = Math.sin(theta) * rx;
      // Передняя кнопка ниже (+ry), задние уходят вверх (-ry) за неё
      const y = Math.cos(theta) * ry;
      const depth = (Math.cos(theta) + 1) / 2; // 0 (самая дальняя сзади) .. 1 (в фокусе спереди)

      const scale = 0.46 + Math.pow(depth, 1.15) * 0.78;
      // Чем дальше назад по кругу, тем сильнее растворяется в темноте
      const opacity = depth < 0.14 ? 0 : Math.pow(depth, 1.85);
      // Лёгкий 3D-наклон по окружности
      const rotateY = Math.sin(theta) * -36;
      const rotateX = (1 - depth) * 14;
      const blur = depth > 0.85 ? 0 : (1 - depth) * 3.2;
      const zIndex = Math.round(depth * 100);

      item.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px), 0) perspective(700px) rotateY(${rotateY.toFixed(1)}deg) rotateX(${rotateX.toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      item.style.opacity = opacity.toFixed(3);
      item.style.zIndex = String(zIndex);
      item.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : 'none';
      item.style.pointerEvents = depth > 0.42 ? 'auto' : 'none';

      const isFocus = i === focused && Math.abs(diff) < 0.35;
      item.classList.toggle('orbital-focus', isFocus);
    });

    dots.forEach((d, i) => d.classList.toggle('active', i === focused));
  }

  function tick() {
    if (!isOpen) {
      rafId = null;
      return;
    }

    let needMore = false;

    if (!isPointerDown) {
      if (Math.abs(velocity) > 0.015) {
        anglePos += velocity;
        velocity *= 0.91;
        needMore = true;
      } else {
        velocity = 0;
        if (snapTarget === null) snapTarget = Math.round(anglePos);
        const delta = snapTarget - anglePos;
        if (Math.abs(delta) > 0.004) {
          anglePos += delta * 0.18;
          needMore = true;
        } else {
          anglePos = snapTarget;
          snapTarget = null;
        }
      }
    } else {
      needMore = true;
    }

    renderOrbit();
    rafId = needMore ? requestAnimationFrame(tick) : null;
  }

  function ensureAnim() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function openOrbit() {
    isOpen = true;
    velocity = 0;
    snapTarget = Math.round(anglePos);
    overlay!.classList.add('open');
    centerOrb?.classList.add('visible');
    renderOrbit();
    ensureAnim();
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function closeOrbit() {
    isOpen = false;
    isPointerDown = false;
    velocity = 0;
    snapTarget = null;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    overlay!.classList.remove('open');
    centerOrb?.classList.remove('visible');
  }

  function activateItem(item: HTMLElement) {
    const action = item.getAttribute('data-action');
    const value = item.getAttribute('data-value');
    if (navigator.vibrate) navigator.vibrate([12, 24, 18]);
    closeOrbit();

    setTimeout(() => {
      if (action === 'tab' && value) {
        switchTab(value);
      } else if (action === 'func' && value) {
        const fn = (window as any)[value];
        if (typeof fn === 'function') fn();
      }
    }, 90);
  }

  // Открытие / закрытие по кнопке NEBULA в нижней панели
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) closeOrbit();
    else openOrbit();
  });

  // Закрытие по нижнему светящемуся хабу NEBULA
  centerOrb?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeOrbit();
  });

  // Свайп и тапы внутри оверлея
  overlay.addEventListener('pointerdown', (e) => {
    if (!isOpen) return;
    isPointerDown = true;
    startX = e.clientX;
    lastX = e.clientX;
    totalDragDist = 0;
    velocity = 0;
    snapTarget = null;
    downTarget = e.target as HTMLElement;
    ensureAnim();
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!isPointerDown || !isOpen) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    totalDragDist += Math.abs(dx);

    const step = dx / 115;
    anglePos -= step;
    velocity = -step * 0.85;
    renderOrbit();
  });

  const finishPointer = (e: PointerEvent) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    const wasTap = totalDragDist < 10 && Math.abs(e.clientX - startX) < 10;
    if (wasTap) {
      const clickedItem = downTarget?.closest('.radar-item') as HTMLElement | null;
      const clickedOrb = downTarget?.closest('#radar-center-orb');

      if (clickedOrb) {
        closeOrbit();
        return;
      }

      if (clickedItem) {
        const idx = items.indexOf(clickedItem);
        const focused = normIdx(anglePos);
        if (idx === focused) {
          activateItem(clickedItem);
        } else if (idx >= 0) {
          // Плавно докручиваем выбранную боковую планету в центр по кратчайшему пути
          let diff = ((idx - anglePos) % total + total) % total;
          if (diff > total / 2) diff -= total;
          velocity = 0;
          snapTarget = anglePos + diff;
          ensureAnim();
          if (navigator.vibrate) navigator.vibrate(10);
        }
        return;
      }

      // Тап по пустому фону закрывает орбиту
      closeOrbit();
      return;
    }

    // После свайпа запускаем инерцию и магнитную фиксацию
    snapTarget = null;
    ensureAnim();
  };

  overlay.addEventListener('pointerup', finishPointer);
  overlay.addEventListener('pointercancel', finishPointer);

  // Колёсико мыши для удобного теста на ПК в режиме мобилки
  overlay.addEventListener('wheel', (e) => {
    if (!isOpen) return;
    e.preventDefault();
    const dir = e.deltaY > 0 || e.deltaX > 0 ? 1 : -1;
    velocity = 0;
    snapTarget = Math.round((snapTarget ?? anglePos) + dir);
    ensureAnim();
  }, { passive: false });

window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
      if (isOpen) closeOrbit();
      return;
    }
    if (isOpen) renderOrbit();
  });
}

export const loadBTC = loadActiveCoinCard;

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    switchTab,
    switchHomeTab,
    setLanguage,
    applyStaticTranslations,
    loadActiveCoinCard,
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
    openBtcOutlook,
    closeBtcOutlook,
  });

  setTimeout(initRadarMenu, 500);
}