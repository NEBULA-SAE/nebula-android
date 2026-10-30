// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · DASH NETWORK (UI)
// Сворачиваемая секция «Сеть Dash» + простые подсказки + переводы
// ═══════════════════════════════════════════════════════════════

import { esc } from '../utils';
import { isEN } from '../i18n';
import { getDashNetworkStats } from '../sources/dash';

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

function react(text: string): string {
  const label = isEN() ? 'How to react:' : 'Как реагировать:';
  return `<div class="dash-net-react">💡 <b>${label}</b> ${text}</div>`;
}

function renderDashContent(d: any): string {
  let html = '';

  if (d.masternodes) {
    const m = d.masternodes;
    const pct = m.total > 0 ? (m.enabled / m.total) * 100 : 0;
    html += `
      <div class="dash-net-row">
        <div class="dash-net-icon">🖥️</div>
        <div class="dash-net-body">
          <div class="dash-net-label">${T('Мастерноды (узлы сети)', 'Masternodes (network nodes)')}</div>
          <div class="dash-net-value">
            ${m.enabled} ${T('из', 'of')} ${m.total} ${T('работают', 'active')}
            <span class="dash-net-sub">(${pct.toFixed(1)}% ${T('активны', 'active')} · ${esc(m.source)})</span>
          </div>
          <div class="dash-net-hint">
            <span class="pc-only">${T('Крупные держатели DASH, которые держат узлы и получают награду. Чем больше мастернод — тем больше денег «заперто» в сети.', 'Large DASH holders who run nodes and earn rewards. More masternodes = more money "locked" in the network.')}</span>
            <span class="mobile-only">${T('Узлы крупных держателей. Больше узлов = больше денег заперто.', 'Nodes of big holders. More nodes = more money locked.')}</span>
          </div>
          ${react(
            `<span class="pc-only">${T('Растёт — фон бычий, крупные накапливают. Резко падает — кто-то выходит, повод насторожиться.', 'Growing — bullish background, big players are accumulating. Sharp drop — someone is exiting, a reason to be cautious.')}</span>
             <span class="mobile-only">${T('📈 Рост = накапливают. 📉 Падение = выходят.', '📈 Growth = accumulating. 📉 Drop = exiting.')}</span>`
          )}
        </div>
      </div>`;
  }

  if (d.mining) {
    const m = d.mining;
    html += `
      <div class="dash-net-row">
        <div class="dash-net-icon">⛏️</div>
        <div class="dash-net-body">
          <div class="dash-net-label">${T('Хэшрейт (мощность майнеров)', 'Hashrate (miners power)')}</div>
          <div class="dash-net-value">
            ${m.hashrate_ph} PH/s
            <span class="dash-net-sub">${T('сложность', 'difficulty')} ${m.difficulty} · ${esc(m.source)}</span>
          </div>
          <div class="dash-net-hint">
            <span class="pc-only">${T('Сколько вычислительной мощности защищает сеть. Выше — сеть надёжнее и майнеры верят в DASH.', 'How much computing power secures the network. Higher — the network is more reliable and miners believe in DASH.')}</span>
            <span class="mobile-only">${T('Мощность майнеров. Защита сети.', 'Miners power. Network security.')}</span>
          </div>
          ${react(
            `<span class="pc-only">${T('Резкое падение хэшрейта = майнеры уходят, возможна слабость. Рост — сеть укрепляется.', 'Sharp hashrate drop = miners leaving, weakness possible. Growth — the network is getting stronger.')}</span>
             <span class="mobile-only">${T('📉 Падение = слабость. 📈 Рост = сила.', '📉 Drop = weakness. 📈 Growth = strength.')}</span>`
          )}
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
          <div class="dash-net-label">${T('Funding rate (ставка за перенос позиции)', 'Funding rate (position holding fee)')}</div>
          <div class="dash-net-value">
            <span class="${cls}">${sign}${rate.toFixed(4)}%</span>
            <span class="dash-net-sub">${T('Открытый интерес', 'Open interest')}: $${oiM}M · bybit</span>
          </div>
          <div class="dash-net-hint">
            <span class="pc-only">${T('Плюс — лонги платят шортам (рынок перегрет в лонг). Минус — шорты платят лонгам (возможен шорт-сквиз). Открытый интерес — сколько денег в фьючерсах DASH.', 'Positive — longs pay shorts (market overheated in longs). Negative — shorts pay longs (short squeeze possible). Open interest — how much money is in DASH futures.')}</span>
            <span class="mobile-only">${T('Ставка за перенос. Показывает перекос позиций.', 'Holding fee. Shows position skew.')}</span>
          </div>
          ${react(
            `<span class="pc-only">${T('> +0.05% — лонги перегреты, осторожно с покупкой. < −0.05% — возможен резкий рост (сквиз). Рост OI = новые деньги, движение усилится.', '> +0.05% — longs overheated, be careful with buying. < −0.05% — sharp rise (squeeze) possible. OI growth = new money, move will intensify.')}</span>
             <span class="mobile-only">${T('⚠️ >+0.05% = перегрев лонгов. ⚡ <−0.05% = шорт-сквиз.', '⚠️ >+0.05% = long overheat. ⚡ <−0.05% = short squeeze.')}</span>`
          )}
        </div>
      </div>`;
  }

  if (!html) html = `<div class="empty-msg">${T('Данные Dash недоступны', 'Dash data unavailable')}</div>`;
  return html;
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
  const titleSpan = section.querySelector('.dash-section-title span');
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
    const titleSpan = head.querySelector('.dash-section-title span');
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