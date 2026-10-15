// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · AUTH
// Простой пароль для входа в приложение (не шифрование!)
// Хранится SHA-256 хеш в localStorage. Проверка при запуске.
// ═══════════════════════════════════════════════════════════════

import { toast } from './utils';

const AUTH_KEY = 'nebulaAppPasswordHash';

let _mode: 'setup' | 'unlock' = 'unlock';
let _resolve: ((ok: boolean) => void) | null = null;
let _attempts = 0;
let _blockedUntil = 0;

// ─── Хеш пароля ───

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode('nebula:auth:' + text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Публичное API ───

export function hasAppPassword(): boolean {
  try { return !!localStorage.getItem(AUTH_KEY); } catch { return false; }
}

export async function setAppPassword(pwd: string): Promise<void> {
  const hash = await sha256(pwd);
  localStorage.setItem(AUTH_KEY, hash);
}

export function clearAppPassword(): void {
  try { localStorage.removeItem(AUTH_KEY); } catch { /* silent */ }
}

export async function verifyAppPassword(pwd: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (!stored) return true;
    const hash = await sha256(pwd);
    return hash === stored;
  } catch { return false; }
}

// ─── UI ───

function showAppLock(): void {
  const ov = document.getElementById('app-lock-overlay');
  const title = document.getElementById('al-title');
  const desc = document.getElementById('al-desc');
  const inp = document.getElementById('al-input') as HTMLInputElement | null;
  const inp2 = document.getElementById('al-input2') as HTMLInputElement | null;
  const confRow = document.getElementById('al-confirm-row');
  const err = document.getElementById('al-error');
  const skip = document.getElementById('al-skip');
  const btn = document.getElementById('al-submit') as HTMLButtonElement | null;

  if (!ov || !inp) return;

  inp.value = '';
  if (inp2) inp2.value = '';
  if (err) { err.style.display = 'none'; err.innerHTML = ''; }
  if (btn) { btn.disabled = false; btn.textContent = _mode === 'setup' ? 'Создать' : 'Войти'; }

  if (_mode === 'setup') {
    if (title) title.textContent = '🔐 Создай пароль';
    if (desc) desc.textContent = 'Установи пароль для входа в NEBULA. Он не шифрует данные — просто не пускает посторонних в приложение.';
    if (confRow) confRow.style.display = '';
    if (skip) skip.style.display = '';
  } else {
    if (title) title.textContent = '🔐 Вход в NEBULA';
    if (desc) desc.textContent = 'Введи пароль для продолжения.';
    if (confRow) confRow.style.display = 'none';
    if (skip) skip.style.display = 'none';
  }

  ov.classList.add('open');
  setTimeout(() => inp.focus(), 150);
}

function hideAppLock(): void {
  const ov = document.getElementById('app-lock-overlay');
  if (ov) ov.classList.remove('open');
}

export async function appLockSubmit(): Promise<void> {
  const inp = document.getElementById('al-input') as HTMLInputElement | null;
  const inp2 = document.getElementById('al-input2') as HTMLInputElement | null;
  const err = document.getElementById('al-error');
  const btn = document.getElementById('al-submit') as HTMLButtonElement | null;

  const pwd = (inp?.value || '').trim();

  if (pwd.length < 4) {
    if (err) {
      err.style.display = 'block';
      err.innerHTML = '<span style="color:var(--coral)">Минимум 4 символа</span>';
    }
    return;
  }

  // ─── SETUP ───
  if (_mode === 'setup') {
    const pwd2 = (inp2?.value || '').trim();
    if (pwd !== pwd2) {
      if (err) {
        err.style.display = 'block';
        err.innerHTML = '<span style="color:var(--coral)">Пароли не совпадают</span>';
      }
      return;
    }
    await setAppPassword(pwd);
    hideAppLock();
    toast('✅ Пароль установлен', 'success');
    const r = _resolve; _resolve = null;
    if (r) r(true);
    return;
  }

  // ─── UNLOCK ───
  const now = Date.now();
  if (now < _blockedUntil) {
    const sec = Math.ceil((_blockedUntil - now) / 1000);
    if (err) {
      err.style.display = 'block';
      err.innerHTML = `<span style="color:var(--coral)">Подожди ${sec} сек</span>`;
    }
    return;
  }

  if (btn) btn.disabled = true;
  const ok = await verifyAppPassword(pwd);
  if (btn) btn.disabled = false;

  if (ok) {
    _attempts = 0;
    hideAppLock();
    const r = _resolve; _resolve = null;
    if (r) r(true);
  } else {
    _attempts++;
    if (_attempts >= 5) {
      _blockedUntil = Date.now() + 30_000;
      _attempts = 0;
      if (err) {
        err.style.display = 'block';
        err.innerHTML = '<span style="color:var(--coral)">Слишком много попыток. Подожди 30 сек.</span>';
      }
    } else {
      if (err) {
        err.style.display = 'block';
        err.innerHTML = `<span style="color:var(--coral)">Неверный пароль (${5 - _attempts} попыток)</span>`;
      }
    }
    if (inp) inp.value = '';
  }
}

export function appLockSkip(): void {
  // Разрешено только в setup-режиме
  if (_mode !== 'setup') return;
  hideAppLock();
  toast('Приложение работает без пароля', 'info');
  const r = _resolve; _resolve = null;
  if (r) r(true);
}

/**
 * Главная функция — вызывается при старте.
 * Возвращает промис, который резолвится после входа (или setup).
 */
export function requireAppPassword(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!hasAppPassword()) {
      _mode = 'setup';
    } else {
      _mode = 'unlock';
    }
    _resolve = resolve;
    showAppLock();
  });
}

// ─── Установка / смена / удаление из настроек ───

export function openSetPasswordDialog(): void {
  _mode = hasAppPassword() ? 'unlock' : 'setup';
  _resolve = null;
  showAppLock();
}

export function openChangePasswordDialog(): void {
  _mode = 'setup'; // после ввода старого пароля? — упрощённо: просто задать новый
  _resolve = null;
  showAppLock();
}

// ─── Экспорт в window ───

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    requireAppPassword,
    appLockSubmit,
    appLockSkip,
    hasAppPassword,
    setAppPassword,
    clearAppPassword,
    verifyAppPassword,
  });
}