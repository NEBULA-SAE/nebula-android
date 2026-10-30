# NEBULA Oracle Terminal — AI Context

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> Обновляется вручную при значимых изменениях архитектуры, бизнес-логики, роадмапа.
> Структурная карта проекта — отдельный файл `PROJECT_MAP.md` (генерируется автоматически).
>
> **Версия этого файла:** соответствует релизу **v2.0.19+** (2026-10-31)
> **Актуальная версия кода:** см. `package.json` → `version`
> **При расхождении:** верь `PROJECT_MAP.md` и `package.json`, они новее

---

## Как этим пользоваться

1. Открой **новый чат** с ИИ (Claude, ChatGPT, любой)
2. Приложи **два файла**:
   - `AI_CONTEXT.md` (этот) — «что за проект и как он думает»
   - `PROJECT_MAP.md` — «где что лежит» (автогенерится, актуален на момент последнего релиза)
3. Напиши промпт вида:
   > «Вот контекст проекта NEBULA. Изучи оба файла. Задача: [что нужно сделать]»
4. ИИ сразу в курсе — не нужно объяснять базовые вещи

**Проверка свежести:** если `PROJECT_MAP.md` показывает версию ниже, чем `package.json`, просто выполни `npm run context`, чтобы обновить карту.

---

## 1. TL;DR — что это за проект

**NEBULA Oracle Terminal** — персональный торговый терминал для криптовалютного рынка. Один TypeScript-код работает на трёх платформах: **Web** (браузер), **Android** (Capacitor 8), **Windows** (Tauri 2). Сделан одним разработчиком-трейдером в сотрудничестве с ИИ.

**Задача приложения:** дать розничному трейдеру то, что обычно доступно только профессионалам — глубокий анализ монеты с 6 бирж, метрики крупных игроков (киты, funding, OI), AI-наставник, который объясняет «что происходит» простым языком.

**Ключевая фишка:** алгоритм **Oracle** — скоринг от -100 до +100, который агрегирует технические индикаторы, поведение китов, стакан, funding rate, on-chain активность и историческое обучение. На основе скоринга выдаёт вердикт (strong_buy / buy / hold / avoid) и рекомендует размер позиции. Плюс визуальный **Oracle Overlay** на графике и модуль **«Зеркало истории»**.

**Не является:** финансовым советником, торговым ботом с автоисполнением без подтверждения. Все ордера размещаются только после явного клика пользователя.

---

## 2. Стек и платформы

| Слой | Технология | Версия |
|---|---|---|
| Frontend | TypeScript + Vite | TS 5.6, Vite 5.4 |
| Графики | lightweight-charts | 4.2 |
| Android | Capacitor | 8.5 |
| Windows | Tauri | 2.x (Rust + WebView2) |
| AI | Groq API | модель `openai/gpt-oss-120b` |
| Криптография | Web Crypto API | AES-256-GCM + PBKDF2 (150k итераций) |
| Хранилище | localStorage | шифруется мастер-паролем |
| Worker | Web Worker (inline Blob) | RSI + batch scanner |

**Идентификатор приложения:** `com.nebula.oracle`
**Android:** min SDK 24, target SDK 36, versionCode — инкрементится при каждом релизе
**Windows:** требует WebView2 (встроен в Win11, отдельно для Win10)
**Bundle size:** ~470 KB dist, ~7.1 MB APK, ~7 MB EXE

---

## 3. Архитектура — data flow

┌─────────────────────────────────────────────────────────────┐
│ User action (GO button / ticker Enter) │
└────────────────────────┬────────────────────────────────────┘
▼
mobileAnalyze() [src/ui/oracle.ts]  <-- Защищен _analyzeGen
│
┌────────────────┼────────────────┐
▼ ▼ ▼
fetchCandlesWithSource getWhaleFuturesMetrics fetchExtras
[6 бирж race] [Bybit+OKX+Binance] [orderbook+funding]
│ │ │
▼ ▼ ▼
300 свечей OI/LSR/Taker bid/ask pressure
│
▼
engineOracleAnalyze() [src/oracle.ts]
│ ┌─────────────────────────────────┐
│ │ tech (RSI/MACD/BB/ADX/Stoch) │
│ │ + whale score (OBV/volume) │
│ │ + obs (bids vs asks) │
│ │ + funding (short squeeze) │
│ │ + onchain (DEX activity) │
│ │ + learned (pattern memory) │
│ │ + market (F&G modifier) │
│ └─────────────────────────────────┘
▼
score: -100 … +100
│
▼
verdict + confidence + plan + 3-scenarios (base/bull/bear)
│
▼
┌────┴────┬─────────┬──────────┬────────────┬────────────┐
▼ ▼ ▼ ▼ ▼ ▼
renderPro setCandles whale- renderOracle agent-card Multi-TF
(pro tab) +drawNow radar Dashboard (AI Mentor) Confluence
          +overlay (whale signals)

Параллельно при старте:
- `loadBTC()` — карточка BTC каждые 90 сек
- `initTimeframeBar()` — панель tf + WebSocket стрим
- `runFullDiagnostics()` — раз в сутки
- `initAlertsLoop()` — проверка алертов каждые 30 сек
- `initOracleOverlay()` — кнопка 🔮 на графике
- Splash Screen — 8 секунд, гироскоп-параллакс, кометы

---

## 4. Бизнес-логика — сердце проекта

### 4.1 Oracle scoring (главное!)

Файл: `src/oracle.ts` → `oracleAnalyze()`

**Формула скоринга:**

score = tech // технический анализ
      + whale_score // поведение китов
      + obs_score // стакан (bids vs asks)
      + funding_score // funding rate
      + onchain_score // DEX активность
      + learned_score // обучаемая память паттернов
      + man_score // манипуляции (искусственный сброс)
      + aggr_modifier // рыночный контекст (Fear&Greed)

**Вердикт по score:**
| Score | Verdict | Смысл |
|---|---|---|
| ≥ 50 | `strong_buy` | Сильный сигнал на покупку |
| ≥ 25 | `buy` | Умеренный сигнал |
| ≥ -10 | `hold` | Смешанная картина, ждать |
| < -10 | `avoid` | Риск превышает потенциал |

**Confidence** = `clamp(50 + score, 20, 95)`. То есть score +50 даёт confidence 95% (максимум), score -100 даёт 20% (минимум).

**Позиция:**

pos = min(profile_max_position_size, max_risk_per_trade * 5)
if (confidence < 55) pos *= 0.4

**Риск-профили** (из квиза 3 вопроса):
| Уровень | max_risk_per_trade | max_position_size |
|---|---|---|
| conservative | 0.5% | 5% |
| balanced | 1.5% | 15% |
| aggressive | 3.0% | 30% |

### 4.2 Multi-TF Confluence

Файл: `src/sources/confluence.ts` → `getConfluence()`
Анализирует монету на **трёх таймфреймах одновременно**: 1h, 1d, 1w. 
Для каждого считает RSI, MACD (hist), Stoch RSI. Выдаёт `verdict` (buy/hold/avoid) для каждого ТФ.
- Если все 3 — BUY → `overall = 'strong_buy'`.
- Если 2 из 3 BUY → `overall = 'buy'`.
- Если все 3 AVOID → `overall = 'avoid'`.

### 4.3 Whale detection (Радар крупного капитала)

Файл: `src/ui/whale.ts` → `calculateVolumeAnomalies()`, `mergeWhaleMetrics()`, `buildSignals()`
**Volume anomaly:** Z-score > 2.5 → `isWhaleActive = true`.
**OBV trend:** rising / falling / neutral.
**Futures metrics** (`src/sources/whale-futures.ts`): OI change 24h, LSR Top/Global, Taker Buy/Sell (Bybit, OKX, Binance).
**UI:** Выводит общий **Whale Score (0-100)**. Сигналы сортируются по силе. Каждый сигнал содержит не только цифры, но и блоки «Что это» и «💡 Как реагировать» для новичков.

### 4.4 AI Mentor (Groq) — Три сценария

Файл: `src/ai.ts` → `getAiMentor()`
Отправляет в Groq все метрики + паттерны. Просит ответить строго по 3 сценариям:
1. `### BASE` — Логика (как я думаю).
2. `### BULL` — Оптимистичный сценарий с вероятностью (X%) и рисками.
3. `### BEAR` — Скептический сценарий с вероятностью (Y%) и шансами на отскок.
4. `### VERDICT` — Итоговая строка.
Ответ парсится в `src/ui/oracle.ts` → `askAIMentor()` и выводится в виде 3-х табов (База / Бычий / Медвежий). Если ИИ недоступен, `oracleAnalyze` сам считает вероятности на основе score и volatility.

### 4.5 Сканер дна

Файл: `src/ui/scanner.ts` → `runScanner()`
Проходит топ-200 монет (Gate.io). Загружает 120 свечей (Binance → Gate.io). Считает RSI, rebound, drop через Worker. Оставляет только `RSI < 45 && rebound < 30 && drop > 40`.

### 4.6 Планы и мониторинг

Файл: `src/trading.ts`
**Grid plan:** делит инвестиции на N шагов.
**Мониторинг:** WebSocket на `stream.binance.com`, отслеживает исполнение.
**TWAP:** разбивает ордер на N слайсов за M минут.

### 4.7 Risk Command Center + Help

Файл: `src/ui/risk.ts`
Экран «Риски». Собирает 5 индикаторов: Концентрация, Уверенность Оракула, Активность китов, Funding rate, Fear & Greed. Выдаёт общий светофор.
Кнопка `ℹ️` вызывает модалку `showRiskHelp()` с расшифровкой каждого индикатора (RU/EN).

### 4.8 Trade Journal

Файл: `src/ui/oracle.ts` → `openJournalEntry()`
На вкладке «Оракул» в списке последних анализов записи кликабельны. Открывается модалка: вердикт, score, RSI на входе, активность китов, funding и реальный результат.

### 4.9 Oracle Chart Overlay (Level 2)

Файл: `src/ui/chart-overlay.ts`
Кнопка **🔮 Логика** на графике. Показывает, *почему* Оракул принял решение (🐋 аномальный объём, 🟢/🔴 MACD, 🔵/🟣 Bollinger, 🟨 Funding). Рядом кнопка `ℹ️` — открывает справку.

### 4.10 Historical Analogies (Зеркало истории)

Файл: `src/oracle.ts` → `oracleGetAnalogies()`
Оракул ищет в памяти завершенные анализы, где RSI и процент падения (drop_pct) были похожи на текущие (±10 RSI, ±15% drop). Выдает Win Rate, среднюю доходность и список последних 5 совпадений.

### 4.11 Dash Network (Секция в карточке китов)

Файл: `src/ui/dash.ts`
Сворачиваемая секция для монеты DASH. Показывает мастерноды, хэшрейт и деривативы (Bybit funding). Данные грузятся лениво только при развороте аккордеона. Содержит простые пояснения «Как реагировать» на русском и английском языках.

---

## 5. Безопасность

Файлы: `src/auth.ts`, `src/crypto.ts`
**Мастер-пароль:** хранится только хеш (SHA-256) в localStorage. Сам пароль в sessionStorage.
**Шифрование ключей:** AES-256-GCM + PBKDF2 (150k итераций). MEXC: `nebulaConfig`, KuCoin: `nebulaConfig`, Groq API: `nebulaGroqKey`.
**Биометрия (Android):** `@capgo/capacitor-native-biometric`.

---

## 6. Обход CORS — три платформы

Все три в `src/main.ts` + `src/platform/http.ts`.
**Web (dev):** Vite proxy в `vite.config.ts` (включая `/proxy/kucoin`).
**Android (Capacitor):** `CapacitorHttp` перехватывает `window.fetch`.
**Windows (Tauri):** `@tauri-apps/plugin-http` для whitelist-доменов (`TAURI_PROXY_HOSTS`).

---

## 7. UI — Экраны и Заставка

Файл: `index.html` (разметка) + `src/ui/*.ts` (логика)
**Bottom nav (7 вкладок):** home, pro, scanner, fav, oracle, risk, portfolio.
**Модалки:** Alerts, Radial menu, Demo mode, Terms, App lock, Sheets.
**Splash Screen:** Обновлен (v2.2 Blockbuster). Работает 8 секунд. Canvas-анимация: параллакс от мыши (ПК) и гироскопа/тача (смартфоны), падающие кометы, глубокий космос. Логотип увеличен до 420px (min(80vw, 420px)).

---

## 8. WebSocket — real-time цена и защита от Race Conditions

Файл: `src/sources/stream.ts` (класс `PriceStream`)
**Источники: Binance и KuCoin.**
**Критический фикс:** При формировании URL в `stream.ts` теперь принудительно добавляется `USDT` к тикеру (если его нет). Это решило проблему кода `1008` (policy violation) и бесконечных реконнектов на Binance.
**Логика и защита:**
- При смене tf/тикера — `destroy()` + `connect()`.
- Защита от «фантомных» свечей: `if (this.destroyed) return;`.
- **Гонка при анализе:** `_analyzeGen` в `mobileAnalyze`.
- **Оптимизация:** Для смены таймфрейма используется легкая `loadChartOnly()`.

---

## 9. Релиз и сборка

**Скрипт:** `scripts/release.ps1` (проверка env, сканирование секретов, `npm run check`, bump версий, очистка кэша Tauri, сборка, коммит, пуш).
**Команды:** `npm run dev`, `npm run pc:build`, `npm run android:build:release`, `npm run check`, `npm run context`.

---

## 10. Known issues / TODO

**Обучение Оракула (`src/ui/learning.ts`):**
- 3 TODO-заглушки: `oracleGetStats`, `oracleUpdateOutcomes`, `oracleLearnPatterns` не подключены к UI.

**Tauri эксклюзивы (в config есть, не активированы):**
- Tray icon, Глобальные хоткеи, Mini-режим окна, Auto-updater.

**Проблема с `nebula.exe`:** процесс висит после закрытия (WS не закрывается).

**Duplicate exports:** `Candle` в 5 файлах, `PlanStep` в 2, `WallsData` в 2.

**Android `allowBackup`:** стоит `"true"`, лучше поставить `"false"`.

---

## 11. Стиль разработки и общения

**Разработчик:** Русскоязычный, Windows 11 + VS Code + PowerShell.
**Стиль ответов ИИ:** Русский язык, развёрнуто и по делу. Готовые команды PowerShell. Проверка после каждого шага.
**Критично:** Если нужно заменить код, нужно указывать точный блок "Найти: ... Заменить на: ...". Не давать абстрактных инструкций.

---

## 12. Красные флаги — что НЕ делать без бэкапа

**Критичные файлы:** `main.ts`, `auth.ts`, `crypto.ts`, `trading.ts`, `sources/mexc.ts`, `sources/kucoin.ts`.
**Где важна каждая строка:** `release.ps1`, `candles.ts`, `chart.ts`, `stream.ts`.
**Где легко сломать кодировку:** `index.html`, `i18n.ts`, `terms.ts`.
**Keystore:** `android/app/nebula-release.keystore` — не трогать, лежит в `.gitignore`.

---

## 13. Полезные команды для ИИ

**Покажи что изменилось:** `git log --oneline -5`, `git status --short`.
**Проверь что не сломалось:** `npm run check`.
**Что в проекте сейчас:** `Get-Content package.json -Raw | Select-String '"version"'`.

---

## 14. История версий

| Версия | Дата | Ключевое |
|---|---|---|
| v2.0.19+ | 2026-10-31 | Dash Accordion (переводы + ленивая загрузка), Whale Radar (сигналы с простыми подсказками), AI 3-сценария (Base/Bull/Bear), Blockbuster Splash (8 сек, гироскоп, кометы, огромный лого), фикс Binance WS (1008). |
| v2.0.15+ | 2026-10-30 | Зеркало истории, оптимизация графиков (шторка загрузки + loadChartOnly), фикс Taker (300.11), обновление иконок и лого, хелп в Рисках, Landscape fix |
| v2.0.7+ | 2026-10-28 | Фикс гонки графиков (race condition), фикс KuCoin candles, Oracle Overlay (Level 2), 7-сек заставка с пульсом, автоочистка bundle при релизе |
| v2.0.5+ | 2026-10-27 | KuCoin (все модули), Risk Center, Alerts, Multi-TF, Trade Journal, i18n, pull-refresh v3.2, radar v2 |
| v2.0.2 | 2026-10-25 | WebSocket real-time, pull-refresh v3, build-all fix версий |

---

## 15. Быстрые напоминания

- **Текущая версия:** см. `package.json`.
- **PROJECT_MAP.md** — генерируется при релизе.
- **Keystore** — `Nebula2026!`, alias `nebula`.
- **JDK 21** — `C:\Program Files\Android\Android Studio\jbr`.
- **GitHub** — https://github.com/NEBULA-SAE/nebula-android
- **Текущая задача** — обсуждена в чате, если непонятно, спроси у пользователя.