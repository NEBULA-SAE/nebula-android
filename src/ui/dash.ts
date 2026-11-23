// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · DASH NETWORK (UI)
// Сворачиваемая секция «Сеть Dash» + простые подсказки + переводы
// ═══════════════════════════════════════════════════════════════

import { esc } from '../utils';
import { isEN } from '../i18n';
import { getDashNetworkStats } from '../sources/dash';
import { setModuleSignal } from './master-signal';

const COLLAPSE_KEY = 'nebula_dash_collapsed_v1';
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

let _loading = false;
let _lastLoad = 0;
let _lastData: any = null;

// Хелпер для перевода длинных текстов
const T = (ru: string, en: string): string => (isEN() ? en : ru);

function isCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSE_KEY) !== '0'; } catch { return true; }
}
function setCollapsed(v: boolean): void {
  try { localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0'); } catch { /* silent */ }
}

// ─── Рендер ───

function dashPill(text: string, color: string): string {
  return `<span style="font-size:8.5px;font-weight:700;letter-spacing:0.6px;padding:2px 7px;border-radius:999px;color:${color};border:1px solid ${color};background:rgba(255,255,255,0.05);white-space:nowrap;">${text}</span>`;
}

function fmtDiff(val: number | string): string {
  const n = Number(val);
  if (!Number.isFinite(n)) return esc(String(val));
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function buildDashInsight(d: any): string {
  const parts: string[] = [];

  if (d.masternodes && d.masternodes.total > 0) {
    const pct = (d.masternodes.enabled / d.masternodes.total) * 100;
    const lockedM = ((d.masternodes.enabled * 1000) / 1e6).toFixed(2);
    if (pct >= 75) {
      parts.push(T(`Высокая активность узлов (${pct.toFixed(1)}%) — в сети заперто ~${lockedM}M DASH, фон устойчивый.`, `High node activity (${pct.toFixed(1)}%) — ~${lockedM}M DASH locked, solid network base.`));
    } else if (pct >= 60) {
      parts.push(T(`Активно ${pct.toFixed(1)}% мастернод (~${lockedM}M DASH залочено в узлах).`, `${pct.toFixed(1)}% masternodes active (~${lockedM}M DASH locked in nodes).`));
    } else {
      parts.push(T(`Пониженная доля активных узлов (${pct.toFixed(1)}%) — часть держателей отключила мастерноды.`, `Lower active node share (${pct.toFixed(1)}%) — some holders went offline.`));
    }
  }

  if (d.derivatives) {
    const rate = d.derivatives.funding_rate_pct;
    const oiM = (d.derivatives.open_interest_usd / 1e6).toFixed(1);
    if (rate > 0.05) {
      parts.push(T(`На Bybit лонги перегреты (+${rate.toFixed(4)}%, OI $${oiM}M) — риск коррекции.`, `Bybit longs overheated (+${rate.toFixed(4)}%, OI $${oiM}M) — pullback risk.`));
    } else if (rate < -0.05) {
      parts.push(T(`На Bybit перекос в шорты (${rate.toFixed(4)}%, OI $${oiM}M) — возможен шорт-сквиз.`, `Bybit skewed short (${rate.toFixed(4)}%, OI $${oiM}M) — squeeze risk.`));
    } else {
      parts.push(T(`Деривативы Bybit спокойные (OI $${oiM}M, funding ${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%).`, `Bybit derivatives calm (OI $${oiM}M, funding ${rate >= 0 ? '+' : ''}${rate.toFixed(4)}%).`));
    }
  }

  return parts.length
    ? parts.join(' ')
    : T('Сеть Dash работает в штатном режиме.', 'Dash network is operating normally.');
}

function renderDashContent(d: any): string {
  const en = isEN();
  const cards: string[] = [];

  if (d.masternodes) {
    const m = d.masternodes;
    const pct = m.total > 0 ? Math.min(100, Math.max(0, (m.enabled / m.total) * 100)) : 0;
    const lockedM = ((m.enabled * 1000) / 1e6).toFixed(2);
    const col = pct >= 70 ? 'var(--mint)' : pct >= 55 ? 'var(--amber)' : 'var(--coral)';
    const badge = pct >= 70
      ? dashPill(en ? 'HEALTHY' : 'СТАБИЛЬНО', 'var(--mint)')
      : pct >= 55
        ? dashPill(en ? 'MODERATE' : 'УМЕРЕННО', 'var(--amber)')
        : dashPill(en ? 'LOW' : 'НИЗКО', 'var(--coral)');

    cards.push(`
      <div style="background:linear-gradient(145deg,rgba(45,212,191,0.08),rgba(255,255,255,0.015));border:1px solid rgba(45,212,191,0.24);border-radius:12px;padding:11px 12px;font-family:'JetBrains Mono',monospace;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px;margin-bottom:6px;">
          <span style="color:var(--mut);font-size:9.5px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">🖥️ ${T('Мастерноды', 'Masternodes')}</span>
          ${badge}
        </div>
        <div style="color:${col};font-size:17px;font-weight:800;">${m.enabled} <span style="font-size:11px;color:var(--dim);font-weight:600;">/ ${m.total}</span></div>
        <div style="height:5px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,0.08);margin-top:7px;">
          <div style="width:${pct}%;height:100%;background:${col};border-radius:999px;"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;font-size:9.5px;color:var(--dim);margin-top:7px;">
          <span>${pct.toFixed(1)}% ${T('активны', 'active')}</span>
          <span>·</span>
          <span>~${lockedM}M DASH</span>
          <span>·</span>
          <span>${esc(m.source)}</span>
        </div>
      </div>
    `);
  }

  if (d.mining) {
    const m = d.mining;
    cards.push(`
      <div style="background:linear-gradient(145deg,rgba(94,203,255,0.08),rgba(255,255,255,0.015));border:1px solid rgba(94,203,255,0.24);border-radius:12px;padding:11px 12px;font-family:'JetBrains Mono',monospace;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px;margin-bottom:6px;">
          <span style="color:var(--mut);font-size:9.5px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">⛏️ ${T('Хэшрейт', 'Hashrate')}</span>
          ${dashPill('PoW X11', 'var(--cyan)')}
        </div>
        <div style="color:var(--cyan);font-size:17px;font-weight:800;">${m.hashrate_ph} <span style="font-size:11px;color:var(--dim);font-weight:600;">PH/s</span></div>
        <div style="font-size:10.5px;color:var(--mut);margin-top:6px;">
          ${T('Сложность', 'Difficulty')}: <span style="color:var(--fg,#e6edf3);font-weight:600;">${fmtDiff(m.difficulty)}</span>
        </div>
        <div style="font-size:9.5px;color:var(--dim);margin-top:5px;">
          ${T('Источник', 'Source')}: ${esc(m.source)}
        </div>
      </div>
    `);
  }

  if (d.derivatives) {
    const x = d.derivatives;
    const rate = x.funding_rate_pct;
    const col = rate > 0.05 ? 'var(--coral)' : (rate < -0.05 ? 'var(--mint)' : 'var(--amber)');
    const sign = rate >= 0 ? '+' : '';
    const oiM = (x.open_interest_usd / 1e6).toFixed(1);
    const badge = rate > 0.05
      ? dashPill(en ? 'OVERHEAT' : 'ПЕРЕГРЕВ', 'var(--coral)')
      : rate < -0.05
        ? dashPill(en ? 'SQUEEZE' : 'СКВИЗ', 'var(--mint)')
        : dashPill(en ? 'CALM' : 'НОРМА', 'var(--amber)');

    cards.push(`
      <div style="background:linear-gradient(145deg,rgba(251,191,36,0.07),rgba(255,255,255,0.015));border:1px solid rgba(251,191,36,0.22);border-radius:12px;padding:11px 12px;font-family:'JetBrains Mono',monospace;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;min-height:20px;margin-bottom:6px;">
          <span style="color:var(--mut);font-size:9.5px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">💸 ${T('Фьючерсы Bybit', 'Bybit Futures')}</span>
          ${badge}
        </div>
        <div style="color:var(--fg,#e6edf3);font-size:17px;font-weight:800;">$${oiM}M <span style="font-size:10.5px;color:var(--dim);font-weight:600;">OI</span></div>
        <div style="font-size:10.5px;color:var(--mut);margin-top:6px;">
          Funding: <span style="color:${col};font-weight:700;">${sign}${rate.toFixed(4)}%</span>
        </div>
        <div style="font-size:9.5px;color:var(--dim);margin-top:5px;">
          ${T('Открытый интерес · bybit', 'Open interest · bybit')}
        </div>
      </div>
    `);
  }

  if (!cards.length) {
    return `<div class="empty-msg">${T('Данные Dash недоступны', 'Dash data unavailable')}</div>`;
  }

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const infoText = T(
    'Мастерноды — узлы крупных держателей (по 1 000 DASH каждый): чем их больше, тем больше монет выведено с рынка. Хэшрейт отражает мощность майнеров и защиту сети. Фьючерсы Bybit показывают объём открытого интереса и локальную ставку финансирования.',
    'Masternodes are collateralized nodes (1,000 DASH each): more active nodes mean more supply locked off-market. Hashrate reflects mining security. Bybit futures track open interest and local funding rate.'
  );
  const insight = buildDashInsight(d);
  const mnPct = d.masternodes?.total ? (d.masternodes.enabled / d.masternodes.total) * 100 : 70;
  const fRate = d.derivatives?.funding_rate_pct ?? 0;
  setModuleSignal('dash', fRate > 0.05 || mnPct < 55 ? 'red' : mnPct >= 70 ? 'green' : 'yellow');

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--mut);text-transform:uppercase;letter-spacing:1.2px;">
        <span>🌐</span>
        <span>${T('Ончейн и деривативы', 'On-chain & Derivatives')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <details style="font-family:'JetBrains Mono',monospace;">
          <summary style="list-style:none;cursor:pointer;font-size:9px;color:var(--mut);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:999px;user-select:none;">
            ℹ️ ${en ? 'How it works' : 'Справка'}
          </summary>
          <div style="margin-top:8px;padding:9px 11px;border-radius:10px;background:rgba(15,23,42,0.75);border:1px solid rgba(94,203,255,0.2);font-size:10.5px;line-height:1.45;color:var(--mut);max-width:520px;">
            ${infoText}
          </div>
        </details>
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;color:var(--dim);background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:999px;">
          ${en ? 'Updated' : 'Обновлено'}: ${timeStr}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;">
      ${cards.join('')}
    </div>

    <div style="margin-top:10px;padding:10px 12px;border-radius:11px;background:linear-gradient(90deg,rgba(94,203,255,0.08),rgba(255,255,255,0.02));border:1px solid rgba(94,203,255,0.22);display:flex;align-items:flex-start;gap:9px;">
      <span style="font-size:14px;line-height:1.2;flex-shrink:0;">💡</span>
      <div style="font-size:11.5px;line-height:1.45;color:var(--fg,#e6edf3);">
        <div style="font-family:'JetBrains Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cyan);font-weight:700;margin-bottom:3px;">
          ${en ? 'NETWORK INSIGHT' : 'ИНФО ПО СЕТИ'}
        </div>
        <div>${insight}</div>
      </div>
    </div>
  `;
}

// ─── Загрузка ───

async function loadAndRender(content: HTMLElement, badge: HTMLElement | null): Promise<void> {
  if (_loading) return;

  if (_lastData && Date.now() - _lastLoad < CACHE_TTL) {
    content.innerHTML = renderDashContent(_lastData);
    if (badge) {
      const ok = [_lastData.masternodes, _lastData.mining, _lastData.derivatives].filter(Boolean).length;
      badge.textContent = `${ok}/3 ${T('источника', 'sources')}`;
    }
    return;
  }

  _loading = true;
  content.innerHTML = `<div class="loader">${T('Загрузка сети Dash…', 'Loading Dash network…')}</div>`;
  if (badge) badge.textContent = '…';

  try {
    const d = await getDashNetworkStats();
    _lastData = d;
    _lastLoad = Date.now();

    if (d.status !== 'success') {
      content.innerHTML = `<div class="empty-msg">${T('Сеть Dash недоступна', 'Dash network unavailable')}</div>`;
      if (badge) badge.textContent = T('ошибка', 'error');
      return;
    }
    content.innerHTML = renderDashContent(d);
    if (badge) {
      const ok = [d.masternodes, d.mining, d.derivatives].filter(Boolean).length;
      badge.textContent = `${ok}/3 ${T('источника', 'sources')}`;
    }
  } catch (e: any) {
    console.warn('[dash-ui] failed:', e?.message || e);
    content.innerHTML = `<div class="empty-msg">${T('Ошибка', 'Error')}: ${esc(e?.message || 'unknown')}</div>`;
    if (badge) badge.textContent = T('ошибка', 'error');
  } finally {
    _loading = false;
  }
}

// ─── Публичный вызов ───

export async function refreshDashSection(): Promise<void> {
  const section = document.getElementById('dash-section');
  const content = document.getElementById('dash-network-content');
  const badge = document.getElementById('dash-network-status');
  if (!section || !content) return;

  section.style.display = '';
  
  // Динамический перевод заголовка «Сеть Dash» (он захардкожен в index.html)
  const titleSpan = section.querySelector('.dash-section-title > span:last-child');
  if (titleSpan) titleSpan.textContent = T('Сеть Dash', 'Dash Network');

  if (isCollapsed()) return;

  await loadAndRender(content, badge);
}

// ─── Аккордеон ───

function initDashCollapse(): void {
  const section = document.getElementById('dash-section');
  if (!section) { setTimeout(initDashCollapse, 400); return; }

  const head = section.querySelector('.dash-section-head') as HTMLElement | null;
  const content = document.getElementById('dash-network-content');
  if (!head || !content) { setTimeout(initDashCollapse, 400); return; }

  if (head.dataset.dashInit === '1') {
    const titleSpan = head.querySelector('.dash-section-title > span:last-child');
    if (titleSpan) titleSpan.textContent = T('Сеть Dash', 'Dash Network');
    return;
  }
  head.dataset.dashInit = '1';

  // Курсор и стрелка
  head.style.cursor = 'pointer';
  head.style.userSelect = 'none';

  let toggle = head.querySelector('.dash-toggle') as HTMLElement | null;
  if (!toggle) {
    toggle = document.createElement('span');
    toggle.className = 'dash-toggle';
    toggle.textContent = '▼';
    head.appendChild(toggle);
  }

  const badge = document.getElementById('dash-network-status');

  const apply = (collapsed: boolean) => {
    content.style.display = collapsed ? 'none' : '';
    if (toggle) toggle.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    if (!collapsed) loadAndRender(content, badge);
  };

  head.addEventListener('click', () => {
    const next = !isCollapsed();
    setCollapsed(next);
    apply(next);
  });

  apply(isCollapsed());
}

// ─── Автозапуск ───

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashCollapse, { once: true });
  } else {
    initDashCollapse();
  }
}

if (typeof window !== 'undefined') {
  (window as any).refreshDashSection = refreshDashSection;
}

export const renderDashNetwork = refreshDashSection;