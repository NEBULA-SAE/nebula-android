// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · TRADING
// Ключи + Мастер-пароль + Ордера + TWAP + AI-агент + Портфель
// ═══════════════════════════════════════════════════════════════

import { tm, isEN } from './i18n';
import { state, setText, setHTML, esc, toast } from './utils';
import {
  encryptJson, decryptJson, isEncryptedToken,
} from './crypto';
import type { MexcKeys, PlanStep } from './sources/mexc';
import {
  executeExchangeOrders, getOpenOrders,
  getPortfolio as mexcGetPortfolio,
  placeMarketOrder, placeLimitOrder, cancelAllOrders,
  getCurrentPrice,
} from './sources/mexc';
import { getCurrentRate } from './market';
import { parseTradeIntent } from './ai';

// ─── КЛЮЧИ ───

const CONFIG_STORAGE = 'nebulaConfig';     // зашифрованный блоб
const GROQ_STORAGE = 'nebulaGroqKey';      // Groq ключ (тоже шифруется)
const PWD_SKIP_KEY = 'nebulaPwdSkipForever';

let _sessionPassword: string | null = null;

// ─── Мастер-пароль ───

export function keysHasPassword(): boolean {
  return _sessionPassword !== null;
}

export async function keysStatus(): Promise<{
  config_encrypted: boolean;
  groq_encrypted: boolean;
  unlocked: boolean;
}> {
  const configRaw = localStorage.getItem(CONFIG_STORAGE) || '';
  const groqRaw = localStorage.getItem(GROQ_STORAGE) || '';
  return {
    config_encrypted: isEncryptedToken(configRaw),
    groq_encrypted: isEncryptedToken(groqRaw),
    unlocked: _sessionPassword !== null,
  };
}

export async function keysSetMasterPassword(password: string): Promise<{ status: 'ok' | 'error'; message: string }> {
  if (!password || password.length < 6) {
    return { status: 'error', message: 'Пароль должен быть минимум 6 символов' };
  }

  // Читаем текущее содержимое (может быть plaintext или уже зашифровано)
  let cfg: any = {};
  let groq: any = {};
  const configRaw = localStorage.getItem(CONFIG_STORAGE) || '';
  const groqRaw = localStorage.getItem(GROQ_STORAGE) || '';

  if (configRaw && isEncryptedToken(configRaw)) {
    // Уже зашифрован другим паролем — не можем прочитать без старого
    if (!_sessionPassword) {
      return { status: 'error', message: 'Конфиг зашифрован другим паролем' };
    }
    try { cfg = await decryptJson(configRaw, _sessionPassword); }
    catch { return { status: 'error', message: 'Не удалось расшифровать' }; }
  } else if (configRaw) {
    try { cfg = JSON.parse(configRaw); } catch { cfg = {}; }
  }

  if (groqRaw && isEncryptedToken(groqRaw)) {
    if (_sessionPassword) {
      try { groq = await decryptJson(groqRaw, _sessionPassword); } catch { groq = {}; }
    }
  } else if (groqRaw) {
    try { groq = JSON.parse(groqRaw); } catch { groq = {}; }
  }

  // Устанавливаем пароль и шифруем
  try {
    const encCfg = await encryptJson(cfg, password);
    const encGroq = await encryptJson(groq, password);
    localStorage.setItem(CONFIG_STORAGE, encCfg);
    localStorage.setItem(GROQ_STORAGE, encGroq);
    _sessionPassword = password;
    return { status: 'ok', message: 'Конфиги зашифрованы' };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function keysUnlock(password: string): Promise<{ status: 'ok' | 'error'; message: string }> {
  if (!password) return { status: 'error', message: 'Пустой пароль' };

  const configRaw = localStorage.getItem(CONFIG_STORAGE) || '';
  const groqRaw = localStorage.getItem(GROQ_STORAGE) || '';

  // Если файлов нет — открываем сессию
  if (!configRaw && !groqRaw) {
    _sessionPassword = password;
    return { status: 'ok', message: 'Сессия открыта (данных пока нет)' };
  }

  const prev = _sessionPassword;
  _sessionPassword = password;
  try {
    if (configRaw) await decryptJson(configRaw, password);
    if (groqRaw) await decryptJson(groqRaw, password);
    return { status: 'ok', message: 'Разблокировано' };
  } catch (e: any) {
    _sessionPassword = prev;
    return { status: 'error', message: 'Неверный пароль' };
  }
}

export function keysLock(): boolean {
  _sessionPassword = null;
  return true;
}

// ─── Внутреннее чтение/запись конфига ───

async function readConfig(): Promise<Record<string, { api: string; secret: string }>> {
  const raw = localStorage.getItem(CONFIG_STORAGE) || '';
  if (!raw) return {};
  if (isEncryptedToken(raw)) {
    if (!_sessionPassword) return {};
    try { return await decryptJson(raw, _sessionPassword); }
    catch { return {}; }
  }
  try { return JSON.parse(raw); } catch { return {}; }
}

async function writeConfig(data: Record<string, any>): Promise<boolean> {
  const json = JSON.stringify(data);
  try {
    if (_sessionPassword) {
      const enc = await encryptJson(data, _sessionPassword);
      localStorage.setItem(CONFIG_STORAGE, enc);
    } else {
      localStorage.setItem(CONFIG_STORAGE, json);
    }
    return true;
  } catch (e) {
    console.warn('[trading] writeConfig:', e);
    return false;
  }
}

// ─── Публичное API ключей ───

export async function saveKeys(exchange: string, api: string, secret: string): Promise<boolean> {
  const data = await readConfig();
  data[exchange] = { api, secret };
  return writeConfig(data);
}

export async function loadKeys(exchange: string): Promise<{ api: string; secret: string }> {
  const data = await readConfig();
  return data[exchange] || { api: '', secret: '' };
}

export async function deleteKeys(exchange: string): Promise<boolean> {
  const data = await readConfig();
  delete data[exchange];
  return writeConfig(data);
}

// ─── Groq Key ───

async function readGroq(): Promise<{ key: string }> {
  const raw = localStorage.getItem(GROQ_STORAGE) || '';
  if (!raw) return { key: '' };
  if (isEncryptedToken(raw)) {
    if (!_sessionPassword) return { key: '' };
    try { return await decryptJson(raw, _sessionPassword); }
    catch { return { key: '' }; }
  }
  try { return JSON.parse(raw); } catch { return { key: '' }; }
}

async function writeGroq(data: { key: string }): Promise<boolean> {
  try {
    if (_sessionPassword) {
      const enc = await encryptJson(data, _sessionPassword);
      localStorage.setItem(GROQ_STORAGE, enc);
    } else {
      localStorage.setItem(GROQ_STORAGE, JSON.stringify(data));
    }
    return true;
  } catch (e) {
    console.warn('[trading] writeGroq:', e);
    return false;
  }
}

export async function saveGroqKey(key: string): Promise<boolean> {
  return writeGroq({ key });
}

export async function loadGroqKey(): Promise<string> {
  const d = await readGroq();
  return d.key;
}

export function deleteGroqKey(): boolean {
  try { localStorage.removeItem(GROQ_STORAGE); return true; }
  catch { return false; }
}

// ─── МАСТЕР-ПАРОЛЬ UI ───

let _mpMode: 'unlock' | 'setup' = 'unlock';
let _mpSessionSkipped = false;

export async function checkMasterPassword(): Promise<void> {
  try {
    const st = await keysStatus();
    console.log('[pwd] keys_status:', st);

    if (st.unlocked) return;
    if (_mpSessionSkipped) return;

    const overlay = document.getElementById('master-pwd-overlay');
    if (!overlay) return;

    if (st.config_encrypted || st.groq_encrypted) {
      _mpMode = 'unlock';
      showMasterPwdModal();
    } else {
      const forever = localStorage.getItem(PWD_SKIP_KEY) === '1';
      if (forever) return;
      _mpMode = 'setup';
      showMasterPwdModal();
    }
  } catch (e) {
    console.warn('[pwd] checkMasterPassword failed', e);
  }
}

export function showMasterPwdModal(): void {
  const overlay = document.getElementById('master-pwd-overlay');
  if (!overlay) return;

  const title = document.getElementById('mp-title');
  const desc = document.getElementById('mp-desc');
  const lbl = document.getElementById('mp-lbl');
  const lbl2 = document.getElementById('mp-lbl2');
  const skip = document.getElementById('mp-skip');
  const confirmRow = document.getElementById('mp-confirm-row');
  const inp = document.getElementById('mp-input') as HTMLInputElement | null;
  const inp2 = document.getElementById('mp-input2') as HTMLInputElement | null;
  const err = document.getElementById('mp-error');

  if (inp) inp.value = '';
  if (inp2) inp2.value = '';
  if (err) { err.style.display = 'none'; err.innerHTML = ''; }

  if (_mpMode === 'setup') {
    if (title) title.textContent = isEN() ? '🔐 Set master password' : '🔐 Установить мастер-пароль';
    if (desc) desc.textContent = isEN()
      ? 'Set a master password to encrypt API keys. Password is stored only in memory until app closes.'
      : 'Установи мастер-пароль для шифрования API-ключей. Пароль хранится только в памяти до закрытия приложения.';
    if (lbl) lbl.textContent = isEN() ? 'Password' : 'Пароль';
    if (lbl2) lbl2.textContent = isEN() ? 'Repeat password' : 'Повторите пароль';
    if (confirmRow) confirmRow.style.display = '';
  } else {
    if (title) title.textContent = isEN() ? '🔐 Unlock' : '🔐 Разблокировать';
    if (desc) desc.textContent = isEN()
      ? 'Enter master password to decrypt API keys.'
      : 'Введи мастер-пароль для расшифровки API-ключей.';
    if (lbl) lbl.textContent = isEN() ? 'Password' : 'Пароль';
    if (confirmRow) confirmRow.style.display = 'none';
  }
  if (skip) skip.style.display = '';

  overlay.classList.add('open');
  setTimeout(() => inp?.focus(), 200);
}

export function hideMasterPwd(skipForever = false): void {
  const overlay = document.getElementById('master-pwd-overlay');
  if (overlay) overlay.classList.remove('open');
  _mpSessionSkipped = true;
  if (skipForever) {
    try { localStorage.setItem(PWD_SKIP_KEY, '1'); } catch { /* silent */ }
  }
}

export function resetPwdSkipFlag(): void {
  try { localStorage.removeItem(PWD_SKIP_KEY); } catch { /* silent */ }
  _mpSessionSkipped = false;
}

export function openPwdFromAbout(): void {
  _mpSessionSkipped = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).hideAbout?.();
  _mpMode = 'setup';
  showMasterPwdModal();
}

export async function masterPwdSubmit(): Promise<void> {
  const inp = document.getElementById('mp-input') as HTMLInputElement | null;
  const inp2 = document.getElementById('mp-input2') as HTMLInputElement | null;
  const err = document.getElementById('mp-error');
  const btn = document.getElementById('mp-submit') as HTMLButtonElement | null;

  const pwd = (inp?.value || '').trim();
  if (pwd.length < 6) {
    if (err) {
      err.style.display = 'block';
      err.innerHTML = `<span style="color:var(--coral)">${isEN() ? 'Min 6 characters' : 'Минимум 6 символов'}</span>`;
    }
    return;
  }

  if (_mpMode === 'setup') {
    const pwd2 = (inp2?.value || '').trim();
    if (pwd !== pwd2) {
      if (err) {
        err.style.display = 'block';
        err.innerHTML = `<span style="color:var(--coral)">${isEN() ? 'Passwords do not match' : 'Пароли не совпадают'}</span>`;
      }
      return;
    }
  }

  if (btn) btn.disabled = true;
  if (err) { err.style.display = 'none'; err.innerHTML = ''; }

  try {
    const res = _mpMode === 'setup'
      ? await keysSetMasterPassword(pwd)
      : await keysUnlock(pwd);

    if (btn) btn.disabled = false;

    if (res.status === 'ok') {
      toast(
        _mpMode === 'setup'
          ? (isEN() ? 'Config encrypted' : 'Конфиг зашифрован')
          : (isEN() ? 'Unlocked' : 'Разблокировано'),
        'success'
      );
      const overlay = document.getElementById('master-pwd-overlay');
      if (overlay) overlay.classList.remove('open');
      _mpSessionSkipped = false;
    } else {
      if (err) {
        err.style.display = 'block';
        err.innerHTML = `<span style="color:var(--coral)">${esc(res.message)}</span>`;
      }
    }
  } catch (e: any) {
    if (btn) btn.disabled = false;
    if (err) {
      err.style.display = 'block';
      err.innerHTML = `<span style="color:var(--coral)">${esc(e.message)}</span>`;
    }
  }
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

export function openOrdersSheet(): void {
  const html = `
    <div class="order-tabs">
      <div class="order-tab active" data-ex="mexc" onclick="selectExTab('mexc', this)">MEXC</div>
    </div>

    <div class="exec-mode-tabs">
      <button class="exec-mode-tab active" data-execmode="grid" onclick="switchExecMode('grid')">📊 ${tm('strat_grid')}</button>
      <button class="exec-mode-tab" data-execmode="twap" onclick="switchExecMode('twap')">⏱ TWAP</button>
    </div>

    <div class="form-row">
      <label class="form-lbl">${tm('pair')}</label>
      <input class="form-input" type="text" id="tr-symbol" value="${state.currentTicker}/USDT">
    </div>
    <div class="form-row">
      <label class="form-lbl">${tm('api_key')}</label>
      <input class="form-input" type="password" id="tr-api" placeholder="API Key...">
    </div>
    <div class="form-row">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <label class="form-lbl" style="margin:0">${tm('api_secret')}</label>
        <a style="color:var(--coral);font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;cursor:pointer" onclick="mobileDeleteKeys()">${tm('del_keys')}</a>
      </div>
      <input class="form-input" type="password" id="tr-secret" placeholder="Secret Key..." style="margin-top:6px">
    </div>

    <div class="exec-panel active" id="exec-panel-grid">
      <div class="form-grid-2">
        <div class="form-row">
          <label class="form-lbl">${tm('invested')}</label>
          <input class="form-input" type="number" id="tr-rub" value="600000">
        </div>
        <div class="form-row">
          <label class="form-lbl">${tm('coins_on_balance')}</label>
          <input class="form-input" type="number" id="tr-coins" value="96.0613" step="0.0001">
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
          <input class="form-input" type="number" id="twap-qty" value="10" step="0.0001" min="0">
        </div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label class="form-lbl">${tm('twap_slices')}</label>
          <input class="form-input" type="number" id="twap-slices" value="10" min="2" max="200">
        </div>
        <div class="form-row">
          <label class="form-lbl">${tm('twap_duration')}</label>
          <input class="form-input" type="number" id="twap-duration" value="30" min="1" max="1440">
        </div>
      </div>
      <button class="btn-primary btn-amber" id="twap-run" onclick="mobileTwapStart()">
        <svg style="width:14px;height:14px;margin-right:6px;vertical-align:middle;"><use href="#i-play"/></svg>
        <span>${tm('twap_run')}</span>
      </button>
      <div class="calc-result" id="twap-result" style="display:none;margin-top:10px"></div>
    </div>`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).openSheet?.(tm('orders'), html);
  mobileLoadKeys();
}

export function switchExecMode(mode: 'grid' | 'twap'): void {
  document.querySelectorAll('.exec-mode-tab').forEach((t: any) => {
    t.classList.toggle('active', t.dataset.execmode === mode);
  });
  document.querySelectorAll('.exec-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('exec-panel-' + mode)?.classList.add('active');
}

export function selectExTab(ex: string, el: HTMLElement | null): void {
  state.currentExchange = ex;
  document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  mobileLoadKeys();
}

export async function mobileLoadKeys(): Promise<void> {
  const keys = await loadKeys(state.currentExchange);
  const apiEl = document.getElementById('tr-api') as HTMLInputElement | null;
  const secEl = document.getElementById('tr-secret') as HTMLInputElement | null;
  if (apiEl) apiEl.value = keys.api;
  if (secEl) secEl.value = keys.secret;
}

export async function mobileSaveKeys(): Promise<void> {
  const apiEl = document.getElementById('tr-api') as HTMLInputElement | null;
  const secEl = document.getElementById('tr-secret') as HTMLInputElement | null;
  const api = apiEl?.value || '';
  const secret = secEl?.value || '';
  if (!api || !secret) return;
  await saveKeys(state.currentExchange, api, secret);
}

export async function mobileDeleteKeys(): Promise<void> {
  if (confirm(tm('confirm_del_keys'))) {
    await deleteKeys(state.currentExchange);
    const apiEl = document.getElementById('tr-api') as HTMLInputElement | null;
    const secEl = document.getElementById('tr-secret') as HTMLInputElement | null;
    if (apiEl) apiEl.value = '';
    if (secEl) secEl.value = '';
    toast(tm('keys_deleted'), 'success', 1800);
  }
}

// ─── CALC STRATEGY (локальный расчёт) ───

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
  const current_price = await getCurrentPrice(base) || breakeven;

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

// ─── Execute / Sync Orders ───

async function getKeys(): Promise<MexcKeys | null> {
  const keys = await loadKeys(state.currentExchange);
  if (!keys.api || !keys.secret) {
    toast(tm('enter_keys'), 'warn');
    return null;
  }
  return keys;
}

export async function mobileExecuteTrade(): Promise<void> {
  const keys = await getKeys();
  if (!keys || !state.currentPlan) return;
  const symbolEl = document.getElementById('tr-symbol') as HTMLInputElement | null;
  const symbol = symbolEl?.value || '';
  const box = document.getElementById('calcResult');
  if (!box) return;

  if (!confirm(tm('confirm_orders'))) return;
  box.innerHTML += `<br><br>⏳ ${tm('sending')}`;

  const res = await executeExchangeOrders(keys, symbol, state.currentPlan);
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
  const keys = await getKeys();
  if (!keys) return;
  const symbolEl = document.getElementById('tr-symbol') as HTMLInputElement | null;
  const symbol = symbolEl?.value || '';
  const box = document.getElementById('calcResult');
  if (!box) return;

  box.style.display = 'block';
  box.innerHTML = `⏳ ${tm('connecting')}`;

  const res = await getOpenOrders(keys, symbol);
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

// ─── МОНИТОРИНГ ───

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).closeSheet?.();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ─── ПОРТФЕЛЬ ───

export async function mobileSyncPortfolio(silent = false): Promise<void> {
  const status = document.getElementById('port-rate');
  if (!silent && status) status.textContent = isEN() ? 'connecting...' : 'связь с биржей...';

  const keys = await loadKeys('mexc');
  if (!keys.api || !keys.secret) {
    if (!silent) toast('API ключи не найдены', 'error');
    return;
  }

  const d = await mexcGetPortfolio(keys);
  if (d.status !== 'success') {
    if (!silent) toast(d.message || 'error', 'error');
    return;
  }

  const rate = d.usdt_rub_rate || 91;
  setText('port-total', '$' + (d.total_usd || 0).toFixed(2));
  setText('port-total-rub', '≈ ' + Math.round(d.total_rub || 0).toLocaleString('ru-RU') + ' ₽');

  const pnl = document.getElementById('port-pnl');
  if (pnl) {
    const p = d.pnl_percent || 0;
    pnl.textContent = (p > 0 ? '+' : '') + p.toFixed(2) + '%';
    pnl.style.color = p > 0 ? 'var(--mint)' : p < 0 ? 'var(--coral)' : 'var(--hi)';
  }
  if (status) status.textContent = `${tm('rate')}: ${rate.toFixed(2)} ₽`;

  const assets = d.assets || [];
  if (assets.length === 0) {
    setHTML('assets-list', `<div class="empty-msg">—</div>`);
  } else {
    setHTML('assets-list', assets.map(a => `
      <div class="asset-row">
        <div><div class="asset-coin">${a.coin}</div><div class="asset-amount">${a.amount}</div></div>
        <div><div class="asset-value">$${a.total_usd.toFixed(2)}</div><div class="asset-rub">≈ ${Math.round(a.total_rub).toLocaleString('ru-RU')} ₽</div></div>
      </div>`).join(''));
  }
  if (!silent) toast(isEN() ? 'Synced' : 'Синхронизировано', 'success', 1500);
}

// ─── AI-АГЕНТ ───

export async function mobileAiCommand(): Promise<void> {
  const inputEl = document.getElementById('ai-cmd-input') as HTMLTextAreaElement | null;
  const depositEl = document.getElementById('ai-deposit') as HTMLInputElement | null;
  const resultEl = document.getElementById('ai-cmd-result');
  const btn = document.getElementById('ai-cmd-run') as HTMLButtonElement | null;

  if (!inputEl || !resultEl) return;

  const prompt = (inputEl.value || '').trim();
  const deposit = parseFloat(depositEl?.value || '0');

  if (!prompt) { toast(isEN() ? 'Enter command' : 'Введи команду', 'warn'); return; }
  if (!deposit || deposit <= 0) { toast(isEN() ? 'Enter deposit' : 'Введи депозит', 'warn'); return; }

  const keys = await loadKeys(state.currentExchange);
  if (!keys.api || !keys.secret) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = `<span style="color:var(--coral)">API ключи MEXC не найдены</span>`;
    return;
  }

  resultEl.style.display = 'block';
  resultEl.innerHTML = `<span>⏳ ${isEN() ? 'AI parsing command...' : 'AI разбирает команду...'}</span>`;
  if (btn) btn.disabled = true;

  try {
    const intent = await parseTradeIntent(prompt) as any;
    if (btn) btn.disabled = false;

    const base = intent.symbol.split('/')[0].toUpperCase();

    if (intent.action === 'grid') {
      const capital = deposit * (intent.capital_pct / 100);
      const stepSize = (intent.price_high - intent.price_low) / (intent.steps - 1);
      const perStep = capital / intent.steps;
      const orders: any[] = [];
      for (let i = 0; i < intent.steps; i++) {
        const price = intent.price_low + i * stepSize;
        const qty = perStep / price;
        const res = await placeLimitOrder(keys, base, intent.side.toUpperCase(), qty, price);
        orders.push({
          step: i + 1, price: Math.round(price * 1e8) / 1e8,
          status: res.status === 'success' ? 'ok' : 'error',
          error: res.message,
        });
      }
      const placed = orders.filter(o => o.status === 'ok').length;
      resultEl.innerHTML =
        `<span class="hlt">✅ ${placed}/${orders.length} ордеров</span><br>` +
        orders.map(o => `#${o.step} @ ${o.price}: ${o.status === 'ok' ? '✅' : '❌ ' + (o.error || '')}`).join('<br>');
      toast(isEN() ? 'Command executed' : 'Команда выполнена', 'success');

    } else if (intent.action === 'market_buy' || intent.action === 'market_sell') {
      const capital = deposit * (intent.capital_pct / 100);
      const price = await getCurrentPrice(base);
      if (price <= 0) throw new Error('не удалось получить цену');
      const qty = capital / price;
      const side = intent.action === 'market_buy' ? 'BUY' : 'SELL';
      const res = await placeMarketOrder(keys, base, side, qty);
      if (res.status === 'success') {
        resultEl.innerHTML = `<span class="hlt">✅ ${side} ${qty.toFixed(4)} ${base}</span><br>Order ID: ${res.orderId}`;
        toast(isEN() ? 'Order placed' : 'Ордер размещён', 'success');
      } else {
        resultEl.innerHTML = `<span style="color:var(--coral)">❌ ${res.message}</span>`;
      }

    } else if (intent.action === 'cancel_all') {
      const res = await cancelAllOrders(keys, base);
      resultEl.innerHTML = res.status === 'success'
        ? `<span class="hlt">✅ Ордера по ${base} отменены</span>`
        : `<span style="color:var(--coral)">❌ ${res.message}</span>`;
    }
  } catch (e: any) {
    if (btn) btn.disabled = false;
    resultEl.innerHTML = `<span style="color:var(--coral)">❌ ${esc(e.message)}</span>`;
  }
}

// ─── TWAP ───

interface TwapTask {
  status: 'running' | 'completed' | 'failed';
  symbol: string;
  side: string;
  total_quantity: number;
  slices_total: number;
  slices_done: number;
  sent_quantity: number;
  duration_minutes: number;
  started_at: number;
  finished_at?: number;
  error?: string;
  log: any[];
}

const _twapTasks = new Map<string, TwapTask>();

function genTaskId(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function twapWorker(
  taskId: string,
  base: string,
  side: 'BUY' | 'SELL',
  totalQty: number,
  slices: number,
  durationMin: number,
  keys: MexcKeys
): Promise<void> {
  const task = _twapTasks.get(taskId);
  if (!task) return;

  const intervalSec = (durationMin * 60) / slices;
  const qtyPerSlice = totalQty / slices;
  let sentTotal = 0;

  try {
    for (let i = 0; i < slices; i++) {
      const isLast = i === slices - 1;
      let qty: number;
      if (isLast) {
        qty = totalQty - sentTotal;
      } else {
        const jitter = 1.0 + (Math.random() * 0.2 - 0.1);
        qty = qtyPerSlice * jitter;
        const remaining = totalQty - sentTotal;
        qty = Math.min(qty, remaining * 0.9);
      }
      qty = Math.round(qty * 1e8) / 1e8;
      if (qty <= 0) break;

      const res = await placeMarketOrder(keys, base, side, qty);
      if (res.status === 'success') {
        sentTotal += qty;
        task.sent_quantity = Math.round(sentTotal * 1e8) / 1e8;
        task.log.push({ slice: i + 1, qty, orderId: res.orderId, status: 'ok', ts: Date.now() });
      } else {
        task.log.push({ slice: i + 1, qty, error: res.message, status: 'error', ts: Date.now() });
      }
      task.slices_done = i + 1;

      if (!isLast && intervalSec > 0) {
        await new Promise(r => setTimeout(r, intervalSec * 1000));
      }
    }
    task.status = 'completed';
    task.finished_at = Date.now();
  } catch (e: any) {
    task.status = 'failed';
    task.error = e.message;
    task.finished_at = Date.now();
  }
}

export async function mobileTwapStart(): Promise<void> {
  const symbolEl = document.getElementById('tr-symbol') as HTMLInputElement | null;
  const sideEl = document.getElementById('twap-side') as HTMLSelectElement | null;
  const qtyEl = document.getElementById('twap-qty') as HTMLInputElement | null;
  const slicesEl = document.getElementById('twap-slices') as HTMLInputElement | null;
  const durationEl = document.getElementById('twap-duration') as HTMLInputElement | null;
  const resultEl = document.getElementById('twap-result');
  const btn = document.getElementById('twap-run') as HTMLButtonElement | null;

  if (!resultEl) return;

  const symbol = symbolEl?.value?.trim() || '';
  const side = (sideEl?.value || 'buy').toUpperCase() as 'BUY' | 'SELL';
  const qty = parseFloat(qtyEl?.value || '0');
  const slices = parseInt(slicesEl?.value || '0', 10);
  const duration = parseInt(durationEl?.value || '0', 10);

  if (!symbol) { toast(isEN() ? 'Enter pair' : 'Введи пару', 'warn'); return; }
  if (!qty || qty <= 0) { toast(isEN() ? 'Enter volume' : 'Введи объём', 'warn'); return; }
  if (!slices || slices < 2) { toast(isEN() ? 'Min 2 slices' : 'Минимум 2 слайса', 'warn'); return; }
  if (!duration || duration <= 0) { toast(isEN() ? 'Enter duration' : 'Введи длительность', 'warn'); return; }

  const msg = isEN()
    ? `Start TWAP: ${side} ${qty} ${symbol} in ${slices} slices over ${duration} min?`
    : `Запустить TWAP: ${side} ${qty} ${symbol} за ${slices} слайсов за ${duration} мин?`;
  if (!confirm(msg)) return;

  const keys = await loadKeys(state.currentExchange);
  if (!keys.api || !keys.secret) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = `<span style="color:var(--coral)">API ключи MEXC не найдены</span>`;
    return;
  }

  resultEl.style.display = 'block';
  resultEl.innerHTML = `<span>⏳ ${isEN() ? 'Starting...' : 'Запускаю...'}</span>`;
  if (btn) btn.disabled = true;

  const taskId = genTaskId();
  const base = symbol.split('/')[0].toUpperCase();

  _twapTasks.set(taskId, {
    status: 'running',
    symbol: `${base}/USDT`,
    side,
    total_quantity: qty,
    slices_total: slices,
    slices_done: 0,
    sent_quantity: 0,
    duration_minutes: duration,
    started_at: Date.now(),
    log: [],
  });

  // Запускаем в фоне
  twapWorker(taskId, base, side, qty, slices, duration, keys);

  if (btn) btn.disabled = false;
  resultEl.innerHTML =
    `<span class="hlt">✅ TWAP ID: ${taskId}</span><br>` +
    `<span id="twap-status-line">⏳ 0/${slices} · sent: 0</span>`;
  startTwapPolling(taskId, slices);
  toast(isEN() ? 'TWAP started' : 'TWAP запущен', 'success');
}

let _twapPollTimer: ReturnType<typeof setInterval> | null = null;

function startTwapPolling(taskId: string, totalSlices: number): void {
  if (_twapPollTimer) { clearInterval(_twapPollTimer); _twapPollTimer = null; }

  _twapPollTimer = setInterval(() => {
    const st = _twapTasks.get(taskId);
    if (!st) {
      if (_twapPollTimer) { clearInterval(_twapPollTimer); _twapPollTimer = null; }
      return;
    }
    const line = document.getElementById('twap-status-line');
    if (line) {
      const done = st.slices_done || 0;
      const total = st.slices_total || totalSlices;
      const sent = (st.sent_quantity || 0).toFixed(4);
      const icon = st.status === 'running' ? '⏳' : (st.status === 'completed' ? '✅' : '❌');
      line.textContent = `${icon} ${done}/${total} · sent: ${sent}`;
    }
    if (st.status !== 'running') {
      if (_twapPollTimer) { clearInterval(_twapPollTimer); _twapPollTimer = null; }
      const ok = st.status === 'completed';
      toast(
        ok ? (isEN() ? 'TWAP done' : 'TWAP завершён')
           : (isEN() ? 'TWAP failed' : 'TWAP упал'),
        ok ? 'success' : 'error'
      );
    }
  }, 3000);
}

// ─── Экспорт в window (для inline-обработчиков в HTML) ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    switchAiMode,
    openOrdersSheet,
    switchExecMode,
    selectExTab,
    mobileLoadKeys,
    mobileSaveKeys,
    mobileDeleteKeys,
    mobileCalcGrid,
    mobileExecuteTrade,
    mobileSyncOrders,
    mobileSyncPortfolio,
    mobileAiCommand,
    mobileTwapStart,
    startMonitoring,
    stopMonitoring,
    checkMasterPassword,
    showMasterPwdModal,
    hideMasterPwd,
    resetPwdSkipFlag,
    openPwdFromAbout,
    masterPwdSubmit,
    keysLock,
    saveGroqKey,
    loadGroqKey,
    deleteGroqKey,
  });
}