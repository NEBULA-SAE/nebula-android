import { HUB_DATA, type HubText } from '../data/hub';
import { tm, isEN } from '../i18n';

// Хелпер для перевода текста из базы данных
const tr = (text: HubText | string): string => {
  if (typeof text === 'string') return text;
  return isEN() ? text.en : text.ru;
};

export function openCryptoHub(tab: 'exchanges' | 'learning' | 'tools' = 'exchanges'): void {
  const renderTab = (activeTab: string) => {
    return Object.keys(HUB_DATA).map(key => {
      const isActive = key === activeTab;
      const labels: Record<string, string> = {
        exchanges: `🏦 ${tm('hub_tab_exchanges')}`,
        learning: `🎓 ${tm('hub_tab_learning')}`,
        tools: `🛠 ${tm('hub_tab_tools')}`,
      };
      return `<button class="hub-tab ${isActive ? 'active' : ''}" onclick="openCryptoHub('${key}')">${labels[key]}</button>`;
    }).join('');
  };

  const renderItems = (items: any[]) => {
    return items.map(item => {
      let statusHtml = '';
      if (item.status === 'ru') statusHtml = `<span class="hub-badge ru">🇷🇺 ${tm('hub_status_ru')}</span>`;
      if (item.status === 'vpn') statusHtml = `<span class="hub-badge vpn">⚠️ ${tm('hub_status_vpn')}</span>`;
      if (item.status === 'no') statusHtml = `<span class="hub-badge no">🚫 ${tm('hub_status_no')}</span>`;
      if (item.status === 'global') statusHtml = `<span class="hub-badge global">🌐 ${tm('hub_status_global')}</span>`;

      return `
        <div class="hub-card">
          <a href="${item.url}" target="_blank" rel="noopener noreferrer" class="hub-link">
            <div class="hub-icon">${item.icon}</div>
            <div class="hub-info">
              <div class="hub-name">${item.name}</div>
              <div class="hub-desc">${tr(item.desc)}</div>
            </div>
          </a>
          <div class="hub-actions">
            ${statusHtml}
            <button class="hub-info-btn" onclick="openHubDetails('${item.name}')">ℹ️</button>
          </div>
        </div>
      `;
    }).join('');
  };

  const html = `
    <div class="hub-tabs">
      ${renderTab(tab)}
    </div>
    <div class="hub-list">
      ${renderItems(HUB_DATA[tab])}
    </div>
    <div class="hub-footer">
      ⚠️ ${tm('hub_footer_warn')}
    </div>
  `;

  (window as any).openSheet?.(tm('hub_title'), html);
}

export function openHubDetails(name: string): void {
  let foundItem: any = null;
  for (const category of Object.values(HUB_DATA)) {
    const item = category.find((i: any) => i.name === name);
    if (item) { foundItem = item; break; }
  }
  if (!foundItem || !foundItem.details) return;

  const d = foundItem.details;
  const prosHtml = d.pros.map((p: HubText) => `<li>✅ ${tr(p)}</li>`).join('');
  const consHtml = d.cons.map((c: HubText) => `<li>❌ ${tr(c)}</li>`).join('');

  const html = `
    <div style="text-align:center; margin-bottom:16px;">
      <div style="font-family:'Space Grotesk'; font-size:22px; font-weight:800; color:var(--hi);">${foundItem.name}</div>
      <div style="font-size:11px; color:var(--mut); margin-top:4px;">${tr(foundItem.desc)}</div>
    </div>

    <div style="background:rgba(0,0,0,.3); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:16px;">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-family:'JetBrains Mono', monospace; font-size:11px;">
        <div><span style="color:var(--dim);">${tm('hub_access')}:</span> <span style="color:var(--hi);">${tr(d.access)}</span></div>
        <div><span style="color:var(--dim);">${tm('hub_kyc')}:</span> <span style="color:var(--hi);">${tr(d.kyc)}</span></div>
        <div><span style="color:var(--dim);">${tm('hub_p2p')}:</span> <span style="color:var(--hi);">${tr(d.p2p)}</span></div>
        <div><span style="color:var(--dim);">${tm('hub_fees')}:</span> <span style="color:var(--hi);">${tr(d.fees)}</span></div>
      </div>
    </div>

    <div style="margin-bottom:16px;">
      <div style="font-family:'Space Grotesk'; font-size:13px; font-weight:700; color:var(--mint); margin-bottom:6px;">${tm('hub_pros')}:</div>
      <ul style="margin:0; padding-left:20px; font-size:12px; line-height:1.6; color:var(--tx);">${prosHtml}</ul>
    </div>

    <div style="margin-bottom:16px;">
      <div style="font-family:'Space Grotesk'; font-size:13px; font-weight:700; color:var(--coral); margin-bottom:6px;">${tm('hub_cons')}:</div>
      <ul style="margin:0; padding-left:20px; font-size:12px; line-height:1.6; color:var(--tx);">${consHtml}</ul>
    </div>

    <div style="background:rgba(94,203,255,.05); border-left:3px solid var(--cyan); border-radius:8px; padding:10px; margin-bottom:16px; font-size:12px; line-height:1.5; color:var(--tx);">
      💡 <b>${tm('hub_summary')}:</b> ${tr(d.summary)}
    </div>

    <div style="display:flex; gap:10px; margin-top:10px;">
      <button class="btn-primary" onclick="openCryptoHub()" style="flex:1; background:rgba(255,255,255,.05); color:var(--hi);">
        ⬅️ ${tm('hub_back')}
      </button>
      <button class="btn-primary btn-mint" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="flex:1;">
        ${tm('hub_close')}
      </button>
    </div>
  `;

  (window as any).openSheet?.(`${tm('hub_details_title')} · ${foundItem.name}`, html);
}

if (typeof window !== 'undefined') {
  (window as any).openCryptoHub = openCryptoHub;
  (window as any).openHubDetails = openHubDetails;
}