// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · THEMES UI — список + редактор
// ═══════════════════════════════════════════════════════════════

import { isEN } from '../i18n';
import { toast, esc } from '../utils';
import {
  loadThemes,
  applyTheme,
  getActiveThemeId,
  saveCustomTheme,
  deleteCustomTheme,
  createThemeFromColors,
  submitTheme,
  getAllThemes,
  type Theme,
} from '../themes';

// ═══ СПИСОК ТЕМ ═══

export async function openThemeEditor(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).openSheet?.(
    isEN() ? '🎨 Themes' : '🎨 Скины',
    '<div class="loader">…</div>'
  );

  await loadThemes();
  renderThemeList();
}

function renderThemeList(): void {
  const activeId = getActiveThemeId();
  const en = isEN();
  const themes = getAllThemes();

  let html = `
    <div style="font-size:12px;color:var(--mut);margin-bottom:14px;line-height:1.55">
      ${en
        ? 'Choose a theme, or create your own and share it with the community.'
        : 'Выбери тему или создай свою и поделись с сообществом.'}
    </div>

    <button class="btn-primary btn-violet" onclick="openThemeCreator()" style="margin-bottom:14px">
      ➕ ${en ? 'Create theme' : 'Создать тему'}
    </button>

    <div class="theme-list">
  `;

  for (const t of themes) {
    const isActive = t.id === activeId;
    const isCustom = t.id.startsWith('custom_');

    html += `
      <div class="theme-card ${isActive ? 'active' : ''}">
        <div class="theme-preview">${previewSwatch(t.colors)}</div>
        <div class="theme-info">
          <div class="theme-name">${esc(t.name)}</div>
          <div class="theme-author">${en ? 'by' : 'от'} ${esc(t.author)}</div>
        </div>
        <div class="theme-actions">
          ${isActive
            ? `<span class="theme-badge">✓ ${en ? 'Active' : 'Активна'}</span>`
            : `<button class="theme-btn" onclick="applyThemeById('${t.id}')">${en ? 'Apply' : 'Применить'}</button>`}
          ${isCustom
            ? `<button class="theme-btn danger" onclick="removeTheme('${t.id}')">✕</button>`
            : ''}
        </div>
      </div>
    `;
  }

  html += `</div>`;

  const sheetBody = document.getElementById('sheet-body');
  if (sheetBody) sheetBody.innerHTML = html;
}

function previewSwatch(colors: Theme['colors']): string {
  return `
    <div style="display:flex;gap:3px">
      <span style="width:16px;height:16px;border-radius:50%;background:${colors.accent};box-shadow:0 0 8px ${colors.accent}88"></span>
      <span style="width:16px;height:16px;border-radius:50%;background:${colors.cyan};box-shadow:0 0 8px ${colors.cyan}88"></span>
      <span style="width:16px;height:16px;border-radius:50%;background:${colors.mint};box-shadow:0 0 8px ${colors.mint}88"></span>
      <span style="width:16px;height:16px;border-radius:50%;background:${colors.coral};box-shadow:0 0 8px ${colors.coral}88"></span>
      <span style="width:16px;height:16px;border-radius:50%;background:${colors.amber};box-shadow:0 0 8px ${colors.amber}88"></span>
      <span style="width:16px;height:16px;border-radius:50%;background:${colors.violet};box-shadow:0 0 8px ${colors.violet}88"></span>
    </div>
  `;
}

// ═══ ДЕЙСТВИЯ ═══

export function applyThemeById(id: string): void {
  if (applyTheme(id)) {
    toast(isEN() ? 'Theme applied' : 'Тема применена', 'success', 1500);
    renderThemeList();
  } else {
    toast('Тема не найдена', 'error');
  }
}

export function removeTheme(id: string): void {
  if (!confirm(isEN() ? 'Delete this theme?' : 'Удалить эту тему?')) return;
  deleteCustomTheme(id);
  toast(isEN() ? 'Theme deleted' : 'Тема удалена', 'info', 1500);
  renderThemeList();
}

// ═══ РЕДАКТОР ═══

export function openThemeCreator(): void {
  const en = isEN();

  const html = `
    <div style="display:flex;flex-direction:column;gap:14px">

      <div class="form-row">
        <label class="form-lbl">${en ? 'Theme name' : 'Название темы'}</label>
        <input class="form-input" id="theme-name" placeholder="My Awesome Theme" maxlength="30">
      </div>

      <div class="form-row">
        <label class="form-lbl">${en ? 'Author' : 'Автор'}</label>
        <input class="form-input" id="theme-author" placeholder="@nickname" maxlength="30">
      </div>

      <div class="color-picker">
        ${colorPicker('accent', 'Accent', '#4e8fff')}
        ${colorPicker('cyan', 'Cyan', '#5ecbff')}
        ${colorPicker('mint', 'Mint', '#45e0a8')}
        ${colorPicker('coral', 'Coral', '#ff6584')}
        ${colorPicker('amber', 'Amber', '#ffb858')}
        ${colorPicker('violet', 'Violet', '#a78bfa')}
      </div>

      <div class="theme-preview-large">
        <div style="font-family:'JetBrains Mono';font-size:10px;color:var(--mut);margin-bottom:8px">
          ${en ? 'Live preview' : 'Живой предпросмотр'}
        </div>
        <div style="display:flex;gap:8px">
          <span id="prev-accent" style="width:26px;height:26px;border-radius:7px;background:#4e8fff"></span>
          <span id="prev-cyan" style="width:26px;height:26px;border-radius:7px;background:#5ecbff"></span>
          <span id="prev-mint" style="width:26px;height:26px;border-radius:7px;background:#45e0a8"></span>
          <span id="prev-coral" style="width:26px;height:26px;border-radius:7px;background:#ff6584"></span>
          <span id="prev-amber" style="width:26px;height:26px;border-radius:7px;background:#ffb858"></span>
          <span id="prev-violet" style="width:26px;height:26px;border-radius:7px;background:#a78bfa"></span>
        </div>
      </div>

      <button class="btn-primary btn-mint" onclick="saveAndApplyTheme()">
        ${en ? 'Save & Apply' : 'Сохранить и применить'}
      </button>

      <button class="btn-primary btn-amber" onclick="saveAndSubmitTheme()">
        ${en ? 'Save & Submit to Community' : 'Сохранить и отправить в сообщество'}
      </button>

    </div>
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).openSheet?.(en ? '🎨 Create theme' : '🎨 Создание темы', html);

  // Live preview
  const keys = ['accent', 'cyan', 'mint', 'coral', 'amber', 'violet'];
  for (const k of keys) {
    const input = document.getElementById(`theme-color-${k}`) as HTMLInputElement | null;
    const txt = document.getElementById(`theme-color-${k}-txt`) as HTMLInputElement | null;
    const prev = document.getElementById(`prev-${k}`);

    if (input && prev) {
      input.addEventListener('input', () => {
        prev.style.background = input.value;
        if (txt) txt.value = input.value;
      });
    }
    if (txt && input && prev) {
      txt.addEventListener('input', () => {
        const v = txt.value.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(v)) {
          input.value = v;
          prev.style.background = v;
        }
      });
    }
  }
}

function colorPicker(key: string, label: string, defaultVal: string): string {
  return `
    <div class="color-row">
      <label class="color-lbl">${label}</label>
      <input type="color" id="theme-color-${key}" value="${defaultVal}" class="color-input">
      <input type="text" id="theme-color-${key}-txt" value="${defaultVal}" class="color-txt" maxlength="7">
    </div>
  `;
}

function collectThemeFromForm(): Theme | null {
  const en = isEN();
  const name = (document.getElementById('theme-name') as HTMLInputElement | null)?.value?.trim() || '';
  const author = (document.getElementById('theme-author') as HTMLInputElement | null)?.value?.trim() || 'anonymous';

  if (!name) {
    toast(en ? 'Enter theme name' : 'Введи название', 'warn');
    return null;
  }

  const keys = ['accent', 'cyan', 'mint', 'coral', 'amber', 'violet'] as const;
  const colors: any = {};
  for (const k of keys) {
    colors[k] = (document.getElementById(`theme-color-${k}`) as HTMLInputElement | null)?.value || '#000000';
  }

  return createThemeFromColors(name, author, colors);
}

export function saveAndApplyTheme(): void {
  const theme = collectThemeFromForm();
  if (!theme) return;

  saveCustomTheme(theme);
  // Добавим в текущий список
  const all = getAllThemes();
  all.push(theme);
  applyTheme(theme.id);

  toast(isEN() ? 'Theme saved & applied' : 'Тема сохранена и применена', 'success');
  renderThemeList();
}

export function saveAndSubmitTheme(): void {
  const theme = collectThemeFromForm();
  if (!theme) return;

  saveCustomTheme(theme);
  const all = getAllThemes();
  all.push(theme);
  applyTheme(theme.id);

  submitTheme(theme);

  toast(isEN() ? 'Form opened in browser' : 'Форма открыта в браузере', 'info', 3000);
}

// ─── Экспорт в window ───

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openThemeEditor,
    applyThemeById,
    removeTheme,
    openThemeCreator,
    saveAndApplyTheme,
    saveAndSubmitTheme,
  });
}