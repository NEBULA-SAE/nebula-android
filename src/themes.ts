// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · THEMES — Скины оформления
// ═══════════════════════════════════════════════════════════════

const THEMES_URL = 'https://raw.githubusercontent.com/NEBULA-SAE/nebula-android/main/data/themes.json';
const ACTIVE_THEME_KEY = 'nebulaActiveTheme';
const CUSTOM_THEMES_KEY = 'nebulaCustomThemes';

export interface ThemeColors {
  accent: string;
  cyan: string;
  mint: string;
  coral: string;
  amber: string;
  violet: string;
}

export interface Theme {
  id: string;
  name: string;
  author: string;
  colors: ThemeColors;
}

let _themes: Theme[] = [];

// ─── Загрузка ───

export async function loadThemes(): Promise<Theme[]> {
  try {
    const r = await fetch(THEMES_URL, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const custom = getCustomThemes();
    _themes = [...(data.themes || []), ...custom];
    console.log(`[themes] loaded ${_themes.length} themes (${data.themes?.length || 0} remote + ${custom.length} custom)`);
    return _themes;
  } catch (e) {
    console.warn('[themes] remote load failed, using local only:', e);
    _themes = [...DEFAULT_THEMES, ...getCustomThemes()];
    return _themes;
  }
}

// ─── Fallback если GitHub недоступен ───

const DEFAULT_THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Nebula (по умолчанию)',
    author: 'NEBULA',
    colors: {
      accent: '#4e8fff',
      cyan: '#5ecbff',
      mint: '#45e0a8',
      coral: '#ff6584',
      amber: '#ffb858',
      violet: '#a78bfa',
    },
  },
];

// ─── Применение темы ───

export function applyTheme(themeId: string): boolean {
  const theme = _themes.find(t => t.id === themeId);
  if (!theme) {
    console.warn('[themes] not found:', themeId);
    return false;
  }

  const root = document.documentElement;
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--cyan', theme.colors.cyan);
  root.style.setProperty('--mint', theme.colors.mint);
  root.style.setProperty('--coral', theme.colors.coral);
  root.style.setProperty('--amber', theme.colors.amber);
  root.style.setProperty('--violet', theme.colors.violet);

  // Цвет линии "NOW" на графике тоже меняется
  root.style.setProperty('--accent-hi', theme.colors.cyan);

  try {
    localStorage.setItem(ACTIVE_THEME_KEY, themeId);
  } catch { /* silent */ }

  console.log(`[themes] applied: ${theme.name}`);
  return true;
}

export function resetTheme(): void {
  const root = document.documentElement;
  root.style.removeProperty('--accent');
  root.style.removeProperty('--cyan');
  root.style.removeProperty('--mint');
  root.style.removeProperty('--coral');
  root.style.removeProperty('--amber');
  root.style.removeProperty('--violet');
  root.style.removeProperty('--accent-hi');
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

// ─── Геттер ───

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
  });
}