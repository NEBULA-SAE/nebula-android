import { WHITE_PAPER } from '../data/info';
import { isEN } from '../i18n';
import { tm } from '../i18n';

function renderPartnerCard(p: any): string {
  // Заглушка, если нет картинки логотипа
  const logoHtml = `
    <div style="width:44px; height:44px; border-radius:10px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
      <img src="${p.logoUrl}" style="width:100%; height:100%; object-fit:cover;" 
           onerror="this.style.display='none'; this.parentElement.innerHTML='<span style=\\'font-family:Space Grotesk; font-weight:700; color:var(--cyan); font-size:16px;\\'>${p.name.slice(0,2).toUpperCase()}</span>';">
    </div>
  `;

  return `
    <div style="display:flex; align-items:center; gap:12px; background:rgba(0,0,0,.3); padding:10px; border-radius:10px; border:1px solid var(--border); margin-bottom:8px;">
      ${logoHtml}
      <div>
        <div style="font-family:'Space Grotesk', sans-serif; font-size:14px; font-weight:700; color:var(--hi);">${p.name}</div>
        <div style="font-family:'JetBrains Mono', monospace; font-size:9.5px; color:var(--cyan); text-transform:uppercase; letter-spacing:.5px; margin-top:2px;">${p.role}</div>
      </div>
    </div>
  `;
}

export function openWhitePaper(): void {
  const wp = WHITE_PAPER;

  const creatorsHtml = wp.creators.map(c => `
    <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px dashed rgba(255,255,255,.05);">
      <span style="color:var(--mut); font-size:12px;">${c.role}</span>
      <span style="color:var(--hi); font-weight:600; font-size:12px;">${c.name}</span>
    </div>
  `).join('');

  const partnersHtml = wp.partners.length > 0 
    ? wp.partners.map(renderPartnerCard).join('')
    : `<div style="font-size:12px; color:var(--dim);">${tm('wp_no_partners')}</div>`;

  const html = `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-family:'Space Grotesk', sans-serif; font-size:22px; font-weight:800; color:var(--hi); letter-spacing:1px;">${wp.appName}</div>
      <div style="font-family:'JetBrains Mono', monospace; font-size:11px; color:var(--cyan); margin-top:4px;">${wp.version} · ${wp.releaseDate}</div>
    </div>

    <!-- Главная картинка-баннер -->
    <img src="/images/partners-main.jpg" style="width:100%; border-radius:12px; margin-bottom:20px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);" onerror="this.style.display='none'">

    <div style="background:linear-gradient(135deg, rgba(94,203,255,.1), rgba(167,139,250,.05)); border:1px solid rgba(94,203,255,.2); border-radius:12px; padding:14px; margin-bottom:20px;">
      <div style="font-family:'Space Grotesk', sans-serif; font-size:13px; font-weight:700; color:var(--cyan); margin-bottom:6px;">${tm('wp_mission')}</div>
      <div style="font-size:12.5px; line-height:1.6; color:var(--tx);">${wp.mission}</div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="color:var(--hi); font-family:'Space Grotesk'; font-size:13px; font-weight:700; margin-bottom:8px;">${tm('wp_partners')}</div>
      ${partnersHtml}
    </div>

    <div style="margin-bottom:20px;">
      <div style="color:var(--hi); font-family:'Space Grotesk'; font-size:13px; font-weight:700; margin-bottom:8px;">${tm('wp_creators')}</div>
      <div style="background:rgba(0,0,0,.2); border:1px solid var(--border); border-radius:10px; padding:10px 14px;">
        ${creatorsHtml}
      </div>
    </div>

    <div style="margin-bottom:20px;">
      <div style="color:var(--hi); font-family:'Space Grotesk'; font-size:13px; font-weight:700; margin-bottom:8px;">${tm('wp_investors')}</div>
      <div style="font-size:11.5px; color:var(--dim); font-style:italic; margin-top:8px;">${tm('wp_open_invest')}</div>
    </div>

    <div style="text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid var(--border); opacity:0.5;">
      <div style="font-family:'JetBrains Mono', monospace; font-size:9px; color:var(--mut);">
        ${tm('wp_built_with')}
      </div>
    </div>

    <button class="btn-primary btn-mint" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="margin-top:20px;">
      ${tm('wp_close')}
    </button>
  `;

  (window as any).openSheet?.(tm('wp_title'), html);
}

if (typeof window !== 'undefined') {
  (window as any).openWhitePaper = openWhitePaper;
}