// scripts/i18n-sync.mjs
// Автопилот локализации NEBULA:
// 1. Синхронизирует src/locales/ru.json -> src/locales/en.json
// 2. Сканирует index.html и src/**/*.ts на любые русские фразы -> src/locales/auto-en.json
// 3. Основной движок: безключевой Google Translate (gtx), запасной: Groq API

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');
const INDEX_HTML = path.join(ROOT, 'index.html');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');
const RU_PATH = path.join(LOCALES_DIR, 'ru.json');
const EN_PATH = path.join(LOCALES_DIR, 'en.json');
const OLD_EN_PATH = path.join(LOCALES_DIR, 'en_old.json');
const AUTO_EN_PATH = path.join(LOCALES_DIR, 'auto-en.json');
const LOCK_PATH = path.join(LOCALES_DIR, '.i18n-lock.json');

const HAS_CYRILLIC = /[А-Яа-яЁё]/;
const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 12);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const normText = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// ─── ЗАЩИТА HTML-ТЕГОВ И ПЕРЕМЕННЫХ {n} ───
function protectTokens(text) {
  const tokens = [];
  const protectedText = String(text).replace(/(<\/?[a-zA-Z0-9]+[^>]*>|\{[a-zA-Z0-9_]+\})/g, (m) => {
    const id = tokens.length;
    tokens.push(m);
    return `___T${id}___`;
  });
  return { protectedText, tokens };
}

function restoreTokens(text, tokens) {
  return String(text).replace(/___\s*T\s*(\d+)\s*___/gi, (_, idx) => tokens[Number(idx)] ?? '');
}

// ─── 1. БЕЗКЛЮЧЕВОЙ GOOGLE TRANSLATE (GTX) ───
async function translateKeyless(text, targetLang = 'en') {
  const { protectedText, tokens } = protectTokens(text);
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=${targetLang}&dt=t&q=` +
    encodeURIComponent(protectedText);

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Google GTX HTTP ${res.status}`);

  const data = await res.json();
  const translated = (data?.[0] || []).map((chunk) => chunk?.[0] || '').join('');
  if (!translated) throw new Error('Пустой ответ Google GTX');

  return restoreTokens(translated, tokens).trim();
}

// ─── 2. ЗАПАСНОЙ: GROQ API (ЕСЛИ ЗАДАН GROQ_API_KEY) ───
async function translateGroq(text, targetLang = 'en') {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error('GROQ_API_KEY не задан');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: `Translate UI text for a crypto trading terminal from Russian to ${targetLang}. Keep HTML tags, emojis, and placeholders like {n} intact. Reply ONLY with the translated text.`,
        },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error('Пустой ответ Groq');
  return out;
}

async function translateText(text, targetLang = 'en') {
  try {
    return { text: await translateKeyless(text, targetLang), engine: 'keyless' };
  } catch (e1) {
    console.warn(`  ⚠️ Безключевой переводчик недоступен (${e1.message}), пробую Groq...`);
    return { text: await translateGroq(text, targetLang), engine: 'groq' };
  }
}

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const writeJson = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');

// ─── СКАНЕР РУССКИХ ФРАЗ В КОДЕ И HTML ───
function walkTsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'locales' || entry.name === 'node_modules') continue;
      walkTsFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== 'i18n.ts') {
      out.push(full);
    }
  }
  return out;
}

function isGoodUiPhrase(s) {
  const t = normText(s);
  if (!t || t.length < 2 || t.length > 220) return false;
  if (!HAS_CYRILLIC.test(t)) return false;
  if (t.includes('${') || t.includes('http://') || t.includes('https://')) return false;
  if (/^\[[a-z0-9_-]+\]/i.test(t)) return false; // логи вроде [oracle] ...
  return true;
}

function extractRussianFromCode(code, phrasesSet) {
  // Пропускаем комментарии и ловим строковые литералы
  const tokenRx = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'((?:\\.|[^'\\\n])*)'|"((?:\\.|[^"\\\n])*)"|`((?:\\.|[^`\\])*)`/g;
  let m;
  while ((m = tokenRx.exec(code)) !== null) {
    const raw = m[1] ?? m[2] ?? m[3];
    if (!raw) continue;

    // Игнорируем console.log / warn / error
    const before = code.slice(Math.max(0, m.index - 40), m.index);
    if (/console\.(log|warn|error|info)\s*\([^)]*$/.test(before)) continue;

    // Если внутри шаблонной строки HTML — вытаскиваем тексты между тегами
    if (m[3] !== undefined && raw.includes('<')) {
      const htmlTextRx = />([^<>{}$]+)</g;
      let hm;
      while ((hm = htmlTextRx.exec(raw)) !== null) {
        if (isGoodUiPhrase(hm[1])) phrasesSet.add(normText(hm[1]));
      }
      const attrRx = /(?:placeholder|title)=["']([^"'${}]+)["']/gi;
      let am;
      while ((am = attrRx.exec(raw)) !== null) {
        if (isGoodUiPhrase(am[1])) phrasesSet.add(normText(am[1]));
      }
      continue;
    }

    if (isGoodUiPhrase(raw)) {
      phrasesSet.add(normText(raw));
    }
  }
}

function extractRussianFromHtml(html, phrasesSet) {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const textRx = />([^<>]+)</g;
  let m;
  while ((m = textRx.exec(cleaned)) !== null) {
    if (isGoodUiPhrase(m[1])) phrasesSet.add(normText(m[1]));
  }

  const attrRx = /(?:placeholder|title)=["']([^"']+)["']/gi;
  while ((m = attrRx.exec(cleaned)) !== null) {
    if (isGoodUiPhrase(m[1])) phrasesSet.add(normText(m[1]));
  }
}

// ─── СИНХРОНИЗАЦИЯ КЛЮЧЕЙ ru.json -> en.json ───
async function syncManualDict() {
  if (!fs.existsSync(RU_PATH)) return;

  const ru = readJson(RU_PATH);
  const en = readJson(EN_PATH);
  const oldEn = readJson(OLD_EN_PATH);
  const lock = readJson(LOCK_PATH);

  const ruKeys = Object.keys(ru);
  const ruSet = new Set(ruKeys);
  let added = 0, updated = 0, archived = 0;

  for (const key of Object.keys(en)) {
    if (!ruSet.has(key)) {
      oldEn[key] = en[key];
      delete en[key];
      delete lock[key];
      archived++;
    }
  }

  const nextEn = {};
  for (const key of ruKeys) {
    const ruText = ru[key];
    const hash = sha256(ruText);
    if (lock[key] === hash && typeof en[key] === 'string' && en[key].length > 0) {
      nextEn[key] = en[key];
      continue;
    }
    const isNew = !(key in en);
    const { text, engine } = await translateText(ruText, 'en');
    nextEn[key] = text;
    lock[key] = hash;
    if (isNew) added++;
    else updated++;
    console.log(`  [dict/${engine}] ${isNew ? '+' : '~'} ${key}`);
    await sleep(100);
  }

  writeJson(EN_PATH, nextEn);
  writeJson(LOCK_PATH, lock);
  if (Object.keys(oldEn).length > 0) writeJson(OLD_EN_PATH, oldEn);

  console.log(`📘 Словарь ru.json -> en.json: +${added}, ~${updated}, архив: ${archived}`);
}

// ─── АВТОПИЛОТ: СКАНЕР КОДА -> auto-en.json ───
async function syncAutoDomDict() {
  const phrases = new Set();

  if (fs.existsSync(INDEX_HTML)) {
    extractRussianFromHtml(fs.readFileSync(INDEX_HTML, 'utf8'), phrases);
  }
  for (const file of walkTsFiles(SRC_DIR)) {
    extractRussianFromCode(fs.readFileSync(file, 'utf8'), phrases);
  }

  const existing = readJson(AUTO_EN_PATH);
  const nextAuto = {};
  const toTranslate = [];

  for (const phrase of phrases) {
    if (typeof existing[phrase] === 'string' && existing[phrase].length > 0) {
      nextAuto[phrase] = existing[phrase];
    } else {
      toTranslate.push(phrase);
    }
  }

  const removed = Object.keys(existing).filter((k) => !phrases.has(k)).length;
  console.log(`🔍 Авто-сканер кода: найдено ${phrases.size} фраз (новых: ${toTranslate.length}, удалено: ${removed})`);

  const CONCURRENCY = 5;
  let done = 0;

  for (let i = 0; i < toTranslate.length; i += CONCURRENCY) {
    const batch = toTranslate.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (phrase) => {
        try {
          const { text, engine } = await translateText(phrase, 'en');
          nextAuto[phrase] = text;
          done++;
          console.log(`  [auto ${done}/${toTranslate.length} · ${engine}] "${phrase.slice(0, 35)}" -> "${text.slice(0, 35)}"`);
        } catch (e) {
          done++;
          console.warn(`  ⚠️ Пропущено "${phrase.slice(0, 30)}": ${e.message}`);
        }
      })
    );
    if (i + CONCURRENCY < toTranslate.length) await sleep(150);
  }

  fs.mkdirSync(LOCALES_DIR, { recursive: true });
  writeJson(AUTO_EN_PATH, nextAuto);
  console.log(`✨ Сохранено в src/locales/auto-en.json (${Object.keys(nextAuto).length} фраз)`);
}

async function runTest() {
  console.log('🧪 Проверяю безключевой переводчик...');
  const sample = '⚡ <b>Бэктест</b> завершён: найдено {n} сделок, просадка ниже нормы.';
  const t0 = Date.now();
  const res = await translateText(sample, 'en');
  console.log(`✅ Движок: ${res.engine} (${Date.now() - t0}ms)\n   RU: ${sample}\n   EN: ${res.text}`);
}

if (process.argv.includes('--test')) {
  runTest().catch((e) => { console.error('❌', e.message); process.exit(1); });
} else {
  (async () => {
    await syncManualDict();
    await syncAutoDomDict();
  })().catch((e) => { console.error('❌', e.message); process.exit(1); });
}