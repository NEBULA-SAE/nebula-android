// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · DASH NETWORK (UI)
// Отрисовка секции «Сеть Dash» внутри whale-card
// Сам следит за появлением #dash-section и сам грузит данные
// ═══════════════════════════════════════════════════════════════

import { esc } from '../utils';
import { getDashNetworkStats } from '../sources/dash';

function renderDashContent(d: any): string {
  let html = '';

  if (d.masternodes) {
    const m = d.masternodes;
    const pct = m.total > 0 ? (m.enabled / m.total) * 100 : 0;
    html += `
      <div class="dash-net-row">
        <div class="dash-net-icon">🖥️</div>
        <div class="dash-net-body">
          <div class="dash-net-label">Мастерноды</div>
          <div class="dash-net-value">
            ${m.enabled} / ${m.total}
            <span class="dash-net-sub">(${pct.toFixed(1)}% активны · ${esc(m.source)})</span>
          </div>
          <div class="dash-net-hint">Рост = крупные холдеры накапливают DASH</div>
        </div>
      </div>`;
  }

  if (d.mining) {
    const m = d.mining;
    html += `
      <div class="dash-net-row">
        <div class="dash-net-icon">⛏️</div>
        <div class="dash-net-body">
          <div class="dash-net-label">Хэшрейт сети</div>
          <div class="dash-net-value">
            ${m.hashrate_ph} PH/s
            <span class="dash-net-sub">сложность ${m.difficulty} · ${esc(m.source)}</span>
          </div>
        </div>
      </div>`;
  }

  if (d.derivatives) {
    const x = d.derivatives;
    const rate = x.funding_rate_pct;
    const cls = rate > 0.05 ? 'dash-net-coral' : (rate < -0.05 ? 'dash-net-mint' : 'dash-net-mut');
    const sign = rate >= 0 ? '+' : '';
    const oiM = (x.open_interest_usd / 1e6).toFixed(1);
    html += `
      <div class="dash-net-row">
        <div class="dash-net-icon">💸</div>
        <div class="dash-net-body">
          <div class="dash-net-label">Funding rate</div>
          <div class="dash-net-value">
            <span class="${cls}">${sign}${rate.toFixed(4)}%</span>
            <span class="dash-net-sub">OI: $${oiM}M · bybit</span>
          </div>
        </div>
      </div>`;
  }

  if (!html) html = `<div class="empty-msg">Данные Dash недоступны</div>`;
  return html;
}

let _loading = false;

export async function refreshDashSection(): Promise<void> {
  if (_loading) return;
  const section = document.getElementById('dash-section');
  const content = document.getElementById('dash-network-content');
  const badge = document.getElementById('dash-network-status');
  if (!section || !content) return;

  _loading = true;
  section.style.display = '';
  content.innerHTML = `<div class="loader">Загрузка сети Dash…</div>`;
  if (badge) badge.textContent = '';

  try {
    const d = await getDashNetworkStats();
    if (d.status !== 'success') {
      content.innerHTML = `<div class="empty-msg">Сеть Dash недоступна</div>`;
      if (badge) badge.textContent = 'ошибка';
      return;
    }
    content.innerHTML = renderDashContent(d);
    if (badge) {
      const ok = [d.masternodes, d.mining, d.derivatives].filter(Boolean).length;
      badge.textContent = `${ok}/3 источника`;
    }
  } catch (e: any) {
    console.warn('[dash-ui] failed:', e?.message || e);
    content.innerHTML = `<div class="empty-msg">Ошибка: ${esc(e?.message || 'unknown')}</div>`;
    if (badge) badge.textContent = 'ошибка';
  } finally {
    _loading = false;
  }
}

// ─── Авто-обнаружение: как только whale-card становится видимым — грузим ───

function watchWhaleCard(): void {
  const whaleCard = document.getElementById('whale-card');
  if (!whaleCard) return;

  let loaded = false;

  const tryLoad = () => {
    if (loaded) return;
    const visible = whaleCard.style.display !== 'none' && whaleCard.offsetParent !== null;
    if (visible) {
      loaded = true;
      refreshDashSection();
    }
  };

  const mo = new MutationObserver(tryLoad);
  mo.observe(whaleCard, { attributes: true, attributeFilter: ['style', 'class'] });

  // Плюс первый чек на случай, если карточка уже видима
  setTimeout(tryLoad, 100);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', watchWhaleCard, { once: true });
  } else {
    watchWhaleCard();
  }
}

if (typeof window !== 'undefined') {
  (window as any).refreshDashSection = refreshDashSection;
}
// Алиас для обратной совместимости (init.ts и oracle.ts вызывают renderDashNetwork)
export const renderDashNetwork = refreshDashSection;