// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · AUTH
// Единый пароль + Нативная биометрия (только Android)
// ═══════════════════════════════════════════════════════════════

import { toast } from './utils';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const APP_PWD_HASH = 'nebulaAppPasswordHash';
const BIOMETRIC_SAVED_PWD = 'nebulaBiometricPwd';
const BIOMETRIC_REJECTED = 'nebulaBiometricRejected';
const SESSION_PWD = 'nebula_session_pwd';

let _currentPassword: string | null = null;

export function getAuthPassword(): string | null {
  if (_currentPassword) return _currentPassword;
  try {
    const sess = sessionStorage.getItem(SESSION_PWD);
    if (sess) {
      _currentPassword = sess;
      return sess;
    }
  } catch { /* silent */ }
  return null;
}

export function hasAppPassword(): boolean {
  return !!localStorage.getItem(APP_PWD_HASH);
}

export function clearAppPassword(): void {
  localStorage.removeItem(APP_PWD_HASH);
  localStorage.removeItem(BIOMETRIC_SAVED_PWD);
  localStorage.removeItem(BIOMETRIC_REJECTED);
  localStorage.removeItem('nebulaConfig');
  localStorage.removeItem('nebulaGroqKey');
  sessionStorage.removeItem(SESSION_PWD);
  _currentPassword = null;
}

export function getOrCreateUserId(): string {
  let id = localStorage.getItem('nebula_user_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    localStorage.setItem('nebula_user_id', id);
  }
  return id;
}

async function hashPwd(pwd: string): Promise<string> {
  const msg = new TextEncoder().encode(pwd + 'NEBULA_SALT_2025');
  const hash = await crypto.subtle.digest('SHA-256', msg);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Биометрия (только Android) ───

export function isBiometricsSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function checkBiometricsAvailable(): Promise<boolean> {
  if (!isBiometricsSupported()) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function enableBiometrics(): Promise<boolean> {
  if (!getAuthPassword()) {
    toast('Сначала войдите в приложение', 'warn');
    return false;
  }

  if (!isBiometricsSupported()) {
    toast('Биометрия не поддерживается на этом устройстве', 'warn');
    return false;
  }

  try {
    await NativeBiometric.setCredentials({
      username: 'nebula_user',
      password: getAuthPassword()!,
      server: 'com.nebula.oracle',
    });

    localStorage.setItem(BIOMETRIC_SAVED_PWD, '1');
    localStorage.removeItem(BIOMETRIC_REJECTED);
    toast('Вход по отпечатку включен', 'success');
    return true;
  } catch (e: any) {
    console.warn('[auth] biometrics setup failed', e);
    toast('Не удалось настроить биометрию: ' + (e.message || 'ошибка'), 'error');
    return false;
  }
}

// ⚡️ ДОБАВЛЕНО: Функция для полного удаления биометрии
export async function disableBiometrics(): Promise<void> {
  try {
    if (isBiometricsSupported()) {
      await NativeBiometric.deleteCredentials({ server: 'com.nebula.oracle' });
    }
  } catch (e) {
    console.warn('[auth] failed to delete native credentials', e);
  }
  localStorage.removeItem(BIOMETRIC_SAVED_PWD);
  toast('Вход по отпечатку отключен', 'info');
}

async function tryBiometricLogin(): Promise<boolean> {
  if (!isBiometricsSupported()) return false;
  if (localStorage.getItem(BIOMETRIC_SAVED_PWD) !== '1') return false;

  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Вход в NEBULA',
      title: 'NEBULA',
      subtitle: 'Подтвердите личность',
      description: 'Приложите палец или посмотрите в камеру',
    });

    const credentials = await NativeBiometric.getCredentials({
      server: 'com.nebula.oracle',
    });

    if (credentials.password) {
      _currentPassword = credentials.password;
      sessionStorage.setItem(SESSION_PWD, _currentPassword);
      return true;
    }
    return false;
  } catch (e: any) {
    console.warn('[auth] biometric verify failed', e);
    return false;
  }
}

// ─── ИНИЦИАЛИЗАЦИЯ ВХОДА ───

export async function initAuth(): Promise<void> {
  if (getAuthPassword()) return;

  const savedHash = localStorage.getItem(APP_PWD_HASH);

  return new Promise((resolve) => {
    const overlay = document.getElementById('app-lock-overlay') as HTMLDivElement;
    if (!overlay) { resolve(); return; }

    const input = document.getElementById('al-input') as HTMLInputElement;
    const input2 = document.getElementById('al-input2') as HTMLInputElement;
    const btnSubmit = document.getElementById('al-submit') as HTMLButtonElement;
    const btnBio = document.getElementById('al-biometric') as HTMLButtonElement;
    const btnReset = document.getElementById('al-reset') as HTMLButtonElement;
    const err = document.getElementById('al-error') as HTMLDivElement;
    const title = document.getElementById('al-title') as HTMLHeadingElement;
    const desc = document.getElementById('al-desc') as HTMLParagraphElement;
    const confirmRow = document.getElementById('al-confirm-row') as HTMLDivElement;

    input.value = '';
    input2.value = '';
    err.style.display = 'none';

    if (!savedHash) {
      title.textContent = '🔐 Создать пароль';
      desc.textContent = 'Придумай пароль. Он будет использоваться для шифрования API-ключей.';
      confirmRow.style.display = 'block';
      btnBio.style.display = 'none';
      btnReset.style.display = 'none';
    } else {
      title.textContent = '🔐 Вход в NEBULA';
      desc.textContent = 'Введи пароль для разблокировки.';
      confirmRow.style.display = 'none';
      btnReset.style.display = 'block';

      if (localStorage.getItem(BIOMETRIC_SAVED_PWD) === '1' && isBiometricsSupported()) {
        btnBio.style.display = 'block';
      } else {
        btnBio.style.display = 'none';
      }
    }

    overlay.classList.add('open');
    setTimeout(() => input.focus(), 200);

    btnReset.onclick = () => {
      if (confirm('Сбросить пароль? ВСЕ сохраненные API-ключи будут удалены навсегда.')) {
        clearAppPassword();
        toast('Пароль сброшен', 'info');
        location.reload();
      }
    };

    btnSubmit.onclick = async () => {
      const pwd = input.value.trim();

      if (pwd.length < 4) {
        err.style.display = 'block';
        err.innerHTML = '<span style="color:var(--coral)">Минимум 4 символа</span>';
        return;
      }

      btnSubmit.disabled = true;
      err.style.display = 'none';

      try {
        if (!savedHash) {
          const pwd2 = input2.value.trim();
          if (pwd !== pwd2) {
            err.style.display = 'block';
            err.innerHTML = '<span style="color:var(--coral)">Пароли не совпадают</span>';
            btnSubmit.disabled = false;
            return;
          }

          const hash = await hashPwd(pwd);
          localStorage.setItem(APP_PWD_HASH, hash);
          _currentPassword = pwd;
          sessionStorage.setItem(SESSION_PWD, pwd);

          const bioRejected = localStorage.getItem(BIOMETRIC_REJECTED) === '1';
          if (isBiometricsSupported() && !bioRejected) {
            const bioAvail = await checkBiometricsAvailable();
            if (bioAvail) {
              if (confirm('Включить вход по отпечатку пальца / Face ID?')) {
                await enableBiometrics();
              } else {
                localStorage.setItem(BIOMETRIC_REJECTED, '1');
              }
            }
          }

          unlockApp();

        } else {
          const hash = await hashPwd(pwd);
          if (hash === savedHash) {
            _currentPassword = pwd;
            sessionStorage.setItem(SESSION_PWD, pwd);
            unlockApp();
          } else {
            err.style.display = 'block';
            err.innerHTML = '<span style="color:var(--coral)">Неверный пароль</span>';
            btnSubmit.disabled = false;
          }
        }
      } catch (e) {
        err.style.display = 'block';
        err.innerHTML = '<span style="color:var(--coral)">Ошибка проверки</span>';
        btnSubmit.disabled = false;
      }
    };

    btnBio.onclick = async () => {
      const success = await tryBiometricLogin();
      if (success) {
        unlockApp();
      } else {
        toast('Биометрия не пройдена. Введите пароль.', 'error');
      }
    };

    function unlockApp() {
      overlay.classList.remove('open');
      resolve();
    }

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btnSubmit.click();
    });
    input2.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btnSubmit.click();
    });
  });
}