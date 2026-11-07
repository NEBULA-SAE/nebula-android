// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · BTC OUTLOOK UI
// ═══════════════════════════════════════════════════════════════

import { tm } from '../i18n';
import { getBtcDailyAnalysis } from '../market';
import { fetchCandlesWithSource } from '../sources/candles';
import { toast } from '../utils';
import {
  computeBreakoutStats, computeBreakoutProbability,
  computeCalendarComparison, analyzeCycles,
} from '../btc/outlook-engine';

// ─── PRO gate ───
async function isProUser(): Promise<boolean> {
  try {
    const mod = await import('../pro');
    const status: any = await mod.checkLocalProStatus();
    if (typeof status === 'boolean') return status;
    if (status && typeof status === 'object') {
      return !!(status.is_pro || status.active || status.valid || status.isPro);
    }
    return false;
  } catch {
    return false;
  }
}

async function openProPaywall(): Promise<void> {
  try {
    const mod = await import('../pro');
    if (typeof mod.openProModal === 'function') {
      mod.openProModal();
      return;
    }
    // fallback — если по какой-то причине функции нет
    (window as any).openProModal?.();
  } catch {
    (window as any).openProModal?.();
  }
}

export async function openBtcOutlook(): Promise<void> {
  const isPro = await isProUser();
  if (!isPro) {
    toast(tm('btc_outlook_pro_only'), 'info', 2600);
    await openProPaywall();
    return;
  }

  const ov = document.getElementById('btc-outlook-overlay');
  if (!ov) return;
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
  await render();
}

export function closeBtcOutlook(): void {
  document.getElementById('btc-outlook-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── GLOW: главная фишка ───
export function applyBtcGlow(change24h: number): void {
  const targets = [
    document.getElementById('btc-outlook-modal'),
    document.querySelector('.btc-card'),
  ].filter(Boolean) as HTMLElement[];

  const abs = Math.abs(change24h);
  const intensity = Math.min(1, abs / 12);
  const color = change24h > 0.3 ? '#45e0a8'
              : change24h < -0.3 ? '#ff6584'
              : '#5ecbff';

  for (const el of targets) {
    el.style.setProperty('--glow-color', color);
    el.style.setProperty('--glow-intensity', intensity.toFixed(2));
    el.classList.toggle('btc-glow-strong', intensity > 0.6);
  }
}

async function render(): Promise<void> {
  const box = document.getElementById('btc-outlook-content');
  if (!box) return;
  box.innerHTML = `<div class="btc-load">${tm('loading')}</div>`;

  try {
    const [btc, weekly] = await Promise.all([
      getBtcDailyAnalysis(),
      fetchCandlesWithSource('BTC', 'max').then(r => r.data).catch(() => []),
    ]);

    if (btc.status !== 'success') {
      box.innerHTML = `<div class="btc-err">${btc.message || 'Error'}</div>`;
      return;
    }

    const price = btc.price;
    const ath = btc.ath || Math.max(...weekly.map(c => c.high), price);
    const lastKnownAth = '2024-11-13';

    const stats = computeBreakoutStats(price, ath, lastKnownAth);
    const prob = computeBreakoutProbability(weekly, stats.pct_to_ath);
    const cycles = analyzeCycles();
    const today = new Date();
    const cal = computeCalendarComparison(weekly, today.getMonth() + 1, today.getDate());

    applyBtcGlow(btc.change_24h);

    box.innerHTML = html(btc, stats, prob, cycles, cal);
    wireTabs();
  } catch (e: any) {
    box.innerHTML = `<div class="btc-err">${e.message || 'Error'}</div>`;
  }
}

function html(btc: any, s: any, p: any, cycles: any[], cal: any[]): string {
  const chg = btc.change_24h;
  const chgColor = chg >= 0 ? 'var(--mint)' : 'var(--coral)';
  const chgSign = chg >= 0 ? '+' : '';
  const atAth = s.pct_to_ath < 0.5;

  return `
  <div class="btc-head">
    <div class="btc-head-info">
      <div class="btc-head-lbl">BTC OUTLOOK · ${new Date().toLocaleDateString('ru-RU')}</div>
      <div class="btc-head-price">$${btc.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
      <div class="btc-head-chg" style="color:${chgColor}">${chgSign}${chg.toFixed(2)}%</div>
    </div>
    <button class="btc-close" onclick="closeBtcOutlook()">✕</button>
  </div>

  <div class="btc-tabs">
    <button class="btc-tab active" data-tab="snap">${tm('btc_tab_snap')}</button>
    <button class="btc-tab" data-tab="break">${tm('btc_tab_break')}</button>
    <button class="btc-tab" data-tab="cal">${tm('btc_tab_cal')}</button>
    <button class="btc-tab" data-tab="cyc">${tm('btc_tab_cyc')}</button>
  </div>

  <div class="btc-tab-body active" data-tab-body="snap">
    ${renderSnap(btc, s, atAth)}
  </div>
  <div class="btc-tab-body" data-tab-body="break">
    ${renderBreak(p, s)}
  </div>
  <div class="btc-tab-body" data-tab-body="cal">
    ${renderCal(cal)}
  </div>
  <div class="btc-tab-body" data-tab-body="cyc">
    ${renderCyc(cycles, s)}
  </div>

  <div class="btc-foot">${tm('btc_foot_warn')}</div>
  `;
}

function renderSnap(btc: any, s: any, atAth: boolean): string {
  return `
    <div class="btc-grid4">
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_rsi')}</div><div class="btc-cell-v">${btc.rsi.toFixed(1)}</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_ath')}</div><div class="btc-cell-v" style="color:var(--amber)">$${s.current_ath.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_to_ath')}</div><div class="btc-cell-v" style="color:${atAth ? 'var(--mint)' : 'var(--coral)'}">${s.pct_to_ath.toFixed(1)}%</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_days')}</div><div class="btc-cell-v">${s.days_since_ath}</div></div>
    </div>

    <div class="btc-note">${btc.advice}</div>

    ${atAth
      ? `<div class="btc-banner mint">🚀 ${tm('btc_at_ath')}</div>`
      : `<div class="btc-banner amber">${tm('btc_below')} <b>${s.pct_to_ath.toFixed(1)}%</b></div>`}

    <div class="btc-heatbar-wrap">
      <div class="btc-heatbar-lbl">${tm('btc_heat')}</div>
      <div class="btc-heatbar"><div class="btc-heatbar-fill" style="width:${Math.min(100, Math.abs(btc.change_24h) * 8)}%"></div></div>
    </div>
  `;
}

function renderBreak(p: any, s: any): string {
  if (p.samples === 0) return `<div class="btc-empty">${tm('btc_no_data')}</div>`;

  const rows = [
    { l: tm('btc_h7'), v: p.p_7d,  c: 'short' },
    { l: tm('btc_h30'),v: p.p_30d, c: 'mid' },
    { l: tm('btc_h90'),v: p.p_90d, c: 'long' },
    { l: tm('btc_h365'),v:p.p_365d,c: 'year' },
  ];

  return `
    <div class="btc-prob-head">
      <span>${tm('btc_prob_title')}</span>
      <span class="btc-prob-sample">${p.samples} ${tm('btc_analogs')}</span>
    </div>
    <div class="btc-prob-list">
      ${rows.map(r => `
        <div class="btc-prob-row">
          <span class="btc-prob-lbl">${r.l}</span>
          <div class="btc-prob-wrap"><div class="btc-prob-fill ${r.c}" style="width:${r.v}%"></div></div>
          <span class="btc-prob-val">${r.v}%</span>
        </div>
      `).join('')}
    </div>

    <div class="btc-prob-examples">
      <div class="btc-ex-title">${tm('btc_similar')}</div>
      ${p.analogs.slice(-6).reverse().map((a: any) => `
        <div class="btc-ex-row">
          <span>${a.date}</span>
          <span>${a.pct_below_ath}% ${tm('btc_below_short')}</span>
          <span>${a.broke_within_30d ? '✅' : '❌'} 30d</span>
        </div>
      `).join('')}
    </div>
    <div class="btc-method">${tm('btc_method')}</div>
  `;
}

function renderCal(cal: any[]): string {
  if (!cal.length) return `<div class="btc-empty">${tm('btc_no_data')}</div>`;

  const rows = cal.slice().reverse();
  const athYears = rows.filter(r => r.had_ath_nearby).length;

  return `
    <div class="btc-cal-head">
      <div class="btc-cal-title">${tm('btc_cal_title')}</div>
      <div class="btc-cal-sub">${cal[0]?.date.slice(5) || ''} · ${rows.length} ${tm('btc_years')}</div>
    </div>
    <div class="btc-cal-list">
      ${rows.map(r => `
        <div class="btc-cal-row ${r.had_ath_nearby ? 'ath' : ''}">
          <span class="btc-cal-y">${r.year}</span>
          <span class="btc-cal-p">$${r.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          <span class="btc-cal-c" style="color:${r.pct_from_year_start >= 0 ? 'var(--mint)' : 'var(--coral)'}">${r.pct_from_year_start >= 0 ? '+' : ''}${r.pct_from_year_start}%</span>
          ${r.had_ath_nearby ? '<span class="btc-cal-badge">ATH</span>' : ''}
        </div>
      `).join('')}
    </div>
    <div class="btc-cal-foot">
      ${tm('btc_cal_foot').replace('{n}', String(rows.length)).replace('{ath}', String(athYears))}
    </div>
  `;
}

function renderCyc(cycles: any[], s: any): string {
  return `
    <div class="btc-grid3">
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_avg')}</div><div class="btc-cell-v">${s.avg_days_between}d</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_median')}</div><div class="btc-cell-v">${s.median_days_between}d</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_gain')}</div><div class="btc-cell-v" style="color:var(--mint)">+${s.avg_gain_pct}%</div></div>
    </div>
    <div class="btc-cycle-list">
      ${cycles.map((c, i) => `
        <div class="btc-cycle-row">
          <span class="btc-cycle-num">#${i + 2}</span>
          <div class="btc-cycle-body">
            <div class="btc-cycle-d">${c.ath_date} <span class="btc-cycle-lbl">${c.label}</span></div>
            <div class="btc-cycle-p">$${c.ath_price.toLocaleString('en-US')}</div>
            <div class="btc-cycle-m">+${c.gain_from_prev_pct}% · ${c.days_since_prev}d</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="btc-note">
      ${tm('btc_cycle_now').replace('{d}', String(s.days_since_ath)).replace('{p}', s.pct_to_ath.toFixed(1))}
    </div>
  `;
}

function wireTabs(): void {
  const tabs = document.querySelectorAll<HTMLElement>('.btc-tab');
  const bodies = document.querySelectorAll<HTMLElement>('.btc-tab-body');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.toggle('active', x === t));
    bodies.forEach(b => b.classList.toggle('active', b.dataset.tabBody === t.dataset.tab));
  }));
}

if (typeof window !== 'undefined') {
  Object.assign(window as any, { openBtcOutlook, closeBtcOutlook });
}