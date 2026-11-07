# NEBULA Oracle Terminal — AI Context & Operations Manual

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> **Версия файла:** соответствует релизу **v2.3.0+** (Ноябрь 2026)
> **Актуальная версия кода:** см. `package.json`

---

## 1. TL;DR — что это за проект

**NEBULA Oracle Terminal** — персональный торговый терминал для криптовалютного рынка. Один TypeScript-код работает на трёх платформах: **Web** (браузер), **Android** (Capacitor 8), **Windows** (Tauri 2). 

**Ключевая фишка:** алгоритм **Oracle** — скоринг от -100 до +100, агрегирующий технические индикаторы, поведение китов, стакан, funding rate, экспертные паттерны и историю. Выдаёт вердикт (strong_buy / buy / hold / avoid), рекомендует позицию и генерирует 3 сценария через AI (Groq).

**НОВОЕ (v2.3.0) — BTC Outlook (PRO):** Модуль исторического анализа биткоина. Включает: kNN-анализ пробоев ATH (вероятность пробоя на 7/30/90/365 дней), календарь «Этот день в истории BTC», анализ ATH-циклов и адаптивную подсветку (glow) карточки BTC на главном экране в зависимости от 24ч изменения.

**Умный Оракул (Smart Learning):** Оракул самообучается. Накапливает историю в IndexedDB (схема v3), считает калибровку уверенности, генерирует человекочитаемые «Инсайты», а также применяет экспертные паттерны (Wyckoff, капитуляция, LSR-дивергенция) напрямую в скоринге.

**Монетизация:** Система подписок PRO (HWID). Закрытые фичи: ИИ без лимитов, Продвинутая аналитика, Риски, Радар китов, **BTC Outlook**.

---

## 2. Стек и платформы

| Слой | Технология |
|---|---|
| Frontend | TypeScript + Vite 5.4 |
| Графики | lightweight-charts 4.2 |
| Android | Capacitor 8.5 (настроен `cleartext: true` для HTTP) |
| Windows | Tauri 2.x |
| AI | Groq API (`openai/gpt-oss-120b`) + SSE Streaming |
| Криптография | Web Crypto API (AES-256-GCM + PBKDF2) |
| Хранилище | **IndexedDB** (память Оракула v3) + localStorage (настройки, токен PRO) |
| Внешние окна | `@capacitor/browser` (iOS/Android) + `@tauri-apps/plugin-opener` (Windows) |
| Ориентация | `@capacitor/screen-orientation` (поворот экрана при fullscreen графике) |
| License Server | Node.js + SQLite (VPS: `http://85.192.42.177:3000`) |

**Идентификатор приложения:** `com.nebula.oracle`

---

## 3. РЕАЛЬНАЯ Архитектура

### ✅ Ключевые модули:
1. **PRO License System (`src/pro.ts`)**: Проверяет лицензию, генерирует HWID, отправляет запросы на VPS.
2. **Promise-Кэш (Network Deduplication):** В `candles.ts` и `orderbook.ts`. Один запрос на всех.
3. **Data Threading:** В `ui/oracle.ts` свечи загружаются раз и передаются в `market.ts`, `oracle.ts`, `confluence.ts`.
4. **IndexedDB (`src/db.ts` + `src/oracle.ts`):** Память Оракула (`nebulaMemory`). Схема v3. Автоматическая миграция со старых версий при инициализации (`initOracleDb`).
5. **I18N (Мультиязычность):** Полный словарь в `src/i18n.ts`. Все названия паттернов (ключи вида `rsi_mid|whale_buying`) переводятся на лету через `humanizePattern()` в `patterns.ts`. Заголовки Watchlist привязаны к ID (`lbl-fmh-mcap` и т.д.) через `applyStaticTranslations()` в `screens.ts`.
6. **Webview Handler (`src/platform/browser.ts`):** Безопасный мост для открытия сторонних сервисов (P2P, Свопы, WhatToMine). Блокирует фишинговые домены через `allowedHosts`.
7. **Fullscreen Chart:** В `chart-overlay.ts` реализован вырыв карточки графика в `body` с принудительным ресайзом через `ResizeObserver` и `ScreenOrientation.lock('landscape')`.
8. **Learning Core (`src/learning-core.ts`):** Чистые функции для аналитики обучения (калибровка, инсайты, дрифт).
9. **Watchlist UI (`src/ui/scanner.ts` + `src/ui/screens.ts`):** Функция `renderFavorites` асинхронно грузит `getMarketContext` (макро-метрики) и `fetchCandlesWithSource` (спарклайны). Для капитализации используется `CoinPaprika` через VPS-прокси (обход CORS). Чтобы таблица не ломалась, используется жесткий инлайн-стиль `display: flex !important; flex-direction: column !important;` на контейнере `#fav-list`.
10. **BTC Outlook Engine (`src/btc/outlook-engine.ts` + `src/ui/btc-outlook.ts`):** Новый PRO-модуль. Движок (`outlook-engine.ts`) вычисляет исторические ATH-циклы, вероятности пробоя ATH с помощью kNN-анализа (по историческим неделям с похожим drawdown), а также календарное сравнение «Этот день в истории». UI (`btc-outlook.ts`) рендерит модальное окно с 4 вкладками и управляет CSS-переменными для Glow-эффекта карточки BTC.

---

## 4. Бизнес-логика — сердце проекта

### 4.1 Oracle Scoring (Ядро)
Файл: `src/oracle.ts` → `oracleAnalyze()`
Формула: `score = tech + whale + obs + funding + onchain + learned + man + market_context + pattern_bonus`
* **pattern_bonus**: новый параметр (+6 за каждый бычий паттерн из `patterns.ts`, -6 за медвежий, макс ±18).

### 4.2 Smart Learning (Обучение и Память)
* **Сбор исходов (`oracleUpdateOutcomes`):** Асинхронный, батчами по 5 (макс 50 за раз). 
  * `hold` не считается убытком — он помечается как `flat`.
  * `avoid` (шорт) оценивается наоборот: если цена упала — это `win`, если выросла — `loss`.
  * Есть защита от «фейковых» старых побед (сбрасываются в pending).
* **Калибровка:** Считается, насколько уверенность Оракула соответствует реальности.
* **Инсайты (`computeInsights`):** Оракул сам пишет себе «дневник»: "Выучил новый паттерн (Win Rate 100% на 24 сделках)", "Паттерн X перестал работать", "Ошибка калибровки 33%".
* **Drift:** Недельные снимки метрик (Win Rate, Profit Factor) для отслеживания прогресса.

### 4.3 AI Mentor (Groq) с печатной машинкой
Файл: `src/ai.ts` → `getAiMentor()`, `src/ui/oracle.ts` → `askAIMentor()`.
**Лимиты:** Free — 3 запроса в день. PRO — безлимит.

### 4.4 Whale Radar + PRO блокировки
Файл: `src/ui/whale.ts`. Собирает метрики (OI, LSR, Taker). 
**Free:** Volume (Z-score) и OBV. **PRO:** OI, LSR, Taker, X-Ray, Walls.

### 4.5 Multi-TF Confluence
Файл: `src/sources/confluence.ts`. Анализирует 1h, 1d, 1w.

### 4.6 Web3 Интеграция (P2P & Инструменты)
- **Файл:** `src/platform/browser.ts`.
- **Сервисы:** Binance P2P, Xgram (анонимный своп), WhatToMine (калькулятор майнинга).
- **UI:** Одна кнопка «Обмен» в шапке (`openExchangeMenu`).
- **Безопасность:** В `capacitor.config.ts` и `browser.ts` (allowedHosts) белые списки доменов.

### 4.7 PRO License System (Монетизация)
- **Сервер:** Node.js + SQLite (VPS).
- **Генерация:** `admin-gen.html`.
- **Клиент:** `src/pro.ts` (`nebulaProToken`).
- **Стоимость:** Early Bird $29, Regular $249, Monthly $2.99, Yearly $19.99.

### 4.8 BTC Outlook (Историческая аналитика)
- **Доступ:** Только для PRO. Проверка `checkLocalProStatus()` при клике на кнопку в карточке BTC.
- **Исторические ATH:** Захардкожены в `outlook-engine.ts` для расчета циклов (с 2011 по 2024 гг.).
- **Вероятность пробоя:** Функция `computeBreakoutProbability` использует kNN по историческим недельным свечам (`fetchCandlesWithSource('BTC', 'max')`). Сравнивает текущий drawdown от ATH с историческими (±5%) и считает, как часто цена пробивала ATH за 7, 30, 90 и 365 дней.
- **Календарь:** Функция `computeCalendarComparison` ищет ближайшую дату в каждом году и проверяет, был ли рядом установлен ATH.

---

## 5. UI и Заставка
Файл: `index.html`
**Главный экран (`#screen-home`):**
- Разделён на 2 свайп-таба с помощью `.home-tabs-wrap`: **📈 График** и **⭐ Избранное**.
- Переключение реализовано через `switchHomeTab('main'|'fav')` в `src/ui/screens.ts`.

**Карточка BTC и BTC Outlook:**
- В карточке BTC (`#btc-card` / `.btc-card`) добавлена кнопка «История и прогноз» с бейджем PRO.
- **Glow-эффект:** При обновлении цены вызывается `applyBtcGlow(change_24h)` из `src/ui/btc-outlook.ts`. Он устанавливает CSS-переменные `--glow-color` (mint/coral/cyan) и `--glow-intensity` на карточку BTC. При интенсивности > 0.6 включается пульсация.
- **Модалка (`#btc-outlook-overlay`):** 4 вкладки (Снимок, Пробой ATH, Этот день, Циклы). Стили вынесены в `public/styles/btc-outlook.css`.

**Вкладка «Избранное»:**
- **Верхние метрики (`#fav-market-header`):** 4 карточки (Market Cap, CMC20, Altcoin Index, Fear & Greed).
- **Таблица монет (`#fav-list`):** Сетка `grid-template-columns: 40px 1.5fr 1fr 1fr 100px 80px 40px;`

**Экран «Обучение Оракула» (модалка):**
- 3 таба: Обзор, Паттерны, Инсайты.

**Остальные экраны:** scanner, oracle (дашборд), risk, portfolio, pro.

---

## 6. Безопасность
Файлы: `src/auth.ts`, `src/crypto.ts`
Шифрование ключей AES-256-GCM + PBKDF2 (150k). Пароль в sessionStorage, хеш в localStorage. Биометрия (Android) через `@capgo/capacitor-native-biometric`.

---

## 7. WebSocket и Real-time
Файл: `src/sources/stream.ts` (класс `PriceStream`)
**Фикс:** Символ всегда дополняется до `USDT` (иначе Binance закрывает с кодом 1008).
**Фикс Heartbeat:** Пинг только для KuCoin.

---

## 8. Известные проблемы / TODO
1. **Заставка:** Требуется полная замена на новую (арбузная шкала загрузки).
2. **Watchlist UI:** Нужно переделать SVG-кольца (Altcoin Index, FNG) в стиле CoinMarketCap (цветные, с цифрами внутри).
3. **I18N Дубликаты:** Следить, чтобы ключи `fav_market_cap` и `btc_outlook_*` были в единственном экземпляре в RU и EN секциях.
4. **Tauri:** Процесс `nebula.exe` висит после закрытия.
5. **God Object `main.ts`:** Импортирует 36 файлов из 46.
6. **Duplicate Exports:** Интерфейс `Candle` объявлен в нескольких файлах.
7. **HTTPS на сервере:** Сервер лицензий работает по HTTP. Для Android включен `cleartext: true`.
8. **iOS (iPhone):** Код готов к сборке, но нужен Mac.

---

## 9. Стиль разработки и общения
**Разработчик:** Русскоязычный, Windows 11, VS Code, PowerShell.
**Стиль:** Развёрнуто, структурированно. Готовые команды PowerShell.
**Критично:** При замене кода использовать блоки "Найти: ... Заменить на: ...". Всегда проверять `npm run check`. **Не давать огромных скриптов, которые ломают кодировку или дублируют ключи в словарях.** При правках CSS всегда напоминать про сброс кэша (`Remove-Item -Recurse -Force node_modules/.vite`).

---

## 10. Красные флаги (Не трогать без бэкапа)
* `main.ts` (патчи fetch)
* `auth.ts`, `crypto.ts` (ключи пользователя)
* `trading.ts`, `sources/mexc.ts`, `sources/kucoin.ts` (реальные деньги)
* `release.ps1` (может затереть старые версии)
* `android/app/nebula-release.keystore` (потеря = невозможность обновить приложение).
* `capacitor.config.ts` (неправильный `allowNavigation` может сломать WebView).

---

## 11. История версий (последние)
| Версия | Ключевое |
|---|---|
| v2.3.0+ | **BTC Outlook (PRO):** Добавлен модуль исторической аналитики биткоина. kNN-анализ пробоев ATH, календарь «Этот день в истории», ATH-циклы. Динамический Glow-эффект карточки BTC на главном экране. PRO-гейт на открытие модалки. |
| v2.2.2+ | Фикс верстки Избранного: инлайн-стили `flex-direction: column` для `#fav-list`. Починка привязки переводов к карточкам через `screens.ts`. Добавлен прокси для CoinPaprika. Адаптив карточек на мобилках (2x2). |
| v2.2.0+ | **Биржевой Watchlist:** Вкладка Избранное на главном экране (свайп-таб). 4 макро-метрики (Market Cap, CMC20, Altcoin Index, FNG). Таблица со спарклайнами. |
| v2.1.0+ | **Умный Оракул (Smart Learning):** Схема памяти v3, калибровка уверенности, инсайты, дрифт, UI на 3 таба, паттерны (Wyckoff) в скоринге, фикс математики WIN/LOSS. |
| v2.0.30+ | Интеграция Web3 (P2P, Xgram, WhatToMine), встроенный браузер, полная локализация RU/EN, полноэкранный график. |

---

## 12. ПОЛНАЯ ШПАРГАЛКА КОМАНД (PowerShell)

### 🚀 Запуск и разработка
| Действие | Команда |
|---|---|
| **Запуск Web** | `npm run dev` |
| **Запуск Windows (Tauri)** | `npm run pc:dev` |
| **Запуск Android (Live)** | `npx cap run android` |

### 🛠️ Проверка и сборка
| Действие | Команда |
|---|---|
| **Проверка типов** | `npm run check` |
| **Сборка Web** | `npm run build` |
| **Сборка Windows (.exe)** | `npm run pc:build` |
| **Сборка Android (.apk Debug)** | `npm run android:build:debug` |
| **Сборка Android (.apk Release)** | `npm run android:build:release` |
| **Полный релиз (Всё сразу)** | `.\scripts\release.ps1` |
| **Синхронизировать Web -> Android** | `npx cap sync android` |

### 🧹 Очистка и переустановка
| Действие | Команда |
|---|---|
| **Очистка кэша Vite (КРИТИЧНО при правках)** | `Remove-Item -Recurse -Force node_modules/.vite` |
| **Очистка Android сборки** | `cd android; .\gradlew.bat clean; cd ..` |
| **Очистка сборки Tauri** | `Remove-Item -Recurse -Force src-tauri/target` |
| **Полная переустановка** | `Remove-Item -Recurse -Force node_modules; Remove-Item -Force package-lock.json; npm install` |

### ☁️ Сервер (VPS Ubuntu)
Зайти на сервер: `ssh -p 22 root@85.192.42.177`
| Действие | Команда |
|---|---|
| **Перезагрузить сервер ключей** | `pm2 restart nebula-api` |
| **Логи сервера** | `pm2 logs nebula-api` |
| **Пароль админа** | `cat /var/www/nebula-api/server.js \| grep ADMIN_SECRET` |
| **База ключей** | `sqlite3 /var/www/nebula-api/licenses.db "SELECT * FROM keys;"` |

### 🔍 Отладка
| Действие | Инструкция |
|---|---|
| **База Оракула (Память)** | F12 -> Application -> IndexedDB -> NebulaDB -> oracleMemory. |
| **Выученные паттерны** | F12 -> Application -> Local Storage -> `nebulaLearnedPatterns`. |
| **Токен PRO** | F12 -> Application -> Local Storage -> `nebulaProToken`. |
| **HWID** | `localStorage.getItem('nebulaDeviceHwid')` |
| **Метрики Watchlist** | Элементы `fmh-mcap`, `fmh-cmc20`, `fmh-alt`, `fmh-fng` (и их `-change`, `-ring`, `-bar`). |
| **Список плагинов Android** | `npx cap ls android` |