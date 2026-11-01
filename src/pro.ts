import { isEN } from './i18n';
import { toast, state } from './utils';

const API_URL = 'http://85.192.42.177:3000';
const PRO_TOKEN_KEY = 'nebulaProToken';
const HWID_KEY = 'nebulaDeviceHwid';

export interface ProStatus {
  active: boolean;
  type?: string;
  expiresAt?: number;
  message?: string;
}

export function getHardwareId(): string {
  let hwid = localStorage.getItem(HWID_KEY);
  if (!hwid) {
    hwid = crypto.randomUUID();
    localStorage.setItem(HWID_KEY, hwid);
  }
  return hwid;
}

function getPlatform(): 'pc' | 'mobile' {
  if ((window as any).__TAURI__) return 'pc';
  if ((window as any).Capacitor) return 'mobile';
  return 'pc';
}

export function checkLocalProStatus(): ProStatus {
  try {
    const raw = localStorage.getItem(PRO_TOKEN_KEY);
    if (!raw) return { active: false };
    
    const data = JSON.parse(raw);
    if (data.expires_at !== 0 && data.expires_at < Date.now()) {
      localStorage.removeItem(PRO_TOKEN_KEY);
      return { active: false, message: 'Subscription expired' };
    }
    return { active: true, type: data.type, expiresAt: data.expires_at };
  } catch {
    return { active: false };
  }
}

export async function activateProKey(key: string): Promise<{ success: boolean; message: string }> {
  const en = isEN();
  const hwid = getHardwareId();
  const platform = getPlatform();

  try {
    const res = await fetch(`${API_URL}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim(), hwid, platform }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      localStorage.setItem(PRO_TOKEN_KEY, JSON.stringify({
        type: data.type,
        expires_at: data.expires_at,
        hwid: hwid
      }));
      return { success: true, message: en ? 'PRO activated!' : 'PRO успешно активирован!' };
    } else {
      return { success: false, message: data.error || (en ? 'Activation failed' : 'Ошибка активации') };
    }
  } catch (e) {
    return { success: false, message: en ? 'Server unavailable' : 'Сервер недоступен' };
  }
}

export function openProModal(): void {
  const en = isEN();
  const currentStatus = checkLocalProStatus();

  // Если уже активен — показываем статус
  if (currentStatus.active) {
    const expDate = currentStatus.expiresAt === 0 
      ? (en ? 'Lifetime' : 'Навсегда') 
          : new Date(currentStatus.expiresAt || 0).toLocaleDateString();

    const html = `
      <div style="text-align:center; padding: 20px 0;">
        <div style="font-size: 48px; margin-bottom: 10px;">👑</div>
        <div style="font-family:'Space Grotesk'; font-size: 20px; font-weight: 800; color: var(--mint); margin-bottom: 8px;">
          ${en ? 'PRO is Active' : 'PRO активирован'}
        </div>
        <div style="background: rgba(0,0,0,.3); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: left;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
            <span style="color: var(--mut); font-size: 12px;">${en ? 'Status' : 'Статус'}:</span>
            <span style="color: var(--mint); font-weight: bold; font-size: 12px;">ACTIVE 🟢</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color: var(--mut); font-size: 12px;">${en ? 'Valid until' : 'Действует до'}:</span>
            <span style="color: var(--hi); font-weight: bold; font-size: 12px;">${expDate}</span>
          </div>
        </div>
        <button class="btn-primary" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="margin-top: 20px;">
          ${en ? 'Close' : 'Закрыть'}
        </button>
      </div>
    `;
    (window as any).openSheet?.(en ? 'PRO Status' : 'Статус PRO', html);
    return;
  }

  // Если не активен — показываем цены и ввод ключа
  const html = `
    <div style="text-align:center; margin-bottom: 20px;">
      <div style="font-size: 40px; margin-bottom: 10px;">💎</div>
      <div style="font-family:'Space Grotesk'; font-size: 18px; font-weight: 800; color: var(--hi); margin-bottom: 4px;">
        ${en ? 'Unlock PRO Features' : 'Открыть PRO функции'}
      </div>
      <div style="font-size: 12px; color: var(--mut);">
        ${en ? 'Choose a plan or enter an existing key.' : 'Выберите тариф или введите существующий ключ.'}
      </div>
    </div>

    <!-- ТАРИФЫ -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
      <!-- Ранняя пташка -->
      <div style="border: 1px solid var(--mint); border-radius: 12px; padding: 12px; text-align: center; background: rgba(69,224,168,.05); position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; right: 0; background: var(--mint); color: #000; font-size: 8px; font-weight: bold; padding: 2px 8px; border-bottom-left-radius: 8px;">LIMITED 50</div>
        <div style="font-family:'Space Grotesk'; font-size: 11px; color: var(--mint); font-weight: 700; margin-top: 10px;">Early Bird</div>
        <div style="font-family:'Space Grotesk'; font-size: 22px; font-weight: 800; color: var(--hi); margin: 4px 0;">$29</div>
        <div style="font-size: 9px; color: var(--mut);">${en ? 'Lifetime (first 50)' : 'Навсегда (первые 50)'}</div>
      </div>
      <!-- Пожизненный -->
      <div style="border: 1px solid var(--border); border-radius: 12px; padding: 12px; text-align: center; background: rgba(0,0,0,.3);">
        <div style="font-family:'Space Grotesk'; font-size: 11px; color: var(--hi); font-weight: 700; margin-top: 10px;">Lifetime</div>
        <div style="font-family:'Space Grotesk'; font-size: 22px; font-weight: 800; color: var(--hi); margin: 4px 0;">$249</div>
        <div style="font-size: 9px; color: var(--mut);">${en ? 'Regular lifetime' : 'Обычный навсегда'}</div>
      </div>
      <!-- Месяц -->
      <div style="border: 1px solid var(--border); border-radius: 12px; padding: 12px; text-align: center; background: rgba(0,0,0,.3);">
        <div style="font-family:'Space Grotesk'; font-size: 11px; color: var(--hi); font-weight: 700; margin-top: 10px;">Monthly</div>
        <div style="font-family:'Space Grotesk'; font-size: 22px; font-weight: 800; color: var(--hi); margin: 4px 0;">$2.99</div>
        <div style="font-size: 9px; color: var(--mut);">${en ? 'per month' : 'в месяц'}</div>
      </div>
      <!-- Год -->
      <div style="border: 1px solid var(--cyan); border-radius: 12px; padding: 12px; text-align: center; background: rgba(94,203,255,.05);">
        <div style="font-family:'Space Grotesk'; font-size: 11px; color: var(--cyan); font-weight: 700; margin-top: 10px;">Yearly</div>
        <div style="font-family:'Space Grotesk'; font-size: 22px; font-weight: 800; color: var(--hi); margin: 4px 0;">$19.99</div>
        <div style="font-size: 9px; color: var(--mut);">${en ? 'per year (save 45%)' : 'в год (выгода 45%)'}</div>
      </div>
    </div>

    <!-- Кнопка покупки -->
    <a href="https://t.me/ВАШ_ТЕЛЕГРАМ" target="_blank" style="display: block; width: 100%; padding: 12px; background: linear-gradient(135deg, #a78bfa, #5ecbff); color: #000; font-family: 'Space Grotesk'; font-size: 14px; font-weight: 800; border-radius: 12px; text-decoration: none; text-align: center; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(94,203,255,.4);">
      ${en ? '💳 Buy License via Telegram' : '💳 Купить лицензию в Telegram'}
    </a>

    <div style="text-align: center; font-size: 11px; color: var(--mut); margin-bottom: 10px;">
      ${en ? 'Already have a key?' : 'Уже есть ключ?'}
    </div>

    <div class="form-row">
      <input class="form-input" type="text" id="pro-key-input" placeholder="NEB-PRO-XXXX-XXXX" style="text-align: center; font-size: 16px; letter-spacing: 2px; font-weight: bold;">
    </div>

    <button class="btn-primary btn-mint" id="pro-activate-btn" onclick="submitProKey()" style="margin-top: 10px;">
      ${en ? 'Activate Key' : 'Активировать ключ'}
    </button>
  `;

  (window as any).openSheet?.(en ? 'Upgrade to PRO' : 'Подписка PRO', html);
}

export async function submitProKey(): Promise<void> {
  const en = isEN();
  const inp = document.getElementById('pro-key-input') as HTMLInputElement;
  const btn = document.getElementById('pro-activate-btn') as HTMLButtonElement;
  
  if (!inp || !inp.value.trim()) {
    toast(en ? 'Enter key' : 'Введите ключ', 'warn');
    return;
  }

  btn.disabled = true;
  btn.textContent = en ? 'Checking...' : 'Проверка...';

  const res = await activateProKey(inp.value);
  
  btn.disabled = false;
  btn.textContent = en ? 'Activate Key' : 'Активировать ключ';

  if (res.success) {
    toast(res.message, 'success');
    (window as any).closeSheet?.();
    setTimeout(() => location.reload(), 1000);
  } else {
    toast(res.message, 'error', 4000);
  }
}

// Экспорт в window
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openProModal,
    submitProKey,
    checkLocalProStatus
  });
}