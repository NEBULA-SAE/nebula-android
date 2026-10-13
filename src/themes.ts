// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · THEMES — Расширенная система тем
// ═══════════════════════════════════════════════════════════════

const THEMES_URL = 'https://raw.githubusercontent.com/NEBULA-SAE/nebula-android/main/data/themes.json';
const ACTIVE_THEME_KEY = 'nebulaActiveTheme';
const CUSTOM_THEMES_KEY = 'nebulaCustomThemes';

export interface ThemeColors {
  // Акценты
  accent: string;
  cyan: string;
  mint: string;
  coral: string;
  amber: string;
  violet: string;
  // Фон и поверхности
  void: string;
  bgCard: string;
  bgCardHi: string;
  border: string;
  borderHi: string;
  // Текст
  hi: string;
  tx: string;
  mut: string;
  dim: string;
  // Градиент
  gradStart: string;
  gradEnd: string;
}

export interface Theme {
  id: string;
  name: string;
  author: string;
  colors: ThemeColors;
}

// ─── Дефолтные цвета (для fallback и валидации) ───

export const DEFAULT_COLORS: ThemeColors = {
  accent: '#4e8fff',
  cyan: '#5ecbff',
  mint: '#45e0a8',
  coral: '#ff6584',
  amber: '#ffb858',
  violet: '#a78bfa',
  void: '#000000',
  bgCard: 'rgba(10,16,28,.94)',
  bgCardHi: 'rgba(14,22,38,.96)',
  border: 'rgba(140,170,220,.12)',
  borderHi: 'rgba(94,203,255,.32)',
  hi: '#eef3ff',
  tx: '#c4cdde',
  mut: '#6b7a94',
  dim: '#3d4758',
  gradStart: '#5ecbff',
  gradEnd: '#a78bfa',
};

// ─── Fallback если GitHub недоступен ───

const DEFAULT_THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Nebula (по умолчанию)',
    author: 'NEBULA',
    colors: { ...DEFAULT_COLORS },
  },
];

// ─── Загрузка ───

let _themes: Theme[] = [];

export async function loadThemes(): Promise<Theme[]> {
  try {
    const r = await fetch(THEMES_URL, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();

    // Нормализуем — дозаполняем отсутствующие поля дефолтами
    const remote: Theme[] = (data.themes || []).map(normalizeTheme);

    const custom = getCustomThemes().map(normalizeTheme);
    _themes = [...remote, ...custom];

    console.log(`[themes] loaded ${_themes.length} themes (${remote.length} remote + ${custom.length} custom)`);
    return _themes;
  } catch (e) {
    console.warn('[themes] remote load failed, using local only:', e);
    _themes = [...DEFAULT_THEMES, ...getCustomThemes().map(normalizeTheme)];
    return _themes;
  }
}

function normalizeTheme(t: any): Theme {
  return {
    id: t.id || 'unknown',
    name: t.name || 'Unnamed',
    author: t.author || 'unknown',
    colors: { ...DEFAULT_COLORS, ...(t.colors || {}) },
  };
}

// ─── Применение темы ───

export function applyTheme(themeId: string): boolean {
  const theme = _themes.find(t => t.id === themeId);
  if (!theme) {
    console.warn('[themes] not found:', themeId);
    return false;
  }

  const root = document.documentElement;

  // АКЦЕНТЫ
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--cyan', theme.colors.cyan);
  root.style.setProperty('--mint', theme.colors.mint);
  root.style.setProperty('--coral', theme.colors.coral);
  root.style.setProperty('--amber', theme.colors.amber);
  root.style.setProperty('--violet', theme.colors.violet);
  root.style.setProperty('--accent-hi', theme.colors.cyan);

  // ФОН И ПОВЕРХНОСТИ
  root.style.setProperty('--void', theme.colors.void);
  root.style.setProperty('--bg-card', theme.colors.bgCard);
  root.style.setProperty('--bg-card-hi', theme.colors.bgCardHi);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--border-hi', theme.colors.borderHi);

  // ТЕКСТ
  root.style.setProperty('--hi', theme.colors.hi);
  root.style.setProperty('--tx', theme.colors.tx);
  root.style.setProperty('--mut', theme.colors.mut);
  root.style.setProperty('--dim', theme.colors.dim);

  // ГРАДИЕНТ (лого, бренд)
  root.style.setProperty('--grad-start', theme.colors.gradStart);
  root.style.setProperty('--grad-end', theme.colors.gradEnd);

  // Обновляем <meta name="theme-color"> для мобильных
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme.colors.void);

  // Обновляем фон body
  document.body.style.background = theme.colors.void;

  try {
    localStorage.setItem(ACTIVE_THEME_KEY, themeId);
  } catch { /* silent */ }

  console.log(`[themes] applied: ${theme.name}`);
  return true;
}

export function resetTheme(): void {
  const root = document.documentElement;
  const vars = [
    '--accent', '--cyan', '--mint', '--coral', '--amber', '--violet', '--accent-hi',
    '--void', '--bg-card', '--bg-card-hi', '--border', '--border-hi',
    '--hi', '--tx', '--mut', '--dim',
    '--grad-start', '--grad-end',
  ];
  for (const v of vars) root.style.removeProperty(v);
  document.body.style.background = '';
  try { localStorage.removeItem(ACTIVE_THEME_KEY); } catch { /* silent */ }
}

// ─── Активная тема ───

export function getActiveThemeId(): string {
  try {
    return localStorage.getItem(ACTIVE_THEME_KEY) || 'default';
  } catch {
    return 'default';
  }
}

// ─── Пользовательские темы ───

export function getCustomThemes(): Theme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomTheme(theme: Theme): boolean {
  try {
    const custom = getCustomThemes();
    const idx = custom.findIndex(t => t.id === theme.id);
    if (idx >= 0) custom[idx] = theme;
    else custom.push(theme);
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(custom));
    return true;
  } catch {
    return false;
  }
}

export function deleteCustomTheme(id: string): boolean {
  try {
    const custom = getCustomThemes().filter(t => t.id !== id);
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(custom));
    _themes = _themes.filter(t => t.id !== id);
    return true;
  } catch {
    return false;
  }
}

// ─── Создание ───

export function createThemeFromColors(
  name: string,
  author: string,
  colors: ThemeColors
): Theme {
  return {
    id: 'custom_' + Date.now().toString(36),
    name,
    author,
    colors,
  };
}

// ─── Отправка темы через GitHub Issues ───

export function submitTheme(theme: Theme): void {
  const body = encodeURIComponent(
    `## Новая тема для NEBULA\n\n` +
    `**Название:** ${theme.name}\n` +
    `**Автор:** ${theme.author}\n\n` +
    `**Цвета:**\n` +
    '```json\n' +
    JSON.stringify(theme.colors, null, 2) +
    '\n```\n\n' +
    `_Отправлено из NEBULA ${new Date().toISOString()}_`
  );

  const url =
    `https://github.com/NEBULA-SAE/nebula-android/issues/new` +
    `?title=${encodeURIComponent('Theme: ' + theme.name)}` +
    `&body=${body}` +
    `&labels=theme-submission`;

  window.open(url, '_blank');
}

// ─── Геттеры ───

export function getAllThemes(): Theme[] {
  return _themes;
}

export function getTheme(id: string): Theme | undefined {
  return _themes.find(t => t.id === id);
}

// ─── Экспорт в window ───

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    loadThemes,
    applyTheme,
    resetTheme,
    getActiveThemeId,
    getCustomThemes,
    saveCustomTheme,
    deleteCustomTheme,
    createThemeFromColors,
    submitTheme,
    getAllThemes,
    getTheme,
    DEFAULT_COLORS,
  });
}