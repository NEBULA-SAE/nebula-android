import { state, toast, setText } from './utils';
import { getCurrentPrice } from './sources/mexc';
import { oracleSaveAnalysis } from './oracle';

let _demoInterval: any = null;
const INITIAL_BALANCE = 10000;

// ═══ СОХРАНЕНИЕ И ЗАГРУЗКА СОСТОЯНИЯ ═══

function saveDemoState() {
  try {
    localStorage.setItem('nebula_demo_state', JSON.stringify({
      balance: state.demoBalance,
      active: state.demoActiveOrders,
      history: state.demoHistory
    }));
  } catch (e) {
    console.warn('Save demo state failed', e);
  }
}

function loadDemoState() {
  try {
    const saved = localStorage.getItem('nebula_demo_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      state.demoBalance = parsed.balance ?? INITIAL_BALANCE;
      state.demoActiveOrders = parsed.active ?? [];
      state.demoHistory = parsed.history ?? [];
    }
  } catch (e) {
    console.warn('Load demo state failed', e);
  }
}

// ═══ ЗАПУСК / ОСТАНОВКА ═══

export function startDemoEngine() {
  loadDemoState();
  stopDemoEngine();
  _demoInterval = setInterval(tick, 5000);
  tick();
}

export function stopDemoEngine() {
  if (_demoInterval) {
    clearInterval(_demoInterval);
    _demoInterval = null;
  }
}

async function tick() {
  if (!state.isDemoMode) return;

  if (state.demoActiveOrders.length === 0) {
    updateDemoBalanceUI({});
    renderDemoSummary({});
    return;
  }

  const symbols = [...new Set(state.demoActiveOrders.map(o => o.symbol))];
  const prices: Record<string, number> = {};

  await Promise.all(symbols.map(async (s) => {
    try {
      const p = await getCurrentPrice(s);
      if (p > 0) prices[s] = p;
    } catch { /* silent */ }
  }));

  checkDemoOrders(prices);
  renderDemoOrders(prices);
  renderDemoSummary(prices);
  updateDemoBalanceUI(prices);
}

// ═══ ИСПОЛНЕНИЕ ПЛАНА ═══

export async function executeDemoPlan(entryPrice: number, plan: any, steps: number) {
  const base = state.currentTicker;

  const inp = document.getElementById('demo-entry-amount') as HTMLInputElement | null;
  let capital = parseFloat(inp?.value || '0');

  if (!isFinite(capital) || capital <= 0) {
    capital = state.demoBalance * 0.2;
  }

  if (capital > state.demoBalance) {
    capital = state.demoBalance;
    toast(`Максимум доступно: $${capital.toFixed(2)}`, 'warn');
  }

  capital = Math.floor(capital * 100) / 100;

  if (capital <= 0) {
    toast('Недостаточно виртуальных средств', 'error');
    return;
  }

  const targets = steps === 2
    ? [{ tp: plan.tp1, pct: 0.5 }, { tp: plan.tp2, pct: 0.5 }]
    : [{ tp: plan.tp1, pct: 0.34 }, { tp: plan.tp2, pct: 0.33 }, { tp: plan.tp3, pct: 0.33 }];

  const amountPerStep = capital / steps;
  const coinAmountPerStep = amountPerStep / entryPrice;

  state.demoBalance -= capital;

  targets.forEach((t, i) => {
    state.demoActiveOrders.push({
      id: Math.random().toString(36).slice(2, 8),
      symbol: base,
      entryPrice,
      targetPrice: t.tp,
      stopLoss: plan.stop,
      amountUsdt: amountPerStep,
      amountCoin: coinAmountPerStep,
      status: 'open',
      step: i + 1,
    });
  });

  toast(`Открыто ${steps} виртуальных ордера на $${capital.toFixed(2)}`, 'success');

  const prices: Record<string, number> = { [base]: entryPrice };
  renderDemoOrders(prices);
  renderDemoSummary(prices);
  updateDemoBalanceUI(prices);
  saveDemoState();
}

// ═══ ПРОВЕРКА ИСПОЛНЕНИЯ ═══

function checkDemoOrders(prices: Record<string, number>) {
  const closedOrders: any[] = [];

  for (const order of state.demoActiveOrders) {
    if (order.status !== 'open') continue;
    const currentPrice = prices[order.symbol];
    if (!currentPrice) continue;

    if (currentPrice >= order.targetPrice) {
      order.status = 'win';
      order.closePrice = order.targetPrice;
      closedOrders.push(order);
    } else if (currentPrice <= order.stopLoss) {
      order.status = 'loss';
      order.closePrice = order.stopLoss;
      closedOrders.push(order);
    }
  }

  if (closedOrders.length === 0) return;

  for (const order of closedOrders) {
    const returnedUsdt = order.amountCoin * order.closePrice;
    state.demoBalance += returnedUsdt;

    state.demoHistory.push(order);
    state.demoActiveOrders = state.demoActiveOrders.filter(o => o.id !== order.id);

    const isWin = order.status === 'win';
    const pnlPct = ((order.closePrice - order.entryPrice) / order.entryPrice) * 100;

    try {
      const fakeMarketData = {
        current_price: order.entryPrice,
        rsi: 50, rebound_pct: 0, drop_pct: 0,
        whale_active: false, whale_trend: '', funding_rate: 0, bids_pct: 50,
      };
      const verdict = isWin ? 'buy' : 'avoid';
      oracleSaveAnalysis(order.symbol, fakeMarketData, verdict, 50, 50, false, 'demo');
      toast(`Оракул запомнил: ${isWin ? '✅ Тейк' : '❌ Стоп'} (${pnlPct.toFixed(2)}%)`, isWin ? 'success' : 'info');
    } catch (e) {
      console.warn('Oracle learn error', e);
    }
  }
  saveDemoState();
}

// ═══ ОТМЕНА ОРДЕРА ВРУЧНУЮ ═══

export async function cancelDemoOrder(id: string) {
  const order = state.demoActiveOrders.find(o => o.id === id);
  if (!order) return;

  try {
    const currentPrice = await getCurrentPrice(order.symbol);
    const priceToUse = currentPrice > 0 ? currentPrice : order.entryPrice;
    const returnedUsdt = order.amountCoin * priceToUse;

    // Возвращаем средства
    state.demoBalance += returnedUsdt;

    // Помечаем как отмененный и кидаем в историю
    order.status = 'cancelled';
    order.closePrice = priceToUse;
    state.demoHistory.push(order);

    // Удаляем из активных
    state.demoActiveOrders = state.demoActiveOrders.filter(o => o.id !== id);

    saveDemoState();
    
    // Обновляем UI
    const prices = { [order.symbol]: priceToUse };
    renderDemoOrders(prices);
    renderDemoSummary(prices);
    updateDemoBalanceUI(prices);

    toast(`Ордер ${order.symbol} отменён. Возвращено: $${returnedUsdt.toFixed(2)}`, 'info');
  } catch (e) {
    toast('Ошибка при отмене ордера', 'error');
  }
}

// ═══ РЕНДЕР ОРДЕРОВ ═══

function renderDemoOrders(prices: Record<string, number>) {
  const box = document.getElementById('demo-orders-list');
  if (!box) return;

  if (state.demoActiveOrders.length === 0) {
    box.innerHTML = `<div class="empty-msg">Нет активных сделок</div>`;
    return;
  }

  box.innerHTML = state.demoActiveOrders.map(o => {
    const currentPrice = prices[o.symbol] || o.entryPrice;
    const pnlPct = ((currentPrice - o.entryPrice) / o.entryPrice) * 100;
    const pnlUsdt = (currentPrice - o.entryPrice) * o.amountCoin;
    const colorCls = pnlPct >= 0 ? 'mint' : 'coral';

    return `
      <div class="demo-trade-row">
        <div class="demo-trade-info">
          <div class="demo-trade-title">${o.symbol} · Шаг ${o.step}</div>
          <div class="demo-trade-sub">
            Вход: ${o.entryPrice.toFixed(4)} | TP: ${o.targetPrice.toFixed(4)}<br>
            Объём: $${o.amountUsdt.toFixed(2)} (${o.amountCoin.toFixed(4)} шт)
          </div>
        </div>
        <div class="demo-trade-right">
          <div class="demo-trade-pnl ${colorCls}">
            ${pnlUsdt >= 0 ? '+' : ''}$${pnlUsdt.toFixed(2)}<br>
            <span style="font-size:11px">(${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)</span>
          </div>
          <button class="demo-trade-cancel" onclick="cancelDemoOrder('${o.id}')" title="Отменить ордер">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

// ═══ РЕНДЕР СВОДКИ ПО МОНЕТАМ (ТИКЕР-БАР) ═══

function renderDemoSummary(prices: Record<string, number>) {
  const box = document.getElementById('demo-ticker-summary');
  if (!box) return;

  const symbols = [...new Set(state.demoActiveOrders.map(o => o.symbol))];
  
  if (symbols.length === 0) {
    box.style.display = 'none';
    return;
  }

  box.style.display = 'flex';
  box.innerHTML = symbols.map(sym => {
    const currentPrice = prices[sym] || 0;
    const symOrders = state.demoActiveOrders.filter(o => o.symbol === sym);
    
    let totalInvested = 0;
    let totalCurrentValue = 0;

    symOrders.forEach(o => {
      totalInvested += o.amountUsdt;
      totalCurrentValue += o.amountCoin * (currentPrice || o.entryPrice);
    });

    const pnlPct = totalInvested > 0 ? ((totalCurrentValue - totalInvested) / totalInvested) * 100 : 0;
    const colorCls = pnlPct >= 0 ? 'mint' : 'coral';
    const prefix = pnlPct >= 0 ? '+' : '';

    return `
      <div class="demo-sum-item ${colorCls}">
        <span class="sym">${sym}</span>
        <span class="pnl">${prefix}${pnlPct.toFixed(2)}%</span>
      </div>
    `;
  }).join('');
}

// ═══ БАЛАНС ═══

function updateDemoBalanceUI(prices: Record<string, number>) {
  let investedUsdt = 0;
  for (const o of state.demoActiveOrders) {
    const p = prices[o.symbol] || o.entryPrice;
    investedUsdt += o.amountCoin * p;
  }

  const total = state.demoBalance + investedUsdt;
  const pnl = total - INITIAL_BALANCE;

  setText('demo-balance-free', `$${state.demoBalance.toFixed(2)}`);
  setText('demo-balance-invested', `$${investedUsdt.toFixed(2)}`);

  const pnlEl = document.getElementById('demo-balance-pnl');
  if (pnlEl) {
    pnlEl.textContent = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    pnlEl.className = 'db-val ' + (pnl >= 0 ? 'mint' : 'coral');
  }
}

// ═══ СБРОС ═══

export function resetDemo() {
  state.demoBalance = INITIAL_BALANCE;
  state.demoActiveOrders = [];
  state.demoHistory = [];
  saveDemoState();
  
  updateDemoBalanceUI({});
  renderDemoOrders({});
  renderDemoSummary({});
  
  toast('Демо-режим сброшен', 'info');
}