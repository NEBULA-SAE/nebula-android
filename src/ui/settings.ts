// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SETTINGS (UI) — v2 (sync-first)
// ═══════════════════════════════════════════════════════════════

import { tm, isEN } from '../i18n';
import { esc, toast, setHTML } from '../utils';
import { openSheet, closeSheet } from './screens';
import {
  saveGroqKey,
  loadGroqKey,
  deleteGroqKey,
} from '../crypto';
import {
  hasAppPassword,
  clearAppPassword,
  getOrCreateUserId,
  enableBiometrics,
  disableBiometrics,
  checkBiometricsAvailable,
  isBiometricsSupported,
} from '../auth';
import { saveKeys, loadKeys, deleteKeys } from '../trading';

interface SettingsData {
  pwdOn: boolean;
  bioSupported: boolean;
  bioOn: boolean;
  groqStatus: string;
  groqColor: string;
  kucoinOn: boolean;
  mexcOn: boolean;
}

function buildSettingsHTML(d: SettingsData): string {
  const en = isEN();

  const pwdStatus = d.pwdOn ? (en ? 'ON' : 'ВКЛ') : (en ? 'OFF' : 'ВЫКЛ');
  const pwdColor = d.pwdOn ? 'var(--mint)' : 'var(--dim)';

  const bioStatus = d.bioOn ? (en ? 'ON' : 'ВКЛ') : (en ? 'OFF' : 'ВЫКЛ');
  const bioColor = d.bioOn ? 'var(--mint)' : 'var(--dim)';

  const kucoinStatus = d.kucoinOn ? (en ? 'ON' : 'ВКЛ') : (en ? 'OFF' : 'ВЫКЛ');
  const kucoinColor = d.kucoinOn ? 'var(--mint)' : 'var(--dim)';

  const mexcStatus = d.mexcOn ? (en ? 'ON' : 'ВКЛ') : (en ? 'OFF' : 'ВЫКЛ');
  const mexcColor = d.mexcOn ? 'var(--mint)' : 'var(--dim)';

  return `
    <div class="settings-section">
      <div class="settings-section-title">${en ? '🔐 Security' : '🔐 Безопасность'}</div>
      <button class="settings-row" onclick="toggleAppPassword()">
        <div class="settings-row-icon">🔐</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'App password' : 'Пароль на вход'}</div>
          <div class="settings-row-hint">
            ${d.pwdOn
              ? (en ? 'tap to disable' : 'нажми чтобы отключить')
              : (en ? 'tap to enable' : 'нажми чтобы включить')}
          </div>
        </div>
        <div class="settings-row-status" style="color:${pwdColor}">${pwdStatus}</div>
      </button>

      ${d.bioSupported ? `
      <button class="settings-row" onclick="setupBiometrics()">
        <div class="settings-row-icon">👆</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Biometric login' : 'Вход по отпечатку'}</div>
          <div class="settings-row-hint">${en ? 'FaceID / TouchID' : 'FaceID / Отпечаток'}</div>
        </div>
        <div class="settings-row-status" style="color:${bioColor}">${bioStatus}</div>
      </button>
      ` : ''}
    </div>

    <div class="settings-section">
      <div class="settings-section-title">🤖 AI</div>
      <button class="settings-row" onclick="openGroqSheet()">
        <div class="settings-row-icon">🤖</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Groq API key' : 'Groq API-ключ'}</div>
          <div class="settings-row-hint">${en ? 'for AI features' : 'для AI-функций'}</div>
        </div>
        <div class="settings-row-status" style="color:${d.groqColor}">${esc(d.groqStatus)}</div>
      </button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">${en ? '💹 Exchange API' : '💹 API бирж'}</div>

      <button class="settings-row" onclick="openExchangeSheet('mexc')">
        <div class="settings-row-icon">💠</div>
        <div class="settings-row-body">
          <div class="settings-row-title">MEXC</div>
          <div class="settings-row-hint">${en ? 'API Key / Secret' : 'API Key / Secret'}</div>
        </div>
        <div class="settings-row-status" style="color:${mexcColor}">${mexcStatus}</div>
      </button>

      <button class="settings-row" onclick="openExchangeSheet('kucoin')">
        <div class="settings-row-icon">💹</div>
        <div class="settings-row-body">
          <div class="settings-row-title">KuCoin</div>
          <div class="settings-row-hint">${en ? 'API Key / Secret / Passphrase' : 'API Key / Secret / Passphrase'}</div>
        </div>
        <div class="settings-row-status" style="color:${kucoinColor}">${kucoinStatus}</div>
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
      <div class="settings-section-title">${en ? '💬 Community' : '💬 Сообщество'}</div>

      <button class="settings-row" onclick="openSupportChat()">
        <div class="settings-row-icon">🆘</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Contact support' : 'Написать в поддержку'}</div>
          <div class="settings-row-hint">${en ? 'Telegram · reply in 24h' : 'Telegram · ответ за 24ч'}</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </button>

      <button class="settings-row" onclick="openCommunityChat()">
        <div class="settings-row-icon">💬</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Community chat' : 'Чат сообщества'}</div>
          <div class="settings-row-hint">${en ? 'Talk with traders' : 'Общение трейдеров'}</div>
        </div>
        <div class="settings-row-arrow">›</div>
      </button>

      <button class="settings-row" onclick="openFunChat()">
        <div class="settings-row-icon">🏀</div>
        <div class="settings-row-body">
          <div class="settings-row-title">${en ? 'Fun & Memes' : 'Развлечения'}</div>
          <div class="settings-row-hint">${en ? 'Memes, offtop' : 'Мемы, оффтоп'}</div>
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
          <div class="settings-row-hint">${en ? 'MEXC + KuCoin + Groq' : 'MEXC + KuCoin + Groq'}</div>
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
}

export function openSettings(): void {
  const en = isEN();

  // 1. Открываем СРАЗУ с базовыми данными (без await!)
  openSheet(en ? '⚙️ Settings' : '⚙️ Настройки', buildSettingsHTML({
    pwdOn: hasAppPassword(),
    bioSupported: false,
    bioOn: false,
    groqStatus: '...',
    groqColor: 'var(--dim)',
    kucoinOn: false,
    mexcOn: false,
  }));
  injectSettingsStyles();

  // 2. Потом подгружаем async-данные и перерисовываем
  void (async () => {
    try {
      const bioSupported = isBiometricsSupported();
      const bioOn = !!localStorage.getItem('nebulaBiometricPwd');

      let groqStatus = en ? 'Not set' : 'Не задан';
      let groqColor = 'var(--dim)';
      try {
        const groqKey = await loadGroqKey();
        if (groqKey) {
          groqStatus = `${groqKey.slice(0, 8)}…${groqKey.slice(-4)}`;
          groqColor = 'var(--mint)';
        }
      } catch (e) { console.warn('[settings] groq load:', e); }

      let kucoinOn = false;
      try {
        const kk = await loadKeys('kucoin');
        kucoinOn = !!(kk.api && kk.secret && kk.passphrase);
      } catch (e) { console.warn('[settings] kucoin load:', e); }

      let mexcOn = false;
      try {
        const mk = await loadKeys('mexc');
        mexcOn = !!(mk.api && mk.secret);
      } catch (e) { console.warn('[settings] mexc load:', e); }

      // Перерисовываем body с реальными данными
      setHTML('sheet-body', buildSettingsHTML({
        pwdOn: hasAppPassword(),
        bioSupported,
        bioOn,
        groqStatus,
        groqColor,
        kucoinOn,
        mexcOn,
      }));
    } catch (e) {
      console.warn('[settings] async load failed:', e);
    }
  })();
}

// ═══════════════════════════════════════════════════════════════
// ОСТАЛЬНЫЕ ФУНКЦИИ — без изменений
// ═══════════════════════════════════════════════════════════════

export async function setupBiometrics(): Promise<void> {
  const en = isEN();
  if (!isBiometricsSupported()) {
    toast(en ? 'Biometrics not supported' : 'Биометрия не поддерживается', 'warn');
    return;
  }
  if (!hasAppPassword()) {
    toast(en ? 'Set app password first' : 'Сначала установите пароль на вход', 'warn');
    return;
  }
  if (localStorage.getItem('nebulaBiometricPwd')) {
    if (confirm(en ? 'Disable biometric login?' : 'Отключить вход по отпечатку?')) {
      await disableBiometrics();
      closeSheet();
      setTimeout(() => openSettings(), 250);
    }
    return;
  }
  const success = await enableBiometrics();
  if (success) {
    localStorage.removeItem('nebulaBiometricRejected');
    closeSheet();
    setTimeout(() => openSettings(), 250);
  }
}

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
  if (!key) { toast(en ? 'Enter key' : 'Введи ключ', 'warn'); return; }
  const saved = await saveGroqKey(key);
  if (!saved) {
    toast(en ? '❌ Error: password required to encrypt keys' : '❌ Ошибка: введите пароль для шифрования', 'error', 5000);
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

export async function openExchangeSheet(exchange: 'mexc' | 'kucoin'): Promise<void> {
  const en = isEN();
  const keys = await loadKeys(exchange);
  const isKucoin = exchange === 'kucoin';
  const title = isKucoin ? 'KuCoin API' : 'MEXC API';

  const passphraseField = isKucoin ? `
    <div class="form-row">
      <label class="form-lbl">Passphrase</label>
      <input class="form-input" type="password" id="ex-passphrase" placeholder="..." value="${esc((keys as any).passphrase || '')}">
      <div style="font-size:11px;color:var(--mut);margin-top:6px;">
        ${en ? 'Set when creating the API key on KuCoin' : 'Задаётся при создании API-ключа на KuCoin'}
      </div>
    </div>` : '';

  const html = `
    <div class="form-row">
      <label class="form-lbl">API Key</label>
      <input class="form-input" type="password" id="ex-api" placeholder="..." value="${esc(keys.api)}">
    </div>
    <div class="form-row">
      <label class="form-lbl">API Secret</label>
      <input class="form-input" type="password" id="ex-secret" placeholder="..." value="${esc(keys.secret)}">
    </div>
    ${passphraseField}

    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-primary btn-mint" onclick="saveExchangeKeys('${exchange}')" style="flex:1">
        ${en ? 'Save' : 'Сохранить'}
      </button>
      <button class="btn-primary btn-coral" onclick="deleteExchangeKeys('${exchange}')" style="flex:1">
        ${en ? 'Delete' : 'Удалить'}
      </button>
    </div>

    <div style="margin-top:16px;padding:12px;background:rgba(94,203,255,.06);border-left:3px solid var(--cyan);border-radius:8px;font-size:11.5px;color:var(--tx);line-height:1.6">
      ${isKucoin
        ? (en
            ? 'Create API key at <b>kucoin.com</b> → API Management. Enable "General" + "Spot Trading" permissions. Make sure to save the <b>Passphrase</b> — it\'s not shown again.'
            : 'Создай API-ключ на <b>kucoin.com</b> → API Management. Дай права "General" + "Spot Trading". Обязательно сохрани <b>Passphrase</b> — он больше не покажется.')
        : (en
            ? 'Create API key at <b>mexc.com</b> → API Management. Enable "Spot Trading" permissions.'
            : 'Создай API-ключ на <b>mexc.com</b> → API Management. Дай права "Spot Trading".')}
    </div>
  `;

  openSheet(title, html);
  injectSettingsStyles();
}

export async function saveExchangeKeys(exchange: 'mexc' | 'kucoin'): Promise<void> {
  const en = isEN();
  const api = (document.getElementById('ex-api') as HTMLInputElement)?.value.trim() || '';
  const secret = (document.getElementById('ex-secret') as HTMLInputElement)?.value.trim() || '';
  const passEl = document.getElementById('ex-passphrase') as HTMLInputElement | null;
  const passphrase = passEl ? passEl.value.trim() : '';

  if (!api || !secret) {
    toast(en ? 'Fill API Key and Secret' : 'Заполни API Key и Secret', 'warn');
    return;
  }
  if (exchange === 'kucoin' && !passphrase) {
    toast(en ? 'Passphrase is required for KuCoin' : 'Для KuCoin нужен Passphrase', 'warn');
    return;
  }

  const ok = await saveKeys(exchange, api, secret, passphrase || undefined);
  if (!ok) {
    toast(en ? '❌ Error: password required to encrypt keys' : '❌ Ошибка: введите пароль для шифрования', 'error', 5000);
    return;
  }

  toast(en ? `✅ ${exchange.toUpperCase()} keys saved` : `✅ Ключи ${exchange.toUpperCase()} сохранены`, 'success');
  closeSheet();
  setTimeout(() => openSettings(), 250);
}

export async function deleteExchangeKeys(exchange: 'mexc' | 'kucoin'): Promise<void> {
  const en = isEN();
  if (!confirm(en ? `Delete ${exchange.toUpperCase()} keys?` : `Удалить ключи ${exchange.toUpperCase()}?`)) return;
  await deleteKeys(exchange);
  toast(en ? 'Keys deleted' : 'Ключи удалены', 'info');
  closeSheet();
  setTimeout(() => openSettings(), 250);
}

export function openThemesFromSettings(): void {
  closeSheet();
  setTimeout(async () => {
    try {
      const m = await import('./themes');
      (m as any).openThemeEditor?.();
    } catch (e) { console.warn('[settings] openThemeEditor failed:', e); }
  }, 150);
}

export function openDiagnosticsFromSettings(): void {
  closeSheet();
  setTimeout(async () => {
    try {
      const m = await import('./diagnostics');
      m.showDiagnosticsModal(true);
      await m.runFullDiagnostics();
    } catch (e) { console.warn('[settings] diagnostics failed:', e); }
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
      (m as any).openDonateModal?.();
    } catch (e) { console.warn('[settings] openDonateModal failed:', e); }
  }, 150);
}

export function openSupportChat(): void {
  try {
    const userId = getOrCreateUserId();
    const url = `https://t.me/NebulaTerminalBot?start=${userId}`;
    const w = window as any;
    if (w.__TAURI_INTERNALS__) {
      import('@tauri-apps/plugin-opener').then((m) => m.openUrl(url)).catch(() => window.open(url, '_blank'));
    } else {
      window.open(url, '_blank');
    }
  } catch {
    window.open('https://t.me/NebulaTerminalBot', '_blank');
  }
}

export function toggleAppPassword(): void {
  const en = isEN();
  if (hasAppPassword()) {
    if (!confirm(en ? 'Disable app password?\n\nWARNING: This will make your API keys unreadable!' : 'Отключить пароль?\n\nВНИМАНИЕ: Это сделает ваши API-ключи нечитаемыми!')) return;
    clearAppPassword();
    toast(en ? 'Password disabled. Reload app.' : 'Пароль отключён. Перезагрузите.', 'success');
    closeSheet();
    setTimeout(() => location.reload(), 1000);
  } else {
    closeSheet();
    toast(en ? 'Reload page to set password' : 'Перезагрузите страницу для установки пароля', 'info', 3000);
    setTimeout(() => location.reload(), 500);
  }
}

export function resetAllKeys(): void {
  const en = isEN();
  const msg = en
    ? 'Delete ALL saved keys (MEXC + KuCoin + Groq)?\n\nThis CANNOT be undone.'
    : 'Удалить ВСЕ сохранённые ключи (MEXC + KuCoin + Groq)?\n\nЭто НЕЛЬЗЯ отменить.';
  if (!confirm(msg)) return;
  try {
    localStorage.removeItem('nebulaConfig');
    localStorage.removeItem('nebulaGroqKey');
    sessionStorage.removeItem('nebulaGroqKey');
  } catch { /* silent */ }
  toast(en ? 'Keys deleted' : 'Ключи удалены', 'success', 2000);
  closeSheet();
}

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

function openExternalUrl(url: string): void {
  const w = window as any;
  if (w.__TAURI_INTERNALS__) {
    import('@tauri-apps/plugin-opener').then((m) => m.openUrl(url)).catch(() => window.open(url, '_blank'));
  } else {
    window.open(url, '_blank');
  }
}

export function openCommunityChat(): void {
  openExternalUrl('https://t.me/c/4375017338/19');
}

export function openFunChat(): void {
  openExternalUrl('https://t.me/c/4375017338/24');
}

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openSettings,
    openGroqSheet,
    saveGroqFromSettings,
    deleteGroqFromSettings,
    openExchangeSheet,
    saveExchangeKeys,
    deleteExchangeKeys,
    openThemesFromSettings,
    openDiagnosticsFromSettings,
    openAboutFromSettings,
    openDonateFromSettings,
    openSupportChat,
    openCommunityChat,
    openFunChat,
    toggleAppPassword,
    setupBiometrics,
    resetAllKeys,
  });
}