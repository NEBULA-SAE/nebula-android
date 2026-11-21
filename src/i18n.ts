// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · I18N (JSON словари + 0ms DOM-автопереводчик)
// ═══════════════════════════════════════════════════════════════

import I18N_RU from './locales/ru.json';
import I18N_EN from './locales/en.json';
import AUTO_EN from './locales/auto-en.json';

export type Lang = 'ru' | 'en';
type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = {
  ru: I18N_RU as Dict,
  en: I18N_EN as Dict,
};

const AUTO_DICT: Dict = AUTO_EN as Dict;
const HAS_CYRILLIC = /[А-Яа-яЁё]/;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA']);

// Храним оригинальный русский текст, чтобы при возврате на RU всё восстанавливалось идеально
const origTextNodes = new WeakMap<Text, string>();
const origAttrs = new WeakMap<Element, { placeholder?: string; title?: string }>();
let _observer: MutationObserver | null = null;
let _isTranslating = false;

let _lang: Lang = (() => {
  try {
    return localStorage.getItem('nebulaLang') === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
})();

function normText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function translateTextNode(node: Text): void {
  const parentTag = node.parentElement?.tagName;
  if (parentTag && SKIP_TAGS.has(parentTag)) return;

  if (_lang === 'ru') {
    const orig = origTextNodes.get(node);
    if (orig !== undefined && node.nodeValue !== orig) {
      node.nodeValue = orig;
    }
    return;
  }

  const raw = node.nodeValue || '';
  if (!HAS_CYRILLIC.test(raw)) return;

  const key = normText(raw);
  const translated = AUTO_DICT[key];
  if (!translated) return;

  if (!origTextNodes.has(node)) origTextNodes.set(node, raw);
  const lead = raw.match(/^\s*/)?.[0] || '';
  const trail = raw.match(/\s*$/)?.[0] || '';
  const nextVal = lead + translated + trail;
  if (node.nodeValue !== nextVal) node.nodeValue = nextVal;
}

function translateElementAttrs(el: Element): void {
  if (SKIP_TAGS.has(el.tagName)) return;

  if (_lang === 'ru') {
    const saved = origAttrs.get(el);
    if (saved) {
      if (saved.placeholder !== undefined) el.setAttribute('placeholder', saved.placeholder);
      if (saved.title !== undefined) el.setAttribute('title', saved.title);
    }
    return;
  }

  for (const attr of ['placeholder', 'title'] as const) {
    const val = el.getAttribute(attr);
    if (!val || !HAS_CYRILLIC.test(val)) continue;
    const tr = AUTO_DICT[normText(val)];
    if (!tr) continue;

    const saved = origAttrs.get(el) || {};
    if (saved[attr] === undefined) {
      saved[attr] = val;
      origAttrs.set(el, saved);
    }
    if (val !== tr) el.setAttribute(attr, tr);
  }
}

export function applyAutoDomTranslation(root: Node = document.body): void {
  if (typeof document === 'undefined' || !root || _isTranslating) return;
  _isTranslating = true;
  try {
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root as Text);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE) {
      translateElementAttrs(root as Element);
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let cur: Node | null;
    while ((cur = walker.nextNode())) {
      if (cur.nodeType === Node.TEXT_NODE) {
        translateTextNode(cur as Text);
      } else if (cur.nodeType === Node.ELEMENT_NODE) {
        translateElementAttrs(cur as Element);
      }
    }
  } finally {
    _isTranslating = false;
  }
}

function initAutoTranslator(): void {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined' || _observer) return;

  const start = () => {
    if (!document.body) return;
    if (_lang === 'en') applyAutoDomTranslation(document.body);

    _observer = new MutationObserver((mutations) => {
      if (_lang !== 'en' || _isTranslating) return;
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target) {
          applyAutoDomTranslation(m.target);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((n) => applyAutoDomTranslation(n));
        }
      }
    });

    _observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

// ─── ПУБЛИЧНОЕ API ───

export function tm(key: string): string {
  return DICTS[_lang][key] ?? DICTS.ru[key] ?? key;
}

export function isEN(): boolean {
  return _lang === 'en';
}

export function getLang(): Lang {
  return _lang;
}

export function setLang(lang: Lang): void {
  if (lang !== 'ru' && lang !== 'en') return;
  _lang = lang;
  try {
    localStorage.setItem('nebulaLang', lang);
  } catch (e) {
    console.warn('[i18n] setLang save failed:', e);
  }
  applyAutoDomTranslation(document.body);
}

export function getAllKeys(): string[] {
  return Object.keys(DICTS[_lang]);
}

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    tm,
    isEN,
    setLang,
    getLang,
    getAllKeys,
  });
  initAutoTranslator();
}