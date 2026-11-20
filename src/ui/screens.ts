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
  const laserLine = document.querySelector('.radar-laser-line line') as SVGLineElement;
  const centerOrb = document.getElementById('radar-center-orb');
  
  if (!trigger || !overlay || !laserLine || items.length === 0) return;

  localStorage.removeItem('nebulaRadarPositions_v1');

  const total = items.length;
  const radius = 140;

  items.forEach((item, index) => {
    const angle = (360 / total) * index;
    item.style.setProperty('--angle', `${angle}deg`);
    item.style.setProperty('--radius', `${radius}px`);
  });

  let isDragging = false;
  let currentActiveIndex = -1;
  let centerX = 0;
  let centerY = 0;

  trigger.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isDragging = true;
    overlay.classList.add('open');
    currentActiveIndex = -1;
    items.forEach(i => i.classList.remove('active'));

    centerX = window.innerWidth / 2;
    centerY = window.innerHeight / 2;

    laserLine.setAttribute('x1', centerX.toString());
    laserLine.setAttribute('y1', centerY.toString());
    laserLine.setAttribute('x2', centerX.toString());
    laserLine.setAttribute('y2', centerY.toString());
    laserLine.style.opacity = '1';

    if (centerOrb) {
      centerOrb.style.left = centerX + 'px';
      centerOrb.style.top = centerY + 'px';
      centerOrb.classList.add('visible');
    }

    if (navigator.vibrate) navigator.vibrate(20);
  });

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

    if (minDistance < 80) {
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
    if (centerOrb) centerOrb.classList.remove('visible');
  });

  trigger.addEventListener('touchstart', (e) => { e.preventDefault(); }, { passive: false });
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