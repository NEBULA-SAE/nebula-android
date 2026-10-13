// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · THEMES UI — расширенный редактор
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
  DEFAULT_COLORS,
  type Theme,
  type ThemeColors,
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
        ? 'Choose a theme, or create your own with full color control and share with the community.'
        : 'Выбери тему или создай свою с полным контролем цветов и поделись с сообществом.'}
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

function previewSwatch(colors: ThemeColors): string {
  return `
    <div style="display:flex;flex-direction:column;gap:4px;align-items:center">
      <div style="
        width:52px;height:52px;border-radius:12px;
        background:linear-gradient(135deg, ${colors.gradStart} 0%, ${colors.gradEnd} 100%);
        border:1px solid ${colors.borderHi};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 16px ${colors.accent}55;
      ">
        <div style="display:flex;gap:3px">
          <span style="width:8px;height:8px;border-radius:50%;background:${colors.accent}"></span>
          <span style="width:8px;height:8px;border-radius:50%;background:${colors.cyan}"></span>
          <span style="width:8px;height:8px;border-radius:50%;background:${colors.mint}"></span>
        </div>
      </div>
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

interface ColorField {
  key: keyof ThemeColors;
  label: string;
  group: string;
}

const FIELDS: ColorField[] = [
  // Акценты
  { key: 'accent', label: 'Accent', group: 'Акценты' },
  { key: 'cyan',   label: 'Cyan',   group: 'Акценты' },
  { key: 'mint',   label: 'Mint',   group: 'Акценты' },
  { key: 'coral',  label: 'Coral',  group: 'Акценты' },
  { key: 'amber',  label: 'Amber',  group: 'Акценты' },
  { key: 'violet', label: 'Violet', group: 'Акценты' },
  // Фон
  { key: 'void',     label: 'Background', group: 'Фон' },
  { key: 'bgCard',   label: 'Card bg',    group: 'Фон' },
  { key: 'bgCardHi', label: 'Card hi',    group: 'Фон' },
  { key: 'border',   label: 'Border',     group: 'Фон' },
  { key: 'borderHi', label: 'Border hi',  group: 'Фон' },
  // Текст
  { key: 'hi',  label: 'Text hi',  group: 'Текст' },
  { key: 'tx',  label: 'Text',     group: 'Текст' },
  { key: 'mut', label: 'Text mut', group: 'Текст' },
  { key: 'dim', label: 'Text dim', group: 'Текст' },
  // Градиент
  { key: 'gradStart', label: 'Grad start', group: 'Градиент' },
  { key: 'gradEnd',   label: 'Grad end',   group: 'Градиент' },
];

export function openThemeCreator(): void {
  const en = isEN();
  const groups = ['Акценты', 'Фон', 'Текст', 'Градиент'];

  let fieldsHtml = '';
  for (const g of groups) {
    const groupFields = FIELDS.filter(f => f.group === g);
    fieldsHtml += `
      <div class="theme-group">
        <div class="theme-group-title">${g}</div>
        ${groupFields.map(f => colorPicker(f.key, f.label, DEFAULT_COLORS[f.key])).join('')}
      </div>
    `;
  }

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

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="theme-preset-btn" onclick="applyThemePreset('default')">Nebula</button>
        <button class="theme-preset-btn" onclick="applyThemePreset('cyberpunk')">Cyberpunk</button>
        <button class="theme-preset-btn" onclick="applyThemePreset('matrix')">Matrix</button>
        <button class="theme-preset-btn" onclick="applyThemePreset('sunset')">Sunset</button>
        <button class="theme-preset-btn" onclick="applyThemePreset('ice')">Ice</button>
        <button class="theme-preset-btn" onclick="applyThemePreset('gold')">Gold</button>
        <button class="theme-preset-btn" onclick="applyThemePreset('dracula')">Dracula</button>
      </div>

      ${fieldsHtml}

      <div class="theme-preview-large">
        <div style="font-family:'JetBrains Mono';font-size:10px;color:var(--mut);margin-bottom:8px">
          ${en ? 'Live preview' : 'Живой предпросмотр'}
        </div>
        <div id="theme-live-preview" style="display:flex;gap:8px;flex-wrap:wrap"></div>
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
  for (const f of FIELDS) {
    const input = document.getElementById(`theme-color-${f.key}`) as HTMLInputElement | null;
    const txt = document.getElementById(`theme-color-${f.key}-txt`) as HTMLInputElement | null;

    if (input) {
      input.addEventListener('input', () => {
        if (txt) txt.value = input.value;
        updateLivePreview();
      });
    }
    if (txt) {
      txt.addEventListener('input', () => {
        const v = txt.value.trim();
        if (isValidColor(v)) {
          if (input) input.value = toHex(v);
          updateLivePreview();
        }
      });
    }
  }

  updateLivePreview();
}

function colorPicker(key: string, label: string, defaultVal: string): string {
  const hex = toHex(defaultVal);
  return `
    <div class="color-row">
      <label class="color-lbl">${label}</label>
      <input type="color" id="theme-color-${key}" value="${hex}" class="color-input">
      <input type="text" id="theme-color-${key}-txt" value="${defaultVal}" class="color-txt" maxlength="40">
    </div>
  `;
}

function isValidColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v) || /^rgba?\(/.test(v);
}

function toHex(v: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  // Конвертация rgba → hex (грубо, для color input)
  const m = v.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const [, r, g, b] = m;
    return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}

function updateLivePreview(): void {
  const preview = document.getElementById('theme-live-preview');
  if (!preview) return;

  const colors: any = {};
  for (const f of FIELDS) {
    const txt = document.getElementById(`theme-color-${f.key}-txt`) as HTMLInputElement | null;
    colors[f.key] = txt?.value || DEFAULT_COLORS[f.key];
  }

  preview.innerHTML = `
    <div style="
      width:100%;padding:14px;border-radius:12px;
      background:${colors.void};
      border:1px solid ${colors.border};
      font-family:'JetBrains Mono',monospace;
    ">
      <div style="color:${colors.hi};font-size:14px;font-weight:700;margin-bottom:6px">
        NEBULA Theme Preview
      </div>
      <div style="color:${colors.tx};font-size:11px;margin-bottom:10px">
        Это пример текста на фоне темы
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span style="padding:4px 10px;background:${colors.accent};color:#fff;border-radius:6px;font-size:10px">ACCENT</span>
        <span style="padding:4px 10px;background:${colors.cyan};color:#000;border-radius:6px;font-size:10px">CYAN</span>
        <span style="padding:4px 10px;background:${colors.mint};color:#000;border-radius:6px;font-size:10px">MINT</span>
        <span style="padding:4px 10px;background:${colors.coral};color:#fff;border-radius:6px;font-size:10px">CORAL</span>
        <span style="padding:4px 10px;background:${colors.amber};color:#000;border-radius:6px;font-size:10px">AMBER</span>
        <span style="padding:4px 10px;background:${colors.violet};color:#fff;border-radius:6px;font-size:10px">VIOLET</span>
      </div>
      <div style="
        margin-top:10px;padding:10px;border-radius:8px;
        background:${colors.bgCard};
        border:1px solid ${colors.borderHi};
        color:${colors.tx};font-size:11px;
      ">
        Пример карточки с подсвеченной границей
      </div>
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

  const colors: any = {};
  for (const f of FIELDS) {
    const txt = document.getElementById(`theme-color-${f.key}-txt`) as HTMLInputElement | null;
    colors[f.key] = txt?.value?.trim() || DEFAULT_COLORS[f.key];
  }

  return createThemeFromColors(name, author, colors as ThemeColors);
}

export function saveAndApplyTheme(): void {
  const theme = collectThemeFromForm();
  if (!theme) return;

  saveCustomTheme(theme);
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

// ─── Пресеты для быстрого старта ───

export function applyThemePreset(presetId: string): void {
  const themes = getAllThemes();
  const preset = themes.find(t => t.id === presetId);
  if (!preset) return;

  for (const f of FIELDS) {
    const input = document.getElementById(`theme-color-${f.key}`) as HTMLInputElement | null;
    const txt = document.getElementById(`theme-color-${f.key}-txt`) as HTMLInputElement | null;
    const val = preset.colors[f.key];
    if (input) input.value = toHex(val);
    if (txt) txt.value = val;
  }
  updateLivePreview();
  toast(isEN() ? 'Preset loaded' : 'Пресет загружен', 'info', 1200);
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
    applyThemePreset,
  });
}