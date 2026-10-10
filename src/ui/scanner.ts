// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SCANNER
// Точный порт из js/scanner.js — сканер дна + избранное + автокомплит
// ═══════════════════════════════════════════════════════════════

import { state, tm, isEN, setText, toast, saveFavorites } from '../utils';
import { wCall } from '../worker';

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

export function renderFavorites(): void {
  const list = document.getElementById('fav-list');
  const count = document.getElementById('fav-count');
  if (count) count.textContent = String(state.favoriteCoins.length);
  if (!list) return;
  if (state.favoriteCoins.length === 0) {
    list.innerHTML = `<div class="empty-msg">${tm('fav_empty')}</div>`;
    return;
  }
  list.innerHTML = state.favoriteCoins.map(t => `
    <div class="fav-item" onclick="pickCoin('${t}')">
      <div>
        <div class="fav-name">${t}</div>
        <div class="fav-sub">${isEN() ? 'Tap to open' : 'Открыть анализ'}</div>
      </div>
      <button class="fav-del" onclick="event.stopPropagation();removeFav('${t}')"><svg><use href="#i-x"/></svg></button>
    </div>`).join('');
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