# NEBULA Oracle Terminal — AI Context & Operations Manual

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> **Версия файла:** актуально на **v2.5.0+** (Ноябрь 2026)
> **Актуальная версия кода:** см. `package.json`

---

## 1. TL;DR — что это за проект

**NEBULA Oracle Terminal** — персональный крипто-терминал. Единая кодовая база на TypeScript работает на трёх платформах: **Web** (браузер), **Android** (Capacitor 8), **Windows** (Tauri 2).

- **Oracle Scoring:** алгоритм от `-100` до `+100` (техника, киты, стакан, funding, ончейн, паттерны, история). Выдаёт вердикт (`strong_buy` / `buy` / `hold` / `avoid`), торговый план и 3 сценария через AI (Groq).
- **Новый плоский дизайн (`new-skin.css`):** интерфейс переведён на минималистичный dark-flat стиль (`body.skin-active`, `#0E0E10` / `#18181B`, акцент `#1DB954` с поддержкой смены цвета через редактор тем).
- **Универсальный Coin Outlook (PRO):** исторический анализ для **любой монеты** — kNN-вероятности пробоя ATH (7/30/90/365 дней), календарь «Этот день в истории», описание и ссылки с CoinGecko (с кэшем на 24ч). На ПК встроен в карточку, на мобилке — в модалку.
- **Smart Learning:** самообучение Оракула в IndexedDB (схема v3) — калибровка уверенности, инсайты, недельный дрифт метрик, паттерны (Wyckoff, капитуляция, LSR-дивергенция).
- **Монетизация:** подписка PRO с привязкой к HWID + рекламный стенд-карусель в футере (`.nebula-ad-stand`) под партнёрские баннеры, реферальные ссылки и платные слоты. Закрытые фичи PRO: безлимитный AI, Аналитика (PRO), Центр рисков, Радар китов (OI/LSR/Taker), Ордера, Coin Outlook.

---

## 2. Стек и платформы

| Слой | Технология |
|---|---|
| Frontend | TypeScript + Vite 5.4 |
| Графики | lightweight-charts 4.2 |
| Android | Capacitor 8.5 (`cleartext: true` для HTTP) |
| Windows | Tauri 2.x (Rust + WebView2) |
| AI | Groq API (`openai/gpt-oss-120b`) + SSE Streaming |
| Криптография | Web Crypto API (AES-256-GCM + PBKDF2, 150k итераций) |
| Хранилище | **IndexedDB** (`NebulaDB` → `oracleMemory`) + `localStorage` |
| Внешние ссылки | `@capacitor/browser` (Android) + `@tauri-apps/plugin-opener` (Windows) |
| Ориентация | `@capacitor/screen-orientation` (landscape для fullscreen графика) |
| License Server | Node.js + SQLite (VPS: `http://85.192.42.177:3000`) |

**Идентификатор приложения:** `com.nebula.oracle`

---

## 3. Архитектура и ключевые модули

1. **Точка входа UI (`src/ui/init.ts`):** проверка PRO, восстановление таймфрейма и мониторинга, автодиагностика, горячие клавиши ПК (`initHotkeys`), меню обмена (`openExchangeMenu`).
2. **Экраны и шторки (`src/ui/screens.ts`):** `switchTab()`, `switchHomeTab('main'|'fav')`, `loadActiveCoinCard()` (также экспортируется как `loadBTC`), `openSheet()` / `closeSheet()`, демо-режим, радарное меню.
3. **Оракул и Аналитика (`src/ui/oracle.ts`, `src/oracle.ts`):** `mobileAnalyze()` (единая точка анализа — сама обновляет график, карточку монеты, звезду избранного, вердикт, китов, PRO-аналитику, Confluence и Демо), `askAIMentor()`, дашборд, квиз риск-профиля, Дневник.
4. **Торговля и Портфель (`src/trading.ts`, `src/sources/mexc.ts`, `src/sources/kucoin.ts`):** шифрованные API-ключи, сетка ордеров (2/3 шага), TWAP, мониторинг (`#monitor-panel`), синхронизация портфеля MEXC и KuCoin (с живыми ценами и курсом USDT/RUB; сохраняет `state.portfolioAssets` для Центра рисков).
5. **Сканер и Избранное (`src/ui/scanner.ts`):** сканер дна (Web Worker `src/worker.ts`), автокомплит пар, Watchlist с 4 макро-метриками и спарклайнами (капитализация через CoinPaprika + VPS-прокси).
6. **Coin Outlook (`src/btc/outlook-engine.ts`, `src/ui/btc-outlook.ts`):** динамический расчёт ATH, kNN-аналогов (±15%) и календаря по недельным/макс. свечам.
7. **CoinGecko 24h Cache (`src/ui/screens.ts`, `src/ui/btc-outlook.ts`):** описания и ссылки кэшируются в `localStorage` под ключом `nebulaCgCache_<TICKER>` на 24 часа.
8. **Центр рисков и Алерты (`src/ui/risk.ts`, `src/alerts.ts`):** агрегирует 5 индикаторов (концентрация портфеля, уверенность Оракула, киты, funding, Fear & Greed) + Web Notifications.
9. **Обучение (`src/learning-core.ts`, `src/ui/learning.ts`):** калибровка, инсайты, дрифт, 3-табовый UI.
10. **Настройки, Хаб, Темы (`src/ui/settings.ts`, `src/ui/hub.ts`, `src/ui/themes.ts`):** sync-first рендер настроек с защитой от перезаписи открытой подвкладки, каталог бирж/инструментов РФ, редактор тем.
11. **Сводка модулей, сворачивание и рекламный стенд (`src/ui/master-signal.ts`):** главный индикатор и лампочки модулей (`resetMasterSignal`, `setModuleSignal`), аккордеон карточек от Мульти-ТФ до Стенок, автокарусель и свайп-логика рекламного стенда в футере (`initFooterAdStand`).
12. **Сетевой слой (`src/config.ts`, `src/platform/http.ts`, `src/sources/stream.ts`):** VPS-прокси Caddy, whitelist-патч `fetch` для Tauri, WebSocket `PriceStream`.
13. **I18N (`src/i18n.ts`):** словарь RU/EN, `tm(key)`, `humanizePattern()` в `src/patterns.ts`, `applyStaticTranslations()` в `src/ui/screens.ts`.

---

## 4. UI, Новый скин, Рекламный стенд и Горячие клавиши

### Стили (`index.html` + `public/styles/`)
- **Порядок подключения:** все базовые CSS (включая `btc-outlook.css`) грузятся в `<head>` **до** `new-skin.css`.
- **Новый скин (`public/styles/new-skin.css`):** включается классом `body.skin-active`.
  - Цвета: `--skin-bg: #0E0E10`, `--skin-surface: #18181B`, `--skin-accent: var(--accent, #1DB954)`.
  - Дефолтная тема `default` не перезаписывает зелёный акцент при старте, а выбор других тем в редакторе меняет `--skin-accent`.
  - Единый брейкпоинт ПК/мобилка: **`1024px`** (синхронизирован между `new-skin.css` и `desktop-fix.css`).
  - Заставка (`#nebula-splash`) скрыта под `body.skin-active`.
- **Шторки и модалки:** все кнопки закрытия внутри шторок должны вызывать `closeSheet()` (не трогать DOM `sheet-overlay` напрямую).
- **SVG-спрайт (`index.html`):** содержит все иконки интерфейса, включая `#i-trending`, `#i-pulse`, `#i-play`, `#i-whale`, `#i-search`, `#i-info`, `#i-scan`, `#i-clock`, `#i-refresh`, `#i-bell`.

### Инструкция: как добавлять новые рекламные баннеры и кнопки
Рекламный стенд находится внутри `.app-footer` в `index.html` (`#nebula-ad-stand` → `#nebula-ad-track`), стили заданы в `public/styles/new-skin.css`, а логика листания и кликов — в `src/ui/master-signal.ts` (`initFooterAdStand`).

1. **Подготовка картинки баннера:**
   - Формат: горизонтальный баннер `4:1` (например, `1600×400` px) в тёмных тонах `#0E0E10` / `#18181B`, чтобы не выбивался из интерфейса.
   - Класть в папку с публичной статикой (`/images/banner-X.jpg`). Важно: если на картинке нарисована кнопка, её координаты в процентах (`left`, `top`, `width`, `height`) должны совпадать с положением на картинке.

2. **Добавление нового слайда в `index.html`:**
   - Внутри `<div class="nebula-ad-track" id="nebula-ad-track">` добавляется новый блок `<div class="nebula-ad-slide" onclick="window.__nebulaAdSlideClick?.(N)">...</div>`, где `N` — порядковый индекс слайда (`0`, `1`, `2`, `3`...).
   - В `<div class="nebula-ad-dots" id="nebula-ad-dots">` добавляется соответствующая кнопка `<button type="button" class="nebula-ad-dot" aria-label="Слайд N+1" onclick="window.__nebulaAdGoTo?.(N)"></button>`.
   - В `src/ui/master-signal.ts` обновляется константа `AD_TOTAL_SLIDES` на актуальное количество слайдов.

3. **Настройка кликов и кнопок (CTA):**
   - **Клик по самому баннеру:** обрабатывается в `window.__nebulaAdSlideClick(idx)` в `src/ui/master-signal.ts` — можно привязать любую JS-функцию (открытие модалки, переход на вкладку, скролл к модулю или открытие внешней ссылки).
   - **Кнопка поверх баннера (например, ссылка в Telegram или рефералка биржи):** внутрь `.nebula-ad-slide` добавляется ссылка `<a href="https://..." target="_blank" rel="noopener noreferrer" class="nebula-ad-cta-hit" onclick="event.stopPropagation()"></a>` (при необходимости можно сделать отдельную кнопку или настраивать позицию через `data-` атрибуты / CSS-классы).
   - **Автопауза:** при наведении курсора (`mouseenter`) и при касании/свайпе на мобильном (`touchstart` / `touchend`) автоперелистывание (`AD_INTERVAL_MS = 6000`) автоматически ставится на паузу, чтобы пользователь успел нажать нужную кнопку или ссылку.

### Горячие клавиши ПК (`initHotkeys` в `src/ui/init.ts`)
- `Esc` — закрыть любую открытую шторку, модалку или список подсказок поиска.
- `/` или `Ctrl+K` — фокус на поле ввода тикера (главный или демо-режим).
- `1`–`6` (вне полей ввода) — переключение таймфреймов (`1m`, `15m`, `1h`, `1d`, `1w`, `1M`).

---

## 5. Известные проблемы / TODO

1. **Заставка:** при желании вернуть — переделать под новый плоский стиль (сейчас скрыта в `new-skin.css`).
2. **Watchlist UI:** доработать SVG-кольца (Altcoin Index, FNG) в стиле CoinMarketCap.
3. **Чистка `new-skin.css`:** в файле остались неиспользуемые правила `#screen-generic` и повторяющиеся блоки `.bottom-nav` / `#main-brand-pc` — при рефакторинге можно объединить.
4. **Tauri:** процесс `nebula.exe` иногда висит в фоне после закрытия окна.
5. **Архитектура:** `main.ts` импортирует 36 модулей; интерфейс `Candle` продублирован в нескольких файлах.
6. **HTTPS на сервере лицензий:** работает по HTTP (`cleartext: true` на Android).
7. **iOS:** код готов, но для сборки нужен Mac.

---

## 6. Стиль работы и правила для ИИ-ассистента

- **Среда разработчика:** Windows 11, VS Code, PowerShell, русский язык.
- **Формат правок кода:** строго блоками **«Найти: ... → Заменить на: ...»** с указанием файла. Не выдавать гигантские скрипты, которые ломают кодировку или дублируют ключи в `i18n.ts`.
- **Проверка:** после правок TypeScript всегда прогонять `npm run check`. При проблемах с кэшем CSS/Vite напоминать про `Remove-Item -Recurse -Force node_modules/.vite`.
- **Красные флаги (не трогать без бэкапа):** `src/main.ts`, `src/auth.ts`, `src/crypto.ts`, `src/trading.ts`, `src/sources/mexc.ts`, `src/sources/kucoin.ts`, `scripts/release.ps1`, `capacitor.config.ts`, `android/app/nebula-release.keystore`.

---

## 7. Шпаргалка команд (PowerShell)

### 🚀 Запуск и разработка
| Действие | Команда |
|---|---|
| Запуск Web | `npm run dev` |
| Запуск Windows (Tauri) | `npm run pc:dev` |
| Запуск Android (Live) | `npx cap run android` |

### 🛠️ Проверка и сборка
| Действие | Команда |
|---|---|
| Проверка типов | `npm run check` |
| Сборка Web | `npm run build` |
| Сборка Windows (.exe) | `npm run pc:build` |
| Синхронизация Web → Android | `npx cap sync android` |
| Сборка Android (.apk Debug) | `npm run android:build:debug` |
| Сборка Android (.apk Release) | `npm run android:build:release` |
| Полный релиз (Windows + Android + Git) | `.\scripts\release.ps1` |
| Релиз без сборки бинарников | `.\scripts\release.ps1 -SkipBuild` |
| Обновить карту проекта | `npm run context` |

### 🧹 Очистка
| Действие | Команда |
|---|---|
| Очистка кэша Vite | `Remove-Item -Recurse -Force node_modules/.vite` |
| Очистка Android | `cd android; .\gradlew.bat clean; cd ..` |
| Очистка Tauri | `Remove-Item -Recurse -Force src-tauri/target` |

### ☁️ Сервер лицензий (VPS Ubuntu)
`ssh -p 22 root@85.192.42.177`
- Перезапуск: `pm2 restart nebula-api`
- Логи: `pm2 logs nebula-api`
- База ключей: `sqlite3 /var/www/nebula-api/licenses.db "SELECT * FROM keys;"`

### 🔍 Отладка (DevTools → Application)
- **Память Оракула:** IndexedDB → `NebulaDB` → `oracleMemory`
- **Паттерны:** Local Storage → `nebulaLearnedPatterns`
- **Токен PRO / HWID:** Local Storage → `nebulaProToken` / `nebulaDeviceHwid`
- **Кэш CoinGecko:** Local Storage → `nebulaCgCache_<TICKER>`