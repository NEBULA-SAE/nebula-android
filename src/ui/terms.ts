// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · TERMS & ABOUT
// Порт из js/terms.js — соглашение + модалка "О программе"
// ═══════════════════════════════════════════════════════════════

import { toast } from '../utils';
import { keysStatus, checkMasterPassword } from '../trading';

const TERMS_KEY = 'nebula_terms_accepted_v1';

// ═══ PUBLIC API ═══

export function acceptTerms(): void {
  try { localStorage.setItem(TERMS_KEY, '1'); } catch { /* silent */ }

  const ov = document.getElementById('terms-overlay');
  if (ov) ov.classList.remove('open');

  toast('Спасибо! Приятной работы 🚀', 'success', 2000);

  // После принятия соглашения — проверяем мастер-пароль
  setTimeout(() => {
    try { checkMasterPassword(); } catch { /* silent */ }
  }, 400);
}

export function showAbout(): void {
  const ov = document.getElementById('about-overlay');
  if (ov) ov.classList.add('open');

  // Обновить статус пароля
  (async () => {
    try {
      const st = await keysStatus();
      const el = document.getElementById('about-pwd-status');
      if (!el) return;
      let txt = '';
      if (st.unlocked) txt = '✅ открыт в сессии';
      else if (st.config_encrypted || st.groq_encrypted) txt = '🔒 зашифрован, требуется unlock';
      else txt = '⚠️ НЕ зашифрован — установи пароль';
      el.textContent = 'статус: ' + txt;
    } catch { /* silent */ }
  })();
}

export function hideAbout(): void {
  const ov = document.getElementById('about-overlay');
  if (ov) ov.classList.remove('open');
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
  } else {
    // Соглашение уже принято — сразу проверяем мастер-пароль
    try { checkMasterPassword(); } catch { /* silent */ }
  }
}

// ═══ АВТОЗАПУСК ═══

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(checkTerms, 4500), { once: true });
  } else {
    setTimeout(checkTerms, 4500);
  }
}

// ═══ Экспорт в window для inline-обработчиков ═══

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    acceptTerms,
    showAbout,
    hideAbout,
  });
}