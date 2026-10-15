// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SETTINGS (UI)
// Единый sheet настроек: Безопасность / AI / Внешний вид / Система / О программе
// ═══════════════════════════════════════════════════════════════

import { tm, isEN } from '../i18n';
import { esc, toast } from '../utils';
import { openSheet, closeSheet } from './screens';
import {
  saveGroqKey,
  loadGroqKey,
  deleteGroqKey,
} from '../trading';
import {
  hasAppPassword,
  clearAppPassword,
} from '../auth';

// ═══════════════════════════════════════════════════════════════
// ГЛАВНЫЙ SHEET НАСТРОЕК
// ═══════════════════════════════════════════════════════════════

export async function openSettings(): Promise<void> {
  const en = isEN();
  const appPwdOn = hasAppPassword();
  const pwdStatus = appPwdOn ? (en ? 'ON' : 'ВКЛ') : (en ? 'OFF' : 'ВЫКЛ');
  const pwdColor = appPwdOn ? 'var(--mint)' : 'var(--dim)';

  const groqKey = await loadGroqKey();
  let groqStatus: string;
  if (groqKey) {
    groqStatus = `${groqKey.slice(0, 8)}…${groqKey.slice(-4)}`;
  } else {
    groqStatus = en ? 'Not set' : 'Не задан';
  }
  const groqColor = groqKey ? 'var(--mint)' : 'var(--dim)';

  const html = `
    <div class="settings-section">
      <div class="settings-section-title">${en ? '🔐 Security' : '🔐 Безопасность'}</div>
      <button class="settings-row" onclick="toggleAppPassword()">
        <div class="settings-row-icon">🔐</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'App password' : 'Пароль на вход'}</div>
          <div class="settings-row-hint">
            ${appPwdOn
              ? (en ? 'tap to disable' : 'нажми чтобы отключить')
              : (en ? 'tap to enable' : 'нажми чтобы включить')}
          </div>
        </div>
        <div class="settings-row-status" style="color:${pwdColor}">${pwdStatus}</div>
      </button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">🤖 AI</div>
      <button class="settings-row" onclick="openGroqSheet()">
        <div class="settings-row-icon">🤖</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Groq API key' : 'Groq API-ключ'}</div>
          <div class="settings-row-hint">${en ? 'for AI features' : 'для AI-функций'}</div>
        </div>
        <div class="settings-row-status" style="color:${groqColor}">${esc(groqStatus)}</div>
      </button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">${en ? '🎨 Appearance' : '🎨 Внешний вид'}</div>
      <button class="settings-row" onclick="openThemesFromSettings()">
        <div class="settings-row-icon">🎨</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Themes' : 'Темы оформления'}</div>
          <div class="settings-row-hint">${en ? 'choose skin' : 'выбери скин'}</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">${en ? '🩺 System' : '🩺 Система'}</div>
      <button class="settings-row" onclick="openDiagnosticsFromSettings()">
        <div class="settings-row-icon">🩺</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Diagnostics' : 'Диагностика'}</div>
          <div class="settings-row-hint">${en ? 'system check' : 'проверка систем'}</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </button>
      <button class="settings-row" onclick="resetAllKeys()" style="border-color:rgba(255,101,132,.3)">
        <div class="settings-row-icon">🗑️</div>
        <div class="settings-row-body">
          <div class="settings-row-title" style="color:var(--coral)">${en ? 'Reset ALL keys' : 'Сбросить ВСЕ ключи'}</div>
          <div class="settings-row-hint">${en ? 'MEXC + Groq — wipe completely' : 'MEXC + Groq — полное удаление'}</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">${en ? 'ℹ️ About' : 'ℹ️ О программе'}</div>
      <button class="settings-row" onclick="openAboutFromSettings()">
        <div class="settings-row-icon">ℹ️</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${tm('about_title')}</div>
          <div class="settings-row-hint">${en ? 'version, author, disclaimer' : 'версия, автор, дисклеймер'}</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </button>
      <button class="settings-row" onclick="openDonateFromSettings()">
        <div class="settings-row-icon">💎</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Support project' : 'Поддержать проект'}</div>
          <div class="settings-row-hint">USDT TRC-20</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </button>
    </div>
  `;

  openSheet(en ? '⚙️ Settings' : '⚙️ Настройки', html);
  injectSettingsStyles();
}

// ═══════════════════════════════════════════════════════════════
// Groq API-ключ
// ═══════════════════════════════════════════════════════════════

export async function openGroqSheet(): Promise<void> {
  const en = isEN();
  const key = await loadGroqKey();

  const html = `
    <div class="form-row">
      <label class="form-lbl">${tm('ai_key_label')}</label>
      <input class="form-input" type="password" id="groq-key-input" placeholder="gsk_..." value="${esc(key)}">
      <div style="font-size:11px;color:var(--mut);margin-top:6px;line-height:1.5">
        ${tm('ai_key_hint')}
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-top:6px">
      <button class="btn-primary btn-mint" onclick="saveGroqFromSettings()" style="flex:1">
        ${tm('ai_save')}
      </button>
      ${key
        ? `<button class="btn-primary btn-coral" onclick="deleteGroqFromSettings()" style="flex:1">
            ${tm('ai_delete')}
          </button>`
        : ''}
    </div>

    <div style="margin-top:16px;padding:12px;background:rgba(94,203,255,.06);border-left:3px solid var(--cyan);border-radius:8px;font-size:11.5px;color:var(--tx);line-height:1.6">
      ${en
        ? 'Groq provides free AI inference. Get a key at <b>console.groq.com/keys</b> and paste it above. Used for AI mentor and AI command parser.'
        : 'Groq даёт бесплатный AI-инференс. Получи ключ на <b>console.groq.com/keys</b> и вставь выше. Используется для AI-наставника и парсера команд.'}
    </div>
  `;

  openSheet(tm('ai_settings'), html);
  injectSettingsStyles();
}

export async function saveGroqFromSettings(): Promise<void> {
  const en = isEN();

  const inp = document.getElementById('groq-key-input') as HTMLInputElement | null;
  const key = (inp?.value || '').trim();
  if (!key) {
    toast(en ? 'Enter key' : 'Введи ключ', 'warn');
    return;
  }

  const saved = await saveGroqKey(key);
  if (!saved) {
    toast(
      en ? '❌ Storage error (LS and SS both failed)' : '❌ Ошибка записи (LS и SS недоступны)',
      'error', 8000
    );
    return;
  }

  const readBack = await loadGroqKey();

  if (!readBack || readBack !== key) {
    let ls = '';
    let ss = '';
    try { ls = (localStorage.getItem('nebulaGroqKey') || '').slice(0, 60); } catch { /* */ }
    try { ss = (sessionStorage.getItem('nebulaGroqKey') || '').slice(0, 60); } catch { /* */ }

    toast(
      `❌ Не сохранилось!\nLS="${ls}"\nSS="${ss}"`,
      'error', 20000
    );
    console.error('[saveGroq] verify failed:', { readBack, expected: key, ls, ss });
    return;
  }

  toast(en ? '✅ Groq key saved' : '✅ Groq-ключ сохранён', 'success');
  closeSheet();
}

export function deleteGroqFromSettings(): void {
  if (!confirm(isEN() ? 'Delete Groq key?' : 'Удалить Groq-ключ?')) return;
  deleteGroqKey();
  toast(isEN() ? 'Groq key deleted' : 'Groq-ключ удалён', 'info');
  closeSheet();
}

// ═══════════════════════════════════════════════════════════════
// Действия из главного sheet
// ═══════════════════════════════════════════════════════════════

export function openThemesFromSettings(): void {
  closeSheet();
  setTimeout(async () => {
    try {
      const m = await import('./themes');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).openThemeEditor?.();
    } catch (e) {
      console.warn('[settings] openThemeEditor failed:', e);
    }
  }, 150);
}

export function openDiagnosticsFromSettings(): void {
  closeSheet();
  setTimeout(async () => {
    try {
      const m = await import('./diagnostics');
      m.showDiagnosticsModal(true);
      await m.runFullDiagnostics();
    } catch (e) {
      console.warn('[settings] diagnostics failed:', e);
    }
  }, 150);
}

export function openAboutFromSettings(): void {
  closeSheet();
  setTimeout(() => {
    const ov = document.getElementById('about-overlay');
    if (ov) ov.classList.add('open');
  }, 150);
}

export function openDonateFromSettings(): void {
  closeSheet();
  setTimeout(async () => {
    try {
      const m = await import('./terms');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).openDonateModal?.();
    } catch (e) {
      console.warn('[settings] openDonateModal failed:', e);
    }
  }, 150);
}

// ═══════════════════════════════════════════════════════════════
// Пароль на вход — вкл/выкл
// ═══════════════════════════════════════════════════════════════

export function toggleAppPassword(): void {
  const en = isEN();

  if (hasAppPassword()) {
    // Отключаем
    if (!confirm(en
      ? 'Disable app password?\n\nThe app will open without asking for password.'
      : 'Отключить пароль?\n\nПриложение будет открываться без запроса пароля.')) return;

    clearAppPassword();
    toast(en ? 'Password disabled' : 'Пароль отключён', 'success');
    closeSheet();
    setTimeout(() => openSettings(), 250);
  } else {
    // Включаем — открываем окно создания пароля
    closeSheet();
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).openSetPasswordDialog?.();
    }, 250);
  }
}

// ═══════════════════════════════════════════════════════════════
// СБРОС всех ключей
// ═══════════════════════════════════════════════════════════════

export function resetAllKeys(): void {
  const en = isEN();
  const msg = en
    ? 'Delete ALL saved keys (MEXC + Groq)?\n\nThis CANNOT be undone.'
    : 'Удалить ВСЕ сохранённые ключи (MEXC + Groq)?\n\nЭто НЕЛЬЗЯ отменить.';
  if (!confirm(msg)) return;

  try {
    localStorage.removeItem('nebulaConfig');
    localStorage.removeItem('nebulaGroqKey');
    sessionStorage.removeItem('nebulaGroqKey');
  } catch { /* silent */ }

  toast(
    en ? 'Keys deleted' : 'Ключи удалены',
    'success',
    2000
  );

  closeSheet();
}

// ═══════════════════════════════════════════════════════════════
// CSS
// ═══════════════════════════════════════════════════════════════

function injectSettingsStyles(): void {
  if (document.getElementById('settings-styles')) return;

  const style = document.createElement('style');
  style.id = 'settings-styles';
  style.textContent = `
    .settings-section { margin-bottom: 18px; }
    .settings-section:last-child { margin-bottom: 4px; }
    .settings-section-title {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; font-weight: 700;
      color: var(--mut);
      text-transform: uppercase; letter-spacing: 1.4px;
      margin-bottom: 8px; padding-left: 4px;
    }
    .settings-row {
      display: flex; align-items: center; gap: 12px;
      width: 100%; padding: 14px 14px;
      background: rgba(0,0,0,.35);
      border: 1px solid var(--border);
      border-radius: var(--r-sm);
      color: var(--hi); cursor: pointer;
      transition: background .15s, border-color .15s, transform .1s;
      text-align: left; margin-bottom: 6px;
      font-family: inherit;
    }
    .settings-row:last-child { margin-bottom: 0; }
    .settings-row:active { transform: scale(.985); background: rgba(94,203,255,.08); border-color: var(--border-hi); }
    .settings-row:hover { background: rgba(94,203,255,.05); border-color: rgba(94,203,255,.25); }
    .settings-row-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; flex-shrink: 0;
    }
    .settings-row-body { flex: 1; min-width: 0; }
    .settings-row-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px; font-weight: 700;
      color: var(--hi); letter-spacing: .2px;
      margin-bottom: 2px;
    }
    .settings-row-hint {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; color: var(--mut);
      letter-spacing: .3px;
    }
    .settings-row-status {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px; font-weight: 600;
      letter-spacing: .4px; flex-shrink: 0;
      padding: 4px 8px; border-radius: 6px;
      background: rgba(0,0,0,.35);
    }
    .settings-row-arrow {
      font-size: 20px; color: var(--dim);
      flex-shrink: 0; line-height: 1;
    }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
// ЭКСПОРТ В WINDOW
// ═══════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openSettings,
    openGroqSheet,
    saveGroqFromSettings,
    deleteGroqFromSettings,
    openThemesFromSettings,
    openDiagnosticsFromSettings,
    openAboutFromSettings,
    openDonateFromSettings,
    toggleAppPassword,
    resetAllKeys,
  });
}