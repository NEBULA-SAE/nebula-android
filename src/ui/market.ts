// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MARKET PULSE (UI)
// Порт openMarketPulse из js/ui.js
// ═══════════════════════════════════════════════════════════════

import { setHTML } from '../utils';
import { tm } from '../i18n';
import { esc } from '../utils';
import { openSheet } from './screens';
import { getMarketContext } from '../market';

export async function openMarketPulse(): Promise<void> {
  openSheet(tm('market'), `<div class="loader">${tm('loading')}</div>`);

  try {
    const d = await getMarketContext();
    if (d.status !== 'success') {
      setHTML('sheet-body', `<div class="empty-msg">${tm('error')}</div>`);
      return;
    }

    const cardClass = d.regime_color || 'amber';
    const fng = d.fear_greed || 50;

    let html = `
      <div class="regime-card ${cardClass}">
        <div class="regime-title">${(d.regime || '').toUpperCase().replace('_', ' ')}</div>
        <div class="regime-desc">${esc(d.regime_desc || '')}</div>
      </div>
      <div class="mp-grid">
        <div class="mp-stat">
          <div class="mp-stat-lbl">${tm('mp_mcap')}</div>
          <div class="mp-stat-val">$${((d.total_mcap || 0) / 1e12).toFixed(2)}T</div>
          <div class="mp-stat-sub" style="color:${(d.mcap_change_24h || 0) >= 0 ? 'var(--mint)' : 'var(--coral)'}">${(d.mcap_change_24h || 0) >= 0 ? '+' : ''}${(d.mcap_change_24h || 0).toFixed(2)}%</div>
        </div>
        <div class="mp-stat"><div class="mp-stat-lbl">${tm('mp_btc_dom')}</div><div class="mp-stat-val">${d.btc_dominance || 0}%</div></div>
        <div class="mp-stat"><div class="mp-stat-lbl">${tm('mp_eth_dom')}</div><div class="mp-stat-val">${d.eth_dominance || 0}%</div></div>
        <div class="mp-stat"><div class="mp-stat-lbl">${tm('mp_vol')}</div><div class="mp-stat-val">$${((d.total_vol || 0) / 1e9).toFixed(1)}B</div></div>
      </div>
      <div class="fng-wrap">
        <div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--hi);margin-bottom:8px">${tm('mp_fng')}</div>
        <div class="fng-bar"><div class="fng-needle" style="left:${fng}%"></div></div>
        <div class="fng-scale"><span>${tm('fear')}</span><span>${tm('neutral')}</span><span>${tm('greed')}</span></div>
        <div class="fng-center">
          <span class="fng-value">${fng}</span>
          <span class="fng-text">${esc(d.fear_greed_text || '')}</span>
        </div>
      </div>`;

    if (d.sentiment_warning) {
      html += `<div style="padding:12px;background:rgba(255,184,88,.08);border-left:3px solid var(--amber);border-radius:8px;font-size:12px;color:var(--tx);margin-bottom:12px">${esc(d.sentiment_warning)}</div>`;
    }

    html += `<div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--hi);margin:12px 0 8px">${tm('mp_trending')}</div>`;

    if (d.trending && d.trending.length > 0) {
      html += d.trending.map((x: any) => `
        <div class="trending-item">
          <div class="trending-rank">#${x.rank || '?'}</div>
          <div><span class="trending-name">${esc(x.name)}</span><span class="trending-sym">${esc(x.symbol)}</span></div>
          <div style="color:var(--amber)">🔥</div>
        </div>`).join('');
    } else {
      html += `<div class="empty-msg">N/A</div>`;
    }

    setHTML('sheet-body', html);
  } catch (e: any) {
    setHTML('sheet-body', `<div class="empty-msg">${tm('error')}: ${e.message}</div>`);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') {
  (window as any).openMarketPulse = openMarketPulse;
}