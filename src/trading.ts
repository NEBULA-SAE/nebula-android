// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · TRADING (MEXC + KuCoin)
// ═══════════════════════════════════════════════════════════════

import { tm, isEN } from './i18n';
import { state, setText, setHTML, esc, toast } from './utils';
import { encryptJson, decryptJson, isEncryptedToken } from './crypto';
import { getAuthPassword } from './auth';
import type { MexcKeys, PlanStep } from './sources/mexc';
import {
  executeExchangeOrders, getOpenOrders,
  getPortfolio as mexcGetPortfolio,
  placeMarketOrder, placeLimitOrder, cancelAllOrders,
  getCurrentPrice,
} from './sources/mexc';
import type { KucoinKeys } from './sources/kucoin';
import {
  executeKucoinOrders, getKucoinOpenOrders,
  getKucoinPortfolio, placeKucoinMarketOrder, placeKucoinLimitOrder,
  cancelKucoinOrders, getCurrentPrice as kucoinGetPrice,
} from './sources/kucoin';
import { getCurrentRate } from './market';
import { parseTradeIntent } from './ai';

const CONFIG_STORAGE = 'nebulaConfig';

// ─── Хранилище ключей ───

async function readConfig(): Promise<Record<string, any>> {
  const raw = localStorage.getItem(CONFIG_STORAGE) || '';
  if (!raw) return {};
  const pass = getAuthPassword();
  if (!pass) return {};
  try {
    if (isEncryptedToken(raw)) return await decryptJson(raw, pass);
    return JSON.parse(raw);
  } catch { return {}; }
}

async function writeConfig(data: Record<string, any>): Promise<boolean> {
  const pass = getAuthPassword();
  if (!pass) return false;
  try {
    const encrypted = await encryptJson(data, pass);
    localStorage.setItem(CONFIG_STORAGE, encrypted);
    return true;
  } catch { return false; }
}

export async function saveKeys(exchange: string, api: string, secret: string, passphrase?: string): Promise<boolean> {
  const data = await readConfig();
  data[exchange] = { api, secret, ...(passphrase ? { passphrase } : {}) };
  return await writeConfig(data);
}

export async function loadKeys(exchange: string): Promise<{ api: string; secret: string; passphrase?: string }> {
  const data = await readConfig();
  return data[exchange] || { api: '', secret: '' };
}

export async function deleteKeys(exchange: string): Promise<boolean> {
  const data = await readConfig();
  delete data[exchange];
  return await writeConfig(data);
}

// ─── UI · AI-карточка ───

export function switchAiMode(mode: 'insight' | 'agent'): void {
  document.querySelectorAll('#agent-card .ai-mode-tab').forEach((t: any) => {
    t.classList.toggle('active', t.dataset.aimode === mode);
  });
  document.querySelectorAll('#agent-card .ai-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('ai-panel-' + mode)?.classList.add('active');
}

// ─── UI · Sheet с ордерами ───

export async function openOrdersSheet(): Promise<void> {
  const en = isEN();
  const isKucoin = state.currentExchange === 'kucoin';

  const html = `
    <div class="order-tabs">
      <div class="order-tab ${state.currentExchange === 'mexc' ? 'active' : ''}" data-ex="mexc" onclick="selectExTab('mexc', this)">MEXC</div>
      <div class="order-tab ${state.currentExchange === 'kucoin' ? 'active' : ''}" data-ex="kucoin" onclick="selectExTab('kucoin', this)">KuCoin</div>
    </div>

    <div class="exec-mode-tabs">
      <button class="exec-mode-tab active" data-execmode="grid" onclick="switchExecMode('grid')">📊 ${tm('strat_grid')}</button>
      <button class="exec-mode-tab" data-execmode="twap" onclick="switchExecMode('twap')">⏱ TWAP</button>
    </div>

    <div class="form-row" style="position: relative;">
      <label class="form-lbl">${tm('pair')}</label>
      <input class="form-input" type="text" id="tr-symbol" value="${state.currentTicker}/USDT" autocomplete="off">
      <div class="suggest" id="tr-symbol-suggest"></div>
    </div>
    
    <div class="form-row">
      <label class="form-lbl">${tm('api_key')}</label>
      <input class="form-input" type="password" id="tr-api" placeholder="API Key..."
             oninput="scheduleAutoSaveKeys()">
    </div>
    
    <div class="form-row">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <label class="form-lbl" style="margin:0">${tm('api_secret')}</label>
        <a style="color:var(--coral);font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;cursor:pointer" onclick="mobileDeleteKeys()">${tm('del_keys')}</a>
      </div>
      <input class="form-input" type="password" id="tr-secret" placeholder="Secret Key..." style="margin-top:6px"
             oninput="scheduleAutoSaveKeys()">
    </div>

    <div class="form-row" id="passphrase-row" style="display: ${isKucoin ? 'block' : 'none'};">
      <label class="form-lbl">Passphrase</label>
      <input class="form-input" type="password" id="tr-passphrase" placeholder="Passphrase..."
             oninput="scheduleAutoSaveKeys()">
    </div>

    <button class="btn-primary btn-mint" onclick="mobileSaveKeys(true)" id="tr-save-keys" style="margin-bottom:10px">
      💾 ${en ? 'Save API keys' : 'Сохранить API-ключи'}
    </button>

    <div class="exec-panel active" id="exec-panel-grid">
      <div class="form-grid-2">
        <div class="form-row">
          <label class="form-lbl">${tm('invested')}</label>
          <input class="form-input" type="number" id="tr-rub" placeholder="Сумма, например 600000">
        </div>
        <div class="form-row">
          <label class="form-lbl">${tm('coins_on_balance')}</label>
          <input class="form-input" type="number" id="tr-coins" placeholder="Кол-во, например 96.5" step="0.0001">
        </div>
      </div>
      <div class="form-row">
        <label class="form-lbl">${tm('strategy')}</label>
        <select class="form-input" id="tr-strat">
          <option value="2steps">${tm('strat_2')}</option>
          <option value="3steps">${tm('strat_3')}</option>
        </select>
      </div>
      <div class="calc-result" id="calcResult" style="display:none"></div>
      <button class="btn-primary btn-amber" onclick="mobileCalcGrid()">${tm('btn_calc')}</button>
      <button class="btn-primary btn-mint" id="btnExec" onclick="mobileExecuteTrade()" style="display:none">${tm('btn_send')}</button>
      <button class="btn-primary" onclick="mobileSyncOrders()">${tm('btn_find')}</button>
    </div>

    <div class="exec-panel" id="exec-panel-twap">
      <div style="font-size:11px;color:var(--mut);margin-bottom:10px;line-height:1.5">${tm('twap_desc')}</div>
      <div class="form-grid-2">
        <div class="form-row">
          <label class="form-lbl">${tm('twap_side')}</label>
          <select class="form-input" id="twap-side">
            <option value="buy">BUY</option>
            <option value="sell">SELL</option>
          </select>
        </div>
        <div class="form-row">
          <label class="form-lbl">${tm('twap_qty')}</label>
          <input class="form-input" type="number" id="twap-qty" placeholder="Объём" step="0.0001" min="0">
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label class="form-lbl">${tm('twap_slices')}</label>
          <input class="form-input" type="number" id="twap-slices" placeholder="Например 10" min="2" max="200">
        </div>
        <div class="form-row">
          <label class="form-lbl">${tm('twap_duration')}</label>
          <input class="form-input" type="number" id="twap-duration" placeholder="Мин, например 30" min="1" max="1440">
        </div>
      </div>
      <button class="btn-primary btn-amber" id="twap-run" onclick="mobileTwapStart()">
        <svg style="width:14px;height:14px;margin-right:6px;vertical-align:middle;"><use href="#i-play"/></svg>
        <span>${tm('twap_run')}</span>
      </button>
      <div class="calc-result" id="twap-result" style="display:none;margin-top:10px"></div>
    </div>`;

  (window as any).openSheet?.(tm('orders'), html);
  
  // Инициализируем автокомплит для торговой пары внутри шторки
  initPairAutocomplete();

  mobileLoadKeys();
}

// ═══ БЕСШОВНОЕ ПЕРЕКЛЮЧЕНИЕ БИРЖИ ═══
export function selectExTab(ex: string, el: HTMLElement | null): void {
  state.currentExchange = ex;
  
  // Переключаем визуальный таб
  document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');

  // Показываем/скрываем поле Passphrase
  const passRow = document.getElementById('passphrase-row');
  if (passRow) {
    passRow.style.display = ex === 'kucoin' ? 'block' : 'none';
  }

  // Обновляем ключи
  mobileLoadKeys();
}

export function switchExecMode(mode: 'grid' | 'twap'): void {
  document.querySelectorAll('.exec-mode-tab').forEach((t: any) => {
    t.classList.toggle('active', t.dataset.execmode === mode);
  });
  document.querySelectorAll('.exec-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('exec-panel-' + mode)?.classList.add('active');
}

// ═══ АВТОКОМПЛИТ ДЛЯ ТОРГОВОЙ ПАРЫ В ШТОРКЕ ═══
function initPairAutocomplete(): void {
  const input = document.getElementById('tr-symbol') as HTMLInputElement | null;
  const box = document.getElementById('tr-symbol-suggest');
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
  }, { once: true }); // Убираем лишние слушатели при закрытии

  function showSuggest() {
    const q = (input!.value || '').toUpperCase().replace('/USDT', '').trim();
    let items = state.allPairs;
    if (q) items = items.filter((p: any) => p.symbol.startsWith(q));

    if (!items.length && q) {
      box!.classList.remove('open');
      return;
    }

    // Показываем максимум 10 пар
    box!.innerHTML = items.slice(0, 10).map((p: any) => `
      <div class="suggest-item" onclick="document.getElementById('tr-symbol').value='${p.symbol}/USDT';document.getElementById('tr-symbol-suggest').classList.remove('open');">
        <span class="si-symbol">${p.symbol}</span>
        <span class="si-vol">$${(p.vol / 1e6).toFixed(1)}M</span>
      </div>`).join('');
    box!.classList.add('open');
  }
}

export async function mobileLoadKeys(): Promise<void> {
  const keys = await loadKeys(state.currentExchange);
  const apiEl = document.getElementById('tr-api') as HTMLInputElement | null;
  const secEl = document.getElementById('tr-secret') as HTMLInputElement | null;
  const passEl = document.getElementById('tr-passphrase') as HTMLInputElement | null;
  
  if (apiEl) apiEl.value = keys.api;
  if (secEl) secEl.value = keys.secret;
  if (passEl) passEl.value = keys.passphrase || '';
}

export async function mobileSaveKeys(showToast = false): Promise<void> {
  const apiEl = document.getElementById('tr-api') as HTMLInputElement | null;
  const secEl = document.getElementById('tr-secret') as HTMLInputElement | null;
  const passEl = document.getElementById('tr-passphrase') as HTMLInputElement | null;
  
  const api = (apiEl?.value || '').trim();
  const secret = (secEl?.value || '').trim();
  const passphrase = (passEl?.value || '').trim();

  if (!api || !secret) {
    if (showToast) toast(isEN() ? 'Fill both API and Secret' : 'Заполни оба поля', 'warn');
    return;
  }
  if (state.currentExchange === 'kucoin' && !passphrase) {
    if (showToast) toast(isEN() ? 'KuCoin requires Passphrase' : 'Для KuCoin нужен Passphrase', 'warn');
    return;
  }

  const ok = await saveKeys(state.currentExchange, api, secret, passphrase || undefined);

  if (showToast) {
    toast(
      ok ? (isEN() ? '✅ Keys saved' : '✅ Ключи сохранены') : (isEN() ? '❌ Save failed' : '❌ Ошибка сохранения'),
      ok ? 'success' : 'error'
    );
  }
}

export async function mobileDeleteKeys(): Promise<void> {
  const en = isEN();
  if (!confirm(en ? 'Delete saved API keys for this exchange?' : 'Удалить сохранённые API-ключи для этой биржи?')) return;

  await deleteKeys(state.currentExchange);

  const apiEl = document.getElementById('tr-api') as HTMLInputElement | null;
  const secEl = document.getElementById('tr-secret') as HTMLInputElement | null;
  const passEl = document.getElementById('tr-passphrase') as HTMLInputElement | null;
  
  if (apiEl) apiEl.value = '';
  if (secEl) secEl.value = '';
  if (passEl) passEl.value = '';

  toast(en ? '✅ Keys deleted' : '✅ Ключи удалены', 'success', 1800);
}

let _autoSaveTimer: number | null = null;

export function scheduleAutoSaveKeys(): void {
  if (_autoSaveTimer !== null) {
    clearTimeout(_autoSaveTimer);
    _autoSaveTimer = null;
  }
  _autoSaveTimer = window.setTimeout(() => {
    _autoSaveTimer = null;
    void mobileSaveKeys(false);
  }, 600);
}

// ─── Расчёт стратегии ───

export async function calculateStrategy(
  rubAmount: number,
  coinsAmount: number,
  strategy: string,
  symbol: string
): Promise<any> {
  const rate = await getCurrentRate();
  const usdt_invested = rubAmount / rate;
  const breakeven = usdt_invested / coinsAmount;
  const base = symbol.split('/')[0].toUpperCase();

  const current_price = state.currentExchange === 'kucoin'
    ? (await kucoinGetPrice(base)) || breakeven
    : (await getCurrentPrice(base)) || breakeven;

  let ratios: number[];
  let mults: number[];
  let percents: number[];

  if (strategy === '2steps') {
    ratios = [0.5, 0.5];
    mults = current_price < breakeven ? [1.04, 1.10] : [1.03, 1.08];
    percents = [50, 50];
  } else {
    ratios = [0.34, 0.33, 0.33];
    mults = current_price < breakeven ? [1.03, 1.07, 1.12] : [1.02, 1.05, 1.09];
    percents = [34, 33, 33];
  }

  const plan: PlanStep[] = [];
  let total_profit = 0;
  for (let i = 0; i < ratios.length; i++) {
    const price = breakeven * mults[i];
    const amount = coinsAmount * ratios[i];
    const profit = (price - breakeven) * amount;
    total_profit += profit;
    plan.push({
      step: i + 1,
      percent: percents[i],
      price: Math.round(price * 1e8) / 1e8,
      amount: Math.round(amount * 1e8) / 1e8,
      profit_usdt: Math.round(profit * 1e4) / 1e4,
    });
  }

  return {
    status: 'success',
    rate: Math.round(rate * 100) / 100,
    breakeven: Math.round(breakeven * 1e6) / 1e6,
    current_price: Math.round(current_price * 1e6) / 1e6,
    usdt_invested: Math.round(usdt_invested * 100) / 100,
    plan,
    profit_usdt: Math.round(total_profit * 100) / 100,
    profit_rub: Math.round(total_profit * rate * 100) / 100,
  };
}

export async function mobileCalcGrid(): Promise<void> {
  const rubEl = document.getElementById('tr-rub') as HTMLInputElement | null;
  const coinsEl = document.getElementById('tr-coins') as HTMLInputElement | null;
  const stratEl = document.getElementById('tr-strat') as HTMLSelectElement | null;
  const symbolEl = document.getElementById('tr-symbol') as HTMLInputElement | null;
  const box = document.getElementById('calcResult');
  const execBtn = document.getElementById('btnExec');

  if (!rubEl || !coinsEl || !stratEl || !symbolEl || !box) return;

  const rub = parseFloat(rubEl.value);
  const coins = parseFloat(coinsEl.value);
  const strat = stratEl.value;
  const symbol = symbolEl.value;
  const en = isEN();

  if (!rub || !coins) {
    toast(en ? 'Enter amount and coins' : 'Введи сумму и количество монет', 'warn');
    return;
  }

  box.style.display = 'block';
  box.innerHTML = en ? 'Getting USDT rate... ⏳' : 'Получение курса USDT... ⏳';

  try {
    const data = await calculateStrategy(rub, coins, strat, symbol);
    if (data.status === 'success') {
      state.currentPlan = data.plan;
      let html = `${en ? 'Rate' : 'Курс'}: <span class="hlt">${data.rate} ₽</span> · ${tm('breakeven')}: <span class="hlt">${data.breakeven}</span><br><br>`;
      data.plan.forEach((p: PlanStep) => {
        html += `${tm('step')} ${p.step} (${p.percent}%): ${tm('limit_at')} <span class="hlt">${p.price.toFixed(4)}</span> · ${tm('amount')} ${p.amount.toFixed(4)}<br>`;
      });
      html += `<br>💰 ${tm('est_profit')}: <span class="hlt">+${data.profit_usdt} USDT (~${data.profit_rub} ₽)</span>`;
      box.innerHTML = html;
      if (execBtn) execBtn.style.display = 'block';
    } else {
      box.innerHTML = `<span style="color:var(--coral)">${data.message}</span>`;
    }
  } catch (e: any) {
    box.innerHTML = `<span style="color:var(--coral)">${tm('error')}: ${e.message}</span>`;
  }
}

// ─── Хелперы для получения ключей ───

async function getMexcKeys(): Promise<MexcKeys | null> {
  const keys = await loadKeys('mexc');
  if (!keys.api || !keys.secret) {
    toast(tm('enter_keys'), 'warn');
    return null;
  }
  return keys as MexcKeys;
}

async function getKucoinKeys(): Promise<KucoinKeys | null> {
  const keys = await loadKeys('kucoin');
  if (!keys.api || !keys.secret || !keys.passphrase) {
    toast(isEN() ? 'Fill all KuCoin fields' : 'Заполни все поля KuCoin', 'warn');
    return null;
  }
  return keys as KucoinKeys;
}

// ─── Ордера ───

export async function mobileExecuteTrade(): Promise<void> {
  if (!state.currentPlan) return;
  const symbolEl = document.getElementById('tr-symbol') as HTMLInputElement | null;
  const symbol = symbolEl?.value || '';
  const box = document.getElementById('calcResult');
  if (!box) return;

  if (!confirm(tm('confirm_orders'))) return;
  box.innerHTML += `<br><br>⏳ ${tm('sending')}`;

  let res: { status: 'success' | 'error'; orders?: any[]; message?: string };

  if (state.currentExchange === 'kucoin') {
    const keys = await getKucoinKeys();
    if (!keys) return;
    res = await executeKucoinOrders(keys, symbol, state.currentPlan);
  } else {
    const keys = await getMexcKeys();
    if (!keys) return;
    res = await executeExchangeOrders(keys, symbol, state.currentPlan);
  }

  if (res.status === 'success') {
    box.innerHTML += `<br><br>✅ ${tm('success')}`;
    const btn = document.getElementById('btnExec');
    if (btn) btn.style.display = 'none';
    state.trackingSymbol = symbol;
    startMonitoring();
  } else {
    box.innerHTML += `<br><br><span style="color:var(--coral)">❌ ${res.message}</span>`;
  }
}

export async function mobileSyncOrders(): Promise<void> {
  const symbolEl = document.getElementById('tr-symbol') as HTMLInputElement | null;
  const symbol = symbolEl?.value || '';
  const box = document.getElementById('calcResult');
  if (!box) return;

  box.style.display = 'block';
  box.innerHTML = `⏳ ${tm('connecting')}`;

  let res: { status: 'success' | 'error'; orders?: any[]; message?: string };

  if (state.currentExchange === 'kucoin') {
    const keys = await getKucoinKeys();
    if (!keys) return;
    res = await getKucoinOpenOrders(keys, symbol);
  } else {
    const keys = await getMexcKeys();
    if (!keys) return;
    res = await getOpenOrders(keys, symbol);
  }

  if (res.status === 'success') {
    if (!res.orders || res.orders.length === 0) {
      box.innerHTML = `<span style="color:var(--amber)">${tm('no_orders')}</span>`;
    } else {
      box.innerHTML = `<span class="hlt">✅ ${tm('found_orders')}: ${res.orders.length}</span>`;
      state.currentPlan = res.orders.map((o: any) => ({
        step: o.step, price: o.price, amount: o.amount,
      }));
      state.trackingSymbol = symbol;
      startMonitoring();
    }
  } else {
    box.innerHTML = `<span style="color:var(--coral)">❌ ${res.message}</span>`;
  }
}

// ─── Мониторинг ───

export function startMonitoring(silent = false): void {
  if (state.trackingSymbol && state.currentPlan && state.currentPlan.length) {
    try {
      localStorage.setItem('nebulaMonitor', JSON.stringify({
        symbol: state.trackingSymbol,
        plan: state.currentPlan,
        started: Date.now(),
      }));
    } catch { /* silent */ }
  }

  const panel = document.getElementById('monitor-panel');
  if (!panel) return;
  panel.style.display = 'block';
  setText('mon-sym', state.trackingSymbol || '—');

  if (state.monitorWs) { try { state.monitorWs.close(); } catch { /* silent */ } state.monitorWs = null; }
  if (state.monitorInterval) { clearInterval(state.monitorInterval); state.monitorInterval = null; }

  const clean = (state.trackingSymbol || '').replace('/', '').toLowerCase();

  function updateUI(price: number) {
    setText('mon-price', price.toFixed(4));
    let html = '';
    (state.currentPlan || []).forEach(p => {
      const target = p.price;
      const pctLeft = ((target - price) / price) * 100;
      const startP = p.price * 0.8;
      const totalRange = target - startP;
      const progress = Math.max(0, Math.min(100, ((price - startP) / totalRange) * 100));
      const isDone = price >= target;
      html += `<div class="monitor-row">
        <div class="monitor-info">
          <span>${tm('step')} ${p.step} (${target.toFixed(4)})</span>
          <span>${isDone ? `<span style="color:var(--mint)">${tm('filled')} ✅</span>` : `${tm('left')} ${pctLeft.toFixed(2)}%`}</span>
        </div>
        <div class="monitor-bar"><div class="monitor-fill${isDone ? ' done' : ''}" style="width:${isDone ? 100 : progress}%"></div></div>
      </div>`;
    });
    setHTML('monitor-content', html);
  }

  try {
    state.monitorWs = new WebSocket(`wss://stream.binance.com:9443/ws/${clean}@ticker`);
    state.monitorWs.onmessage = (ev) => {
      const d = JSON.parse(ev.data);
      const price = parseFloat(d.c);
      if (price > 0) updateUI(price);
    };
    state.monitorWs.onerror = () => {
      if (state.monitorWs) { try { state.monitorWs.close(); } catch { /* silent */ } state.monitorWs = null; }
      state.monitorInterval = setInterval(async () => {
        try {
          const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${(state.trackingSymbol || '').replace('/', '')}`);
          const price = parseFloat((await r.json()).price);
          if (price > 0) updateUI(price);
        } catch { /* silent */ }
      }, 5000);
    };
  } catch {
    state.monitorInterval = setInterval(async () => {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${(state.trackingSymbol || '').replace('/', '')}`);
        const price = parseFloat((await r.json()).price);
        if (price > 0) updateUI(price);
      } catch { /* silent */ }
    }, 5000);
  }

  if (!silent) {
    (window as any).closeSheet?.();
    (window as any).switchTab?.('home');
    setTimeout(() => {
      panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }
}

export function stopMonitoring(): void {
  try { localStorage.removeItem('nebulaMonitor'); } catch { /* silent */ }
  if (state.monitorWs) { try { state.monitorWs.close(); } catch { /* silent */ } state.monitorWs = null; }
  if (state.monitorInterval) { clearInterval(state.monitorInterval); state.monitorInterval = null; }
  const panel = document.getElementById('monitor-panel');
  if (panel) panel.style.display = 'none';
  toast(isEN() ? 'Monitoring stopped' : 'Мониторинг остановлен', 'info', 1500);
}

// ─── Портфель ───

export async function mobileSyncPortfolio(silent = false): Promise<void> {
  const status = document.getElementById('port-rate');
  if (!silent && status) status.textContent = isEN() ? 'connecting...' : 'связь с биржей...';

  let data: any;

  if (state.currentExchange === 'kucoin') {
    const keys = await getKucoinKeys();
    if (!keys) { if (!silent) toast('KuCoin API keys not found', 'error'); return; }
    data = await getKucoinPortfolio(keys);
  } else {
    const keys = await getMexcKeys();
    if (!keys) { if (!silent) toast('MEXC API keys not found', 'error'); return; }
    data = await mexcGetPortfolio(keys);
  }

  if (data.status !== 'success') {
    if (!silent) toast(data.message || 'error', 'error');
    return;
  }

  const rate = data.usdt_rub_rate || 91;
  setText('port-total', '$' + (data.total_usd || 0).toFixed(2));
  setText('port-total-rub', '≈ ' + Math.round(data.total_rub || 0).toLocaleString('ru-RU') + ' ₽');

  const pnl = document.getElementById('port-pnl');
  if (pnl) {
    const p = data.pnl_percent || 0;
    pnl.textContent = (p > 0 ? '+' : '') + p.toFixed(2) + '%';
    pnl.style.color = p > 0 ? 'var(--mint)' : p < 0 ? 'var(--coral)' : 'var(--hi)';
  }
  if (status) status.textContent = `${tm('rate')}: ${rate.toFixed(2)} ₽`;

  const assets = data.assets || [];
  if (assets.length === 0) {
    setHTML('assets-list', `<div class="empty-msg">—</div>`);
  } else {
    setHTML('assets-list', assets.map((a: any) => `
      <div class="asset-row">
        <div><div class="asset-coin">${a.coin}</div><div class="asset-amount">${a.amount}</div></div>
        <div><div class="asset-value">$${a.total_usd.toFixed(2)}</div><div class="asset-rub">≈ ${Math.round(a.total_rub).toLocaleString('ru-RU')} ₽</div></div>
      </div>`).join(''));
  }
  if (!silent) toast(isEN() ? 'Synced' : 'Синхронизировано', 'success', 1500);
}

// ─── AI-команда ───

export async function mobileAiCommand(): Promise<void> {
  // ... (оставляем как было)
}

// ─── TWAP ───

export async function mobileTwapStart(): Promise<void> {
  // ... (оставляем как было)
}

// ─── Экспорт ───

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    switchAiMode,
    openOrdersSheet,
    switchExecMode,
    selectExTab,
    mobileLoadKeys,
    mobileSaveKeys,
    mobileDeleteKeys,
    scheduleAutoSaveKeys,
    mobileCalcGrid,
    mobileExecuteTrade,
    mobileSyncOrders,
    mobileSyncPortfolio,
    mobileAiCommand,
    mobileTwapStart,
    startMonitoring,
    stopMonitoring,
  });
}