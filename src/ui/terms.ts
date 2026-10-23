// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · TERMS & ABOUT
// Порт из js/terms.js — соглашение + модалка "О программе"
// ═══════════════════════════════════════════════════════════════

import { toast } from '../utils';

const TERMS_KEY = 'nebula_terms_accepted_v1';

// ─── Крипто-адреса для донатов ───
const DONATE_ADDRESSES = {
  usdt: 'TD2JBdBdW6jHrXwg8EPcAsV2ZKn8XEi4Zd', // USDT TRC-20
};

// ═══ PUBLIC API ═══

export function acceptTerms(): void {
  try { localStorage.setItem(TERMS_KEY, '1'); } catch { /* silent */ }

  const ov = document.getElementById('terms-overlay');
  if (ov) ov.classList.remove('open');

  toast('Спасибо! Приятной работы 🚀', 'success', 2000);
}

export function showAbout(): void {
  const ov = document.getElementById('about-overlay');
  if (ov) ov.classList.add('open');
}

export function hideAbout(): void {
  const ov = document.getElementById('about-overlay');
  if (ov) ov.classList.remove('open');
}

// ─── Донаты ───

export function copyDonate(): void {
  const addr = DONATE_ADDRESSES.usdt;
  navigator.clipboard.writeText(addr).then(() => {
    toast('✅ USDT-адрес скопирован', 'success', 2000);
  }).catch(() => {
    // fallback для WebView
    const ta = document.createElement('textarea');
    ta.value = addr;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('✅ USDT-адрес скопирован', 'success', 2000);
    } catch {
      toast('Не удалось скопировать', 'error');
    }
    document.body.removeChild(ta);
  });
}

export function openDonateModal(): void {
  const addr = DONATE_ADDRESSES.usdt;
  // QR через публичный API (без установки библиотек)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(addr)}&bgcolor=0a0f1f&color=5ecbff&margin=8`;

  const html = `
    <div style="text-align:center; padding: 8px 0;">
      <div style="font-size:42px; margin-bottom:10px;">💎</div>
      <div style="font-family:'Space Grotesk'; font-size:16px; font-weight:700; color:var(--mint); margin-bottom:12px;">
        Поддержать NEBULA
      </div>
      <div style="font-size:12px; color:var(--mut); line-height:1.55; margin-bottom:16px;">
        NEBULA — бесплатный проект одного разработчика.<br>
        Если приложение полезно — можешь поддержать разработку.
      </div>

      <div style="display:inline-block; padding:10px; background:rgba(0,0,0,.5); border:1px solid var(--border); border-radius:14px; margin-bottom:14px;">
        <img src="${qrUrl}" alt="QR USDT"
             style="width:220px; height:220px; display:block; border-radius:6px; image-rendering: pixelated;"
             onerror="this.style.display='none'">
      </div>

      <div style="font-family:'JetBrains Mono',monospace; font-size:9.5px; color:var(--dim); letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">
        USDT · TRC-20 (Tron)
      </div>

      <div style="font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--hi);
                  background:rgba(0,0,0,.55); border:1px solid rgba(140,170,220,.12);
                  border-radius:8px; padding:10px 12px; word-break:break-all; line-height:1.5; margin-bottom:14px;">
        ${addr}
      </div>

      <button class="btn-primary btn-mint" onclick="copyDonate()" style="margin-bottom:8px;">
        📋 Скопировать адрес
      </button>

      <div style="font-size:10.5px; color:var(--coral); margin-top:12px; line-height:1.5;">
        ⚠️ Отправляй только USDT в сети Tron (TRC-20).<br>
        Другая сеть = потеря средств.
      </div>

      <div style="font-size:10.5px; color:var(--mut); margin-top:14px;">
        Спасибо за поддержку ❤️
      </div>
    </div>
  `;

  hideAbout();

  setTimeout(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).openSheet?.('💎 Поддержать проект', html);
  }, 80);
}

// ═══ ПРОВЕРКА СОГЛАШЕНИЯ ═══

function showTerms(): void {
  const ov = document.getElementById('terms-overlay');
  if (ov) ov.classList.add('open');
}

function checkTerms(): void {
  let accepted: string | null = null;
  try { accepted = localStorage.getItem(TERMS_KEY); } catch { /* silent */ }

  if (accepted !== '1') {
    showTerms();
  }
}

// ═══ АВТОЗАПУСК ═══

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(checkTerms, 2000), { once: true });
  } else {
    setTimeout(checkTerms, 2000);
  }
}

// ═══ Экспорт в window ═══

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    acceptTerms,
    showAbout,
    hideAbout,
    copyDonate,
    openDonateModal,
  });
}