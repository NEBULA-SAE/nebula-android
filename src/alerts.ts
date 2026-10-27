// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · ALERTS ENGINE
// Price / Whale / Funding уведомления + Web Notification
// ═══════════════════════════════════════════════════════════════

import { state, toast, esc } from './utils';
import type { Alert, AlertKind } from './utils';
import { tm } from './i18n';
import { openSheet, closeSheet } from './ui/screens';

const LS_KEY = 'nebulaAlerts';
const CHECK_INTERVAL_MS = 30_000;

// ─── Persistence ───

function saveAlerts(): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.alerts));
  } catch { /* silent */ }
}

function loadAlerts(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) state.alerts = JSON.parse(raw);
  } catch {
    state.alerts = [];
  }
}

// ─── Notifications ───

async function ensurePermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') {
    toast(tm('alert_notif_denied'), 'warn', 3000);
    return false;
  }
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showNotification(title: string, body: string): void {
  // Web Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/ic_launcher-playstore.png',
        badge: '/ic_launcher-playstore.png',
        tag: 'nebula-alert',
      });
    } catch { /* silent */ }
  }
  // Fallback: toast
  toast(`${title} — ${body}`, 'success', 5000);
}

// ─── Alert operations ───

export function addAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'active'>): void {
  const a: Alert = {
    ...alert,
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    active: true,
  };
  state.alerts.push(a);
  saveAlerts();
  toast(tm('alert_added'), 'success');
}

export function removeAlert(id: string): void {
  state.alerts = state.alerts.filter(a => a.id !== id);
  saveAlerts();
  toast(tm('alert_removed'), 'info');
}

// ─── Проверка триггеров ───

function checkPriceAlert(a: Alert): boolean {
  const md = state.lastMarketData;
  if (!md || !md.current_price) return false;
  if (state.currentTicker.toUpperCase() !== a.ticker.toUpperCase()) return false;

  const price = md.current_price;
  const threshold = a.threshold || 0;

  if (a.kind === 'price_above') return price >= threshold;
  if (a.kind === 'price_below') return price <= threshold;
  return false;
}

function checkWhaleAlert(a: Alert): boolean {
  if (state.currentTicker.toUpperCase() !== a.ticker.toUpperCase()) return false;
  return !!state.lastWhaleData?.isWhaleActive;
}

function checkFundingAlert(a: Alert): boolean {
  const wf = (state as any).lastFuturesMetrics;
  if (!wf || typeof wf.funding_rate !== 'number') return false;
  return Math.abs(wf.funding_rate) > (a.threshold || 0.05);
}

export function checkAlerts(): void {
  const now = Date.now();
  state.alertsLastCheck = now;

  state.alerts.forEach(a => {
    if (!a.active) return;

    let fired = false;
    let msg = '';

    if (a.kind === 'price_above' || a.kind === 'price_below') {
      fired = checkPriceAlert(a);
      const md = state.lastMarketData;
      if (fired && md) {
        msg = `${a.ticker} ${a.kind === 'price_above' ? '≥' : '≤'} ${a.threshold} (${md.current_price})`;
      }
    }
    else if (a.kind === 'whale') {
      fired = checkWhaleAlert(a);
      if (fired) msg = `${a.ticker}: ${tm('risk_whale_active')}`;
    }
    else if (a.kind === 'funding') {
      fired = checkFundingAlert(a);
      const wf = (state as any).lastFuturesMetrics;
      if (fired && wf) {
        msg = `${a.ticker} funding ${wf.funding_rate.toFixed(4)}%`;
      }
    }

    if (fired && !a.triggeredAt) {
      a.triggeredAt = now;
      a.active = false;
      saveAlerts();
      showNotification(`🔔 ${tm('alert_fired')}`, msg);
    }
  });
}

// ─── Периодический цикл ───

let _loopTimer: ReturnType<typeof setInterval> | null = null;

export function startAlertsLoop(): void {
  if (_loopTimer) return;
  loadAlerts();
  _loopTimer = setInterval(checkAlerts, CHECK_INTERVAL_MS);
  console.log(`[alerts] loop started (${CHECK_INTERVAL_MS / 1000}s)`);
}

export function stopAlertsLoop(): void {
  if (_loopTimer) {
    clearInterval(_loopTimer);
    _loopTimer = null;
  }
}

// ─── Sheet для управления ───

function renderAlertRow(a: Alert): string {
  const kindMap: Record<AlertKind, string> = {
    price_above: tm('alert_kind_price_above'),
    price_below: tm('alert_kind_price_below'),
    whale: tm('alert_kind_whale'),
    funding: tm('alert_kind_funding'),
  };

  const status = a.triggeredAt
    ? `<span style="color:var(--mint);font-weight:700;">✓ ${tm('alert_triggered')}</span>`
    : `<span style="color:var(--amber);">● ${tm('alert_active')}</span>`;

  return `
    <div class="alert-row ${a.triggeredAt ? 'alert-row-triggered' : ''}">
      <div class="alert-row-left">
        <div class="alert-row-title">${esc(a.ticker)} · ${esc(kindMap[a.kind])}</div>
        ${a.threshold ? `<div class="alert-row-sub">${esc(a.threshold.toString())}</div>` : ''}
      </div>
      <div class="alert-row-right">
        ${status}
        <button class="alert-del-btn" onclick="removeAlert('${a.id}');openAlertsSheet();">✕</button>
      </div>
    </div>
  `;
}

export async function openAlertsSheet(): Promise<void> {
  const can = await ensurePermission();
  if (!can) {
    toast(tm('alert_notif_denied'), 'warn', 3000);
  }

  const list = state.alerts.length === 0
    ? `<div class="empty-msg" style="padding:20px 0;">${esc(tm('alerts_empty'))}</div>`
    : state.alerts.slice().sort((a, b) => b.createdAt - a.createdAt).map(renderAlertRow).join('');

  const form = `
    <div class="alert-form">
      <div class="alert-form-title">${esc(tm('alerts_add'))}</div>

      <div class="form-grid-2">
        <div class="form-row">
          <label class="form-lbl">${esc(tm('alert_ticker'))}</label>
          <input class="form-input" type="text" id="alert-ticker" value="${esc(state.currentTicker)}" placeholder="DASH">
        </div>
        <div class="form-row">
          <label class="form-lbl">Тип</label>
          <select class="form-input" id="alert-kind">
            <option value="price_above">${esc(tm('alert_kind_price_above'))}</option>
            <option value="price_below">${esc(tm('alert_kind_price_below'))}</option>
            <option value="whale">${esc(tm('alert_kind_whale'))}</option>
            <option value="funding">${esc(tm('alert_kind_funding'))}</option>
          </select>
        </div>
      </div>

      <div class="form-row" id="alert-threshold-row">
        <label class="form-lbl">${esc(tm('alert_threshold'))}</label>
        <input class="form-input" type="number" id="alert-threshold" step="0.0001" placeholder="0.00">
      </div>

      <button class="btn-primary btn-mint" onclick="submitAlertFromSheet()">
        ${esc(tm('alert_save'))}
      </button>
    </div>

    <div class="alert-list" style="margin-top:20px;">
      ${list}
    </div>
  `;

  openSheet(tm('alerts_title'), form);
}

export function submitAlertFromSheet(): void {
  const tickerEl = document.getElementById('alert-ticker') as HTMLInputElement | null;
  const kindEl = document.getElementById('alert-kind') as HTMLSelectElement | null;
  const thrEl = document.getElementById('alert-threshold') as HTMLInputElement | null;

  if (!tickerEl || !kindEl) return;

  const ticker = tickerEl.value.trim().toUpperCase();
  const kind = kindEl.value as AlertKind;
  const threshold = thrEl ? parseFloat(thrEl.value) : undefined;

  if (!ticker) {
    toast('Введи тикер', 'warn');
    return;
  }

  if ((kind === 'price_above' || kind === 'price_below' || kind === 'funding') &&
      (!threshold || threshold <= 0)) {
    toast('Введи порог', 'warn');
    return;
  }

  addAlert({ kind, ticker, threshold });
  closeSheet();
  setTimeout(() => openAlertsSheet(), 200);
}

// ─── Экспорт ───

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    addAlert,
    removeAlert,
    checkAlerts,
    openAlertsSheet,
    submitAlertFromSheet,
    startAlertsLoop,
    stopAlertsLoop,
  });
}