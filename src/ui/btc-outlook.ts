// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · BTC OUTLOOK UI
// ═══════════════════════════════════════════════════════════════

import { tm } from '../i18n';
import { state } from '../utils';
import { fetchCandlesWithSource } from '../sources/candles';
import { toast } from '../utils';
import { calcRsiSimple } from '../indicators';
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

  const ticker = (state as any).currentTicker || 'BTC';

  try {
    const [daily, weekly] = await Promise.all([
      fetchCandlesWithSource(ticker, '1d').then(r => r.data),
      fetchCandlesWithSource(ticker, 'max').then(r => r.data).catch(() => []),
    ]);

    if (!daily || daily.length < 2) {
      box.innerHTML = `<div class="btc-err">Недостаточно данных для ${ticker}</div>`;
      return;
    }

    const price = daily[daily.length - 1].close;
    const prevPrice = daily[daily.length - 2].close;
    const change = ((price - prevPrice) / prevPrice) * 100;
    const rsi = calcRsiSimple(daily.map(c => c.close), 14);

    // Загружаем описание и ссылки
    let desc = 'Актив на криптовалютном рынке.';
    let links: any = {};
    try {
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
      }
    } catch (e) { /* ignore */ }

    const stats = computeBreakoutStats(price, weekly);
    const prob = computeBreakoutProbability(weekly, stats.pct_to_ath);
    const cycles = analyzeCycles();
    const today = new Date();
    const cal = computeCalendarComparison(weekly, today.getMonth() + 1, today.getDate());

    applyBtcGlow(change);

    box.innerHTML = html({ price, change_24h: change, rsi, advice: desc }, stats, prob, cycles, cal, ticker, links);
    wireTabs();
  } catch (e: any) {
    box.innerHTML = `<div class="btc-err">${e.message || 'Error'}</div>`;
  }
}

function html(btc: any, s: any, p: any, cycles: any[], cal: any[], ticker: string = 'BTC', links: any = {}): string {
  const chg = btc.change_24h || 0;
  const chgColor = chg >= 0 ? 'var(--mint)' : 'var(--coral)';
  const chgSign = chg >= 0 ? '+' : '';
  const atAth = s.pct_to_ath < 0.5;

  const linkBtns = `
    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
      ${links.homepage?.[0] ? `<a href="${links.homepage[0]}" target="_blank" style="background:rgba(255,255,255,.1); padding:6px 12px; border-radius:6px; font-size:11px; color:var(--hi); text-decoration:none;">🌐 Сайт</a>` : ''}
      ${links.twitter ? `<a href="${links.twitter}" target="_blank" style="background:rgba(29,161,242,.2); padding:6px 12px; border-radius:6px; font-size:11px; color:#1DA1F2; text-decoration:none;">𝕏 Twitter</a>` : ''}
      ${links.telegram ? `<a href="${links.telegram}" target="_blank" style="background:rgba(41,171,226,.2); padding:6px 12px; border-radius:6px; font-size:11px; color:#29A9E2; text-decoration:none;">✈️ Telegram</a>` : ''}
    </div>
  `;

  return `
  <div class="btc-head">
    <div class="btc-head-info">
      <div class="btc-head-lbl">${ticker} OUTLOOK · ${new Date().toLocaleDateString('ru-RU')}</div>
      <div class="btc-head-price">$${btc.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}</div>
      <div class="btc-head-chg" style="color:${chgColor}">${chgSign}${chg.toFixed(2)}%</div>
    </div>
    <button class="btc-close" onclick="closeBtcOutlook()">✕</button>
  </div>

  <div class="btc-tabs">
    <button class="btc-tab active" data-tab="snap">${tm('btc_tab_snap')}</button>
    <button class="btc-tab" data-tab="about">О проекте</button>
    <button class="btc-tab" data-tab="break">${tm('btc_tab_break')}</button>
    <button class="btc-tab" data-tab="cal">${tm('btc_tab_cal')}</button>
  </div>

  <div class="btc-tab-body active" data-tab-body="snap">
    ${renderSnap(btc, s, atAth, ticker)}
  </div>
  
  <div class="btc-tab-body" data-tab-body="about">
    <div class="btc-note" style="font-size:13px; line-height:1.6; color:var(--tx);">
      ${btc.advice || 'Описание недоступно.'}
    </div>
    ${linkBtns}
  </div>

  <div class="btc-tab-body" data-tab-body="break">
    ${renderBreak(p, s)}
  </div>
  
  <div class="btc-tab-body" data-tab-body="cal">
    ${renderCal(cal, ticker)}
  </div>

  <div class="btc-foot">${tm('btc_foot_warn')}</div>
  `;
}

function renderSnap(btc: any, s: any, atAth: boolean, ticker: string = 'BTC'): string {
  return `
    <div class="btc-grid4">
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_rsi')}</div><div class="btc-cell-v">${btc.rsi.toFixed(1)}</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_ath')}</div><div class="btc-cell-v" style="color:var(--amber)">$${s.current_ath.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_to_ath')}</div><div class="btc-cell-v" style="color:${atAth ? 'var(--mint)' : 'var(--coral)'}">${s.pct_to_ath.toFixed(1)}%</div></div>
      <div class="btc-cell"><div class="btc-cell-l">${tm('btc_days')}</div><div class="btc-cell-v">${s.days_since_ath}</div></div>
    </div>

    <div class="btc-note">${btc.advice}</div>

    ${atAth
      ? `<div class="btc-banner mint">🚀 ${ticker} ${tm('btc_at_ath').replace('BTC', '')}</div>`
      : `<div class="btc-banner amber">${ticker} ${tm('btc_below').replace('BTC', '')} <b>${s.pct_to_ath.toFixed(1)}%</b></div>`}

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

function renderCal(cal: any[], ticker: string = 'BTC'): string {
  if (!cal.length) return `<div class="btc-empty">${tm('btc_no_data')}</div>`;

  const rows = cal.slice().reverse();
  const athYears = rows.filter(r => r.had_ath_nearby).length;

  return `
    <div class="btc-cal-head">
      <div class="btc-cal-title">${tm('btc_cal_title').replace('BTC', ticker)}</div>
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

export async function initCoinOutlookInline(ticker: string, candles: any[], extra?: any): Promise<void> {
  const box = document.getElementById('btc-outlook-inline');
  if (!box) return;

  const isPro = await isProUser();
  if (!isPro) {
    box.innerHTML = `
      <div class="btc-pro-lock" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; text-align:center; padding: 20px;">
        <div style="font-size: 28px; margin-bottom: 8px;">💎</div>
        <div style="font-family: 'Space Grotesk', sans-serif; font-weight: 700; color: var(--hi); margin-bottom: 4px;">${ticker} Outlook PRO</div>
        <div style="font-size: 11px; color: var(--mut); margin-bottom: 16px; max-width: 200px;">Историческая аналитика доступна по подписке</div>
        <button class="btn-primary btn-mint" onclick="openProModal()" style="width: auto; padding: 8px 20px; font-size: 11px;">Открыть PRO</button>
      </div>
    `;
    return;
  }

  if (!candles || candles.length < 100) {
     box.innerHTML = `<div class="btc-empty" style="text-align:center; padding: 20px;">Недостаточно данных для ${ticker}</div>`;
     return;
  }

  try {
    const price = candles[candles.length - 1].close;
    const stats = computeBreakoutStats(price, candles);
    const prob = computeBreakoutProbability(candles, stats.pct_to_ath);
    const cal = computeCalendarComparison(candles, new Date().getMonth() + 1, new Date().getDate());

    const finalPrice = extra?.price || price;
    const finalRsi = extra?.rsi || 50;
    const finalChange = extra?.change_24h || 0;

    const liveDesc = extra?.desc || 'Актив на криптовалютном рынке.';
    const liveLinks = extra?.links || {};

    box.innerHTML = html({ 
      price: finalPrice, 
      change_24h: finalChange, 
      rsi: finalRsi, 
      advice: liveDesc 
    }, stats, prob, [], cal, ticker, liveLinks);
    
    const tabs = box.querySelectorAll<HTMLElement>('.btc-tab');
    const bodies = box.querySelectorAll<HTMLElement>('.btc-tab-body');
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('active', x === t));
      bodies.forEach(b => b.classList.toggle('active', b.dataset.tabBody === t.dataset.tab));
    }));

  } catch (e: any) {
    box.innerHTML = `<div class="btc-err" style="text-align:center; padding:20px; color:var(--coral);">Ошибка: ${e.message}</div>`;
  }
}

if (typeof window !== 'undefined') {
  Object.assign(window as any, { openBtcOutlook, closeBtcOutlook, initCoinOutlookInline });
}