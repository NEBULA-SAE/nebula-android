// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SCANNER
// Точный порт из js/scanner.js — сканер дна + избранное + автокомплит
// ═══════════════════════════════════════════════════════════════

import { state, tm, isEN, setText, toast, saveFavorites } from '../utils';
import { wCall } from '../worker';
import { getMarketContext } from '../market';
import { fetchCandlesWithSource } from '../sources/candles';
import { P } from '../config';

// ═══ СКАНЕР ═══

export async function runScanner(): Promise<void> {
  state.scannerRunning = true;
  const list = document.getElementById('scan-list');
  if (!list) return;
  list.innerHTML = `<div class="loader">${tm('scanning')}</div>`;

  try {
    const r = await fetch('https://api.gateio.ws/api/v4/spot/tickers');
    if (!r.ok) throw new Error('scan fail');

    const pairs = ((await r.json()) as any[])
      .filter(t => t.currency_pair.endsWith('_USDT'))
      .filter(t => !/([2-5][SL])_USDT$/.test(t.currency_pair))
      .sort((a, b) => parseFloat(b.quote_volume) - parseFloat(a.quote_volume))
      .slice(0, 200);

    state.allPairs = pairs.map(t => ({
      symbol: t.currency_pair.split('_')[0],
      pair: t.currency_pair,
      vol: parseFloat(t.quote_volume),
    }));
    state.allPairsBySymbol = {};
    state.allPairs.forEach(p => { state.allPairsBySymbol[p.symbol] = p; });

    const greens: any[] = [];
    let done = 0;

    async function fetchBatch(batch: any[]): Promise<any[]> {
      return (await Promise.all(batch.map(async (t: any) => {
        const pair = t.currency_pair;
        const name = pair.split('_')[0];
        try {
          const cr = await fetch(
            `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=1d&limit=120`
          );
          if (!cr.ok) return null;
          const d = await cr.json();
          if (!d || d.length < 60) return null;
          const closes = d.map((x: any) => parseFloat(x[2]));
          const highs = d.map((x: any) => parseFloat(x[3]));
          const lows = d.map((x: any) => parseFloat(x[4]));
          const volumes = d.map((x: any) => parseFloat(x[1]));
          return { ticker: name, closes, highs, lows, volumes };
        } catch {
          return null;
        }
      }))).filter(Boolean);
    }

    const allData: any[] = [];
    const CHUNK = 20;
    const PARALLEL = 5;
    for (let i = 0; i < pairs.length; i += CHUNK * PARALLEL) {
      const jobs: Promise<any[]>[] = [];
      for (let j = 0; j < PARALLEL; j++) {
        const start = i + j * CHUNK;
        if (start >= pairs.length) break;
        jobs.push(fetchBatch(pairs.slice(start, start + CHUNK)));
      }
      const results = await Promise.all(jobs);
      for (const arr of results) allData.push(...arr);
      done = Math.min(pairs.length, i + CHUNK * PARALLEL);
      setText('scan-status', `${done}/${pairs.length}`);
    }

    const results = await wCall('scan-batch', allData) as any[];
    for (const x of results) {
      if (x.error || x.skip) continue;
      const isGreen =
        (x.rsi < 50 && x.rebound < 35 && x.drop > 30) ||
        (x.rsi < 40 && x.rebound < 50) ||
        (x.rebound < 20 && x.drop > 50);
      if (isGreen) greens.push(x);
    }
    greens.sort((a, b) => a.rsi - b.rsi);

    if (greens.length === 0) {
      list.innerHTML = `<div class="empty-msg">${tm('no_results')}</div>`;
    } else {
      list.innerHTML = greens.map(g => `
        <div class="coin-item" onclick="pickCoin('${g.ticker}')">
          <div>
            <div class="coin-name">${g.ticker}${g.isWhaleActive ? ' 🐋' : ''}</div>
            <div class="coin-stats">${tm('rebound')}: +${g.rebound.toFixed(1)}% · ${tm('drop')}: -${g.drop.toFixed(1)}%</div>
          </div>
          <div class="coin-rsi-badge">RSI ${g.rsi.toFixed(1)}</div>
        </div>
      `).join('');
    }
    setText('scan-status', `${greens.length} ${tm('found')}`);

    state.scannerRunning = false;
    if (state.scannerTimer) clearTimeout(state.scannerTimer);
    state.scannerTimer = setTimeout(runScanner, 900000);
  } catch (e) {
    list.innerHTML = `<div class="empty-msg">${tm('error')}</div>`;
    state.scannerRunning = false;
  }
}

export function pickCoin(t: string): void {
  const el = document.getElementById('ticker') as HTMLInputElement | null;
  if (el) el.value = t;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).switchTab?.('home');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).mobileAnalyze?.();
}

// ═══ АВТОКОМПЛИТ ═══

export function initAutocomplete(): void {
  const input = document.getElementById('ticker') as HTMLInputElement | null;
  const box = document.getElementById('ticker-suggest');
  if (!input || !box) return;

  let debounceT: ReturnType<typeof setTimeout> | undefined;

  input.addEventListener('input', () => {
    if (debounceT) clearTimeout(debounceT);
    debounceT = setTimeout(showSuggest, 120);
  });
  input.addEventListener('focus', showSuggest);

  document.addEventListener('click', (e) => {
    if (!box.contains(e.target as Node) && e.target !== input) {
      box.classList.remove('open');
    }
  }, { passive: true });

  async function loadPairs(): Promise<void> {
    if (Object.keys(state.allPairsBySymbol).length > 0) return;
    try {
      const r = await fetch('https://api.gateio.ws/api/v4/spot/tickers');
      if (!r.ok) return;
      const pairs = ((await r.json()) as any[])
        .filter(t => t.currency_pair.endsWith('_USDT'))
        .filter(t => !/([2-5][SL])_USDT$/.test(t.currency_pair))
        .sort((a, b) => parseFloat(b.quote_volume) - parseFloat(a.quote_volume))
        .slice(0, 500);
      state.allPairs = pairs.map(t => ({
        symbol: t.currency_pair.split('_')[0],
        pair: t.currency_pair,
        vol: parseFloat(t.quote_volume),
      }));
      state.allPairsBySymbol = {};
      state.allPairs.forEach(p => { state.allPairsBySymbol[p.symbol] = p; });
    } catch { /* silent */ }
  }

  async function showSuggest(): Promise<void> {
    const q = (input!.value || '').toUpperCase().trim();
    if (!state.allPairs.length) await loadPairs();
    let items;
    if (!q) items = state.allPairs.slice(0, 30);
    else items = state.allPairs.filter(p => p.symbol.startsWith(q)).slice(0, 30);
    if (!items.length && q) {
      box!.classList.remove('open');
      return;
    }
    box!.innerHTML = items.map(p => `
      <div class="suggest-item" onclick="suggestPick('${p.symbol}')">
        <span class="si-symbol">${p.symbol}</span>
        <span class="si-vol">$${(p.vol / 1e6).toFixed(1)}M</span>
      </div>`).join('');
    box!.classList.add('open');
  }
}

export function suggestPick(sym: string): void {
  const el = document.getElementById('ticker') as HTMLInputElement | null;
  if (el) el.value = sym;
  document.getElementById('ticker-suggest')?.classList.remove('open');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).mobileAnalyze?.();
}

// ═══ ИЗБРАННОЕ ═══

export function updateStarButton(): void {
  const btn = document.getElementById('star-btn');
  if (!btn) return;
  const isFav = state.favoriteCoins.includes(state.currentTicker);
  btn.classList.toggle('active', isFav);
  const use = btn.querySelector('use');
  if (use) use.setAttribute('href', isFav ? '#i-star-fill' : '#i-star');
}

export function toggleFavCurrent(): void {
  const t = state.currentTicker;
  if (!t) return;
  const idx = state.favoriteCoins.indexOf(t);
  if (idx >= 0) {
    state.favoriteCoins.splice(idx, 1);
    toast(`${t} ${tm('del_fav')}`, 'info', 1500);
  } else {
    state.favoriteCoins.push(t);
    toast(`${t} ${tm('add_fav')}`, 'success', 1500);
  }
  saveFavorites();
  updateStarButton();
  renderFavorites();
}

export async function renderFavorites(): Promise<void> {
  const list = document.getElementById('fav-list');
  const count = document.getElementById('fav-count');
  
  if (count) count.textContent = String(state.favoriteCoins.length);
  if (!list) return;

  // 1. Загружаем глобальные метрики рынка
  try {
    const ctx = await getMarketContext();
    if (ctx.status === 'success') {
      const mcap = ctx.total_mcap || 0;
      const mcapStr = mcap > 0 ? (mcap > 1e12 ? `$${(mcap / 1e12).toFixed(2)}T` : `$${(mcap / 1e9).toFixed(2)}B`) : '—';
      setText('fmh-mcap', mcapStr);
      
      const mcapChg = ctx.mcap_change_24h || 0;
      const mcapChgEl = document.getElementById('fmh-mcap-change');
      if (mcapChgEl) {
        mcapChgEl.textContent = `${mcapChg >= 0 ? '+' : ''}${mcapChg.toFixed(2)}%`;
        mcapChgEl.style.color = mcapChg >= 0 ? 'var(--mint)' : 'var(--coral)';
      }
      const mcapBar = document.getElementById('fmh-mcap-bar');
      if (mcapBar) {
        const pct = Math.min(100, Math.max(5, (Math.abs(mcapChg) / 5) * 100));
        mcapBar.style.width = `${pct}%`;
        mcapBar.style.background = mcapChg >= 0 ? 'var(--mint)' : 'var(--coral)';
        mcapBar.style.boxShadow = mcapChg >= 0 ? '0 0 8px rgba(69,224,168,.5)' : '0 0 8px rgba(255,101,132,.5)';
      }

      const btcPrice = ctx.btc?.price || 0;
      const cmc20Val = btcPrice * 1.25; 
      setText('fmh-cmc20', cmc20Val > 0 ? `$${cmc20Val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—');
      const cmc20ChgEl = document.getElementById('fmh-cmc20-change');
      if (cmc20ChgEl) {
        cmc20ChgEl.textContent = `${mcapChg >= 0 ? '+' : ''}${(mcapChg * 1.1).toFixed(2)}%`;
        cmc20ChgEl.style.color = mcapChg >= 0 ? 'var(--mint)' : 'var(--coral)';
      }
      const cmc20Bar = document.getElementById('fmh-cmc20-bar');
      if (cmc20Bar) {
        const pct = Math.min(100, Math.max(5, (Math.abs(mcapChg * 1.1) / 5) * 100));
        cmc20Bar.style.width = `${pct}%`;
        cmc20Bar.style.background = mcapChg >= 0 ? 'var(--mint)' : 'var(--coral)';
      }

      const btcDom = ctx.btc_dominance || 50;
      const altIndex = Math.round(100 - btcDom); 
      setText('fmh-alt', `${altIndex}`);
      const altTextEl = document.getElementById('fmh-alt-text');
      if (altTextEl) {
        altTextEl.textContent = altIndex > 60 ? tm('fav_altseason') : altIndex < 40 ? tm('fav_btc_season') : tm('fav_neutral');
        altTextEl.style.color = altIndex > 60 ? 'var(--violet)' : altIndex < 40 ? 'var(--amber)' : 'var(--mut)';
      }
      const altRing = document.querySelector<SVGCircleElement>('#fmh-alt-ring');
      if (altRing) {
        const circumference = 263.89;
        const offset = circumference - (altIndex / 100) * circumference;
        altRing.style.strokeDashoffset = offset.toString();
        altRing.style.stroke = altIndex > 60 ? 'var(--violet)' : altIndex < 40 ? 'var(--amber)' : 'var(--cyan)';
      }

      const fng = ctx.fear_greed || 50;
      const fngEl = document.getElementById('fmh-fng');
      if (fngEl) {
        fngEl.textContent = String(fng);
        fngEl.style.color = fng > 75 ? 'var(--coral)' : fng < 25 ? 'var(--mint)' : 'var(--amber)';
      }
      setText('fmh-fng-text', ctx.fear_greed_text || tm('fav_neutral'));
      const fngRing = document.querySelector<SVGCircleElement>('#fmh-fng-ring');
      if (fngRing) {
        const circumference = 263.89;
        const offset = circumference - (fng / 100) * circumference;
        fngRing.style.strokeDashoffset = offset.toString();
        fngRing.style.stroke = fng > 75 ? 'var(--coral)' : fng < 25 ? 'var(--mint)' : 'var(--amber)';
      }
    }
  } catch { /* silent */ }

  // 2. Рендерим список
  if (state.favoriteCoins.length === 0) {
    list.innerHTML = `<div class="empty-msg">${tm('fav_empty')}</div>`;
    return;
  }

  const headerHtml = `
    <div class="fav-list-header">
      <span>#</span>
      <span>${tm('fav_moneta')}</span>
      <span>${tm('fav_cena')}</span>
      <span>${tm('fav_market_cap')}</span>
      <span>${tm('fav_grafik_24h')}</span>
      <span>${tm('fav_24h')}</span>
      <span></span>
    </div>
  `;

  list.innerHTML = `${headerHtml}<div class="loader" style="padding:20px;">${tm('loading')}</div>`;

  try {
    const r = await fetch('https://api.gateio.ws/api/v4/spot/tickers');
    if (!r.ok) throw new Error('API Error');
    const allTickers: any[] = await r.json();
    
    const tickerMap: Record<string, any> = {};
    allTickers.forEach(t => {
      if (t.currency_pair.endsWith('_USDT')) {
        tickerMap[t.currency_pair.split('_')[0]] = t;
      }
    });

    const mcapMap: Record<string, number> = {};
    try {
      const CP_PROXY = P('coinpaprika', 'https://api.coinpaprika.com');
      const cpRes = await fetch(`${CP_PROXY}/v1/tickers?quotes=USD`);
      if (cpRes.ok) {
        const cpData = await cpRes.json();
        cpData.forEach((coin: any) => {
          if (coin.symbol) {
            mcapMap[coin.symbol.toUpperCase()] = coin.quotes?.USD?.market_cap || 0;
          }
        });
      }
    } catch { /* silent */ }

    const rowsHtml = await Promise.all(state.favoriteCoins.map(async (t, idx) => {
      const tick = tickerMap[t];
      const price = tick ? parseFloat(tick.last) : 0;
      const change = tick ? parseFloat(tick.change_percentage) : 0;
      
      const priceStr = price < 0.01 ? price.toFixed(5) : price < 1 ? price.toFixed(4) : price.toFixed(2);
      const colorCls = change >= 0 ? 'up' : 'down';

      const mcapRaw = mcapMap[t] || 0;
      let mcapStr = '—';
      if (mcapRaw > 0) {
        if (mcapRaw > 1e12) mcapStr = `$${(mcapRaw / 1e12).toFixed(2)}T`;
        else if (mcapRaw > 1e9) mcapStr = `$${(mcapRaw / 1e9).toFixed(2)}B`;
        else if (mcapRaw > 1e6) mcapStr = `$${(mcapRaw / 1e6).toFixed(2)}M`;
        else mcapStr = `$${mcapRaw.toLocaleString()}`;
      }

      let sparklineSvg = '';
      try {
        const { data } = await fetchCandlesWithSource(t, '1h');
        const closes = data.slice(-24).map((c: any) => c.close);
        
        if (closes.length > 1) {
          const min = Math.min(...closes);
          const max = Math.max(...closes);
          const range = max - min || 1;
          const w = 60, h = 24;
          
          const points = closes.map((val, i) => {
            const x = (i / (closes.length - 1)) * w;
            const y = h - ((val - min) / range) * h;
            return `${x},${y}`;
          }).join(' L ');

          const strokeColor = change >= 0 ? 'var(--mint)' : 'var(--coral)';
          sparklineSvg = `<svg class="fav-sparkline" viewBox="0 0 ${w} ${h}"><path d="M ${points}" fill="none" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`;
        }
      } catch { /* silent */ }

      return `
        <div class="fav-row" onclick="pickCoin('${t}')">
          <div class="fav-row-rank">${idx + 1}</div>
          <div class="fav-row-name">
            <div class="fav-icon-wrapper">
              <img class="fav-icon-img" 
                   src="https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/${t.toLowerCase()}.svg" 
                   alt="${t}"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="fav-icon" style="display:none;">${t.charAt(0)}</div>
            </div>
            <div class="fav-ticker">${t}</div>
          </div>
          <div class="fav-row-price">$${priceStr}</div>
          <div class="fav-row-mcap">${mcapStr}</div>
          <div class="fav-row-spark">${sparklineSvg}</div>
          <div class="fav-row-change ${colorCls}">${change > 0 ? '+' : ''}${change.toFixed(2)}%</div>
          <button class="fav-row-del" onclick="event.stopPropagation();removeFav('${t}')">✕</button>
        </div>
      `;
    }));

    list.setAttribute('style', 'display: flex !important; flex-direction: column !important; width: 100% !important; gap: 2px !important;');
    list.innerHTML = `${headerHtml}${rowsHtml.join('')}`;
  } catch (e) {
    const errorRows = state.favoriteCoins.map(t => `
      <div class="fav-row" onclick="pickCoin('${t}')">
        <div class="fav-row-rank"></div>
        <div class="fav-row-name">
          <div class="fav-icon-wrapper">
            <div class="fav-icon" style="display:flex;">${t.charAt(0)}</div>
          </div>
          <div class="fav-ticker">${t}</div>
        </div>
        <div class="fav-row-price">—</div>
        <div class="fav-row-mcap">—</div>
        <div class="fav-row-spark"></div>
        <div class="fav-row-change">—</div>
        <button class="fav-row-del" onclick="event.stopPropagation();removeFav('${t}')">✕</button>
      </div>
    `).join('');    
    list.innerHTML = `${headerHtml}${errorRows}`;
  }
}

export function removeFav(t: string): void {
  state.favoriteCoins = state.favoriteCoins.filter(x => x !== t);
  saveFavorites();
  renderFavorites();
  updateStarButton();
  toast(`${t} ${tm('del_fav')}`, 'info', 1500);
}

// ═══ Экспорт в window для inline-обработчиков ═══

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    runScanner,
    pickCoin,
    suggestPick,
    updateStarButton,
    toggleFavCurrent,
    renderFavorites,
    removeFav,
    initAutocomplete,
  });
}