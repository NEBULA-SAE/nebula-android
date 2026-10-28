# NEBULA Oracle Terminal — AI Context

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> Обновляется вручную при значимых изменениях архитектуры, бизнес-логики, роадмапа.
> Структурная карта проекта — отдельный файл `PROJECT_MAP.md` (генерируется автоматически).
>
> **Версия этого файла:** соответствует релизу **v2.0.5+** (2026-10-27)
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

**Ключевая фишка:** алгоритм **Oracle** — скоринг от -100 до +100, который агрегирует технические индикаторы, поведение китов, стакан, funding rate, on-chain активность и историческое обучение. На основе скоринга выдаёт вердикт (strong_buy / buy / hold / avoid) и рекомендует размер позиции.

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
mobileAnalyze() [src/ui/oracle.ts]
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
verdict + confidence + plan
│
▼
┌────┴────┬─────────┬──────────┬────────────┬────────────┐
▼ ▼ ▼ ▼ ▼ ▼
renderPro setCandles whale- renderOracle agent-card Multi-TF
(pro tab) +drawNow radar Dashboard (AI Mentor) Confluence
text


Параллельно при старте:
- `loadBTC()` — карточка BTC каждые 90 сек
- `initTimeframeBar()` — панель tf + WebSocket стрим
- `runFullDiagnostics()` — раз в сутки
- `initAlertsLoop()` — проверка алертов каждые 30 сек
- тема из localStorage

---

## 4. Бизнес-логика — сердце проекта

### 4.1 Oracle scoring (главное!)

Файл: `src/oracle.ts` → `oracleAnalyze()`

**Формула скоринга:**

score = tech // технический анализ

    whale_score // поведение китов

    obs_score // стакан (bids vs asks)

    funding_score // funding rate

    onchain_score // DEX активность

    learned_score // обучаемая память паттернов

    man_score // манипуляции (искусственный сброс)

    aggr_modifier // рыночный контекст (Fear&Greed)

text


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
text


**Риск-профили** (из квиза 3 вопроса):
| Уровень | max_risk_per_trade | max_position_size |
|---|---|---|
| conservative | 0.5% | 5% |
| balanced | 1.5% | 15% |
| aggressive | 3.0% | 30% |

### 4.2 Multi-TF Confluence (Новое)

Файл: `src/sources/confluence.ts` → `getConfluence()`

Анализирует монету на **трёх таймфреймах одновременно**: 1h, 1d, 1w. 
Для каждого считает RSI, MACD (hist), Stoch RSI. Выдаёт `verdict` (buy/hold/avoid) для каждого ТФ.
- Если все 3 — BUY → `overall = 'strong_buy'` (уверенность ~97%).
- Если 2 из 3 BUY → `overall = 'buy'`.
- Если все 3 AVOID → `overall = 'avoid'`.
Если данных мало (<2 ТФ) — карточка скрывается.

### 4.3 Whale detection

Файл: `src/ui/whale.ts` → `calculateVolumeAnomalies()`, `mergeWhaleMetrics()`

**Volume anomaly:** если объём последних 2 свечей > 180% от среднего за 30 дней → `isWhaleActive = true`

**OBV trend:** rising / falling / neutral — по накоплению объёма

**Futures metrics** (`src/sources/whale-futures.ts`):
- **OI change 24h** — Bybit → Binance fallback. > +5% = rising, < -5% = falling
- **LSR Top Traders** — OKX → Binance → Bybit.
- **LSR Global** — Bybit → Binance.
- **Taker Buy/Sell** — OKX → Binance.
*(KuCoin Futures не поддерживает публичное API для LSR и истории OI, поэтому участвует только в Funding Rate).*

### 4.4 AI Mentor (Groq)

Файл: `src/ai.ts` → `getAiMentor()`

Отправляет в Groq **все** метрики + совпадения с базой паттернов. Просит ответить строго по 7 блокам (Что происходит, На что похоже, Почему так, За и против, Сценарии, Что делать, Уверенность).
**Объём:** 350-450 слов.
**Модель:** `openai/gpt-oss-120b`.

### 4.5 Сканер дна

Файл: `src/ui/scanner.ts` → `runScanner()`
Проходит топ-200 монет (Gate.io). Загружает 120 свечей (Binance → Gate.io). Считает RSI, rebound, drop через Worker. Оставляет только `RSI < 45 && rebound < 30 && drop > 40`.

### 4.6 Планы и мониторинг

Файл: `src/trading.ts`
**Grid plan:** делит инвестиции на N шагов.
**Мониторинг:** WebSocket на `stream.binance.com`, отслеживает исполнение.
**TWAP:** разбивает ордер на N слайсов за M минут.

### 4.7 Risk Command Center (Новое)

Файл: `src/ui/risk.ts`
Экран «Риски» (7-я вкладка). Собирает 5 индикаторов:
1. Концентрация портфеля (доля топ-1 монеты).
2. Уверенность Оракула (confidence текущего анализа).
3. Активность китов (isWhaleActive).
4. Funding rate (экстремумы).
5. Fear & Greed (страх/жадность).
Выдаёт общий светофор (low/medium/high) с пульсирующей анимацией.

### 4.8 Trade Journal (Новое)

Файл: `src/ui/oracle.ts` → `openJournalEntry()`
На вкладке «Оракул» в списке последних анализов записи теперь кликабельны. При клике открывается модалка с полной историей: вердикт, score, RSI на входе, активность китов, funding и реальный результат (Win/Loss в %).

---

## 5. Безопасность

Файлы: `src/auth.ts`, `src/crypto.ts`

**Мастер-пароль:** хранится только хеш (SHA-256) в localStorage. Сам пароль в sessionStorage.
**Шифрование ключей:** AES-256-GCM + PBKDF2 (150k итераций).
- MEXC: `nebulaConfig`
- KuCoin: `nebulaConfig` (exchange: 'kucoin')
- Groq API-ключ: `nebulaGroqKey`
**Биометрия (Android):** `@capgo/capacitor-native-biometric`.

---

## 6. Обход CORS — три платформы

Все три в `src/main.ts` + `src/platform/http.ts`.

**Web (dev):** Vite proxy в `vite.config.ts`. Добавлены прокси `/proxy/kucoin` и `/proxy/kucoin-futures`.
**Android (Capacitor):** `CapacitorHttp` перехватывает `window.fetch`. Обёрнут в `Promise.race` с `AbortSignal.timeout`, чтобы не висело по 30-60 сек.
**Windows (Tauri):** `@tauri-apps/plugin-http` для whitelist-доменов.
В `TAURI_PROXY_HOSTS` добавлены: `api.kucoin.com`, `api-futures.kucoin.com`.

---

## 7. UI — 7 экранов

Файл: `index.html` (разметка) + `src/ui/*.ts` (логика)

**Bottom nav (7 вкладок):**
1. **home** — график + verdict + план + AI + whale + Multi-TF.
2. **pro** — продвинутая аналитика (карточки).
3. **scanner** — сканер дна.
4. **fav** — избранное.
5. **oracle** — дашборд обучения + Trade Journal.
6. **risk** — Risk Command Center.
7. **portfolio** — баланс MEXC/KuCoin.

**Плюс:**
- **Alerts** — настройка уведомлений (Price / Whale / Funding) в Risk Center и Настройках.
- **Radial menu** — 6 кнопок по кругу (Рынок, Избранное, Риски, Баланс, Ордера, Обучение). Иконки расставляются динамически через JS с сохранением позиций в localStorage.
- **Sheet-модалки**, **Demo mode**, **Terms**, **App lock**, **Splash**.

**Таймфреймы:** `1m / 15m / 1h / 1d / 7d / 1M / ALL`.
**Pull-to-refresh v3.2:** свайп вниз от верха. Игнорирует нажатия на кнопки (`shouldIgnore`), чтобы не блокировать клики.

---

## 8. WebSocket — real-time цена

Файл: `src/sources/stream.ts` (класс `PriceStream`)
**Источники: Binance и KuCoin.**
- Binance: `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}`
- KuCoin: `wss://x-push-spot.kucoin.com` (требует отправки `action: SUBSCRIBE` при `onopen`).
**Логика:**
- При смене tf, тикера или биржи — `destroy()` + новый `connect()`.
- Reconnect: экспоненциальный бэкофф 1s→30s.
- Fallback на REST (в `timeframes.ts`), если WS не подключился за 8 сек.
**Обновление графика:**
- REST → `updateCandles()` (полная перерисовка).
- WS → `updateLastCandle()` (`series.update()`, зум не сбрасывается).

---

## 9. Релиз и сборка

**Скрипт:** `scripts/release.ps1`
1. Проверяет окружение.
2. Сканирует на секреты.
3. `npm run check`.
4. Bump версии в 8 файлах + `versionCode`.
5. Собирает через `build-all.ps1`.
6. Генерирует `PROJECT_MAP.md`.
7. Коммит, тег, push.

**Флаги:** `-DryRun`, `-Minor`, `-Major`, `-SkipBuild`, `-SkipPush`, `-SkipTests`, `-Yes`.
**Команды:**
`npm run dev`, `npm run pc:dev`, `npm run pc:build`, `npm run android:build:release`, `npm run check`, `npm run context`.

---

## 10. Known issues / TODO

**Обучение Оракула (`src/ui/learning.ts`):**
- 3 TODO-заглушки: `oracleGetStats`, `oracleUpdateOutcomes`, `oracleLearnPatterns` не подключены к UI.
- Нужно заменить заглушки на реальные вызовы.

**Tauri эксклюзивы (в config есть, не активированы):**
- Tray icon, Глобальные хоткеи, Mini-режим окна, Auto-updater.

**Проблема с `nebula.exe`:** процесс висит после закрытия (WS не закрывается).

**Duplicate exports:**
- `Candle` в 5 файлах, `PlanStep` в 2, `WallsData` в 2. Кандидат на `src/types.ts`.

**Android `allowBackup`:** стоит `"true"`, лучше поставить `"false"`.

---

## 11. Стиль разработки и общения

**Разработчик:** Русскоязычный, Windows 11 + VS Code + PowerShell.
**Стиль ответов ИИ:** Русский язык, развёрнуто и по делу, структурированно. Готовые команды PowerShell. Прямо говорить о проблемах. Проверка после каждого шага.

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
| v2.0.5+ | 2026-10-27 | KuCoin (все модули), Risk Center, Alerts, Multi-TF, Trade Journal, i18n, pull-refresh v3.2, radar v2 |
| v2.0.2 | 2026-10-25 | WebSocket real-time, pull-refresh v3, build-all fix версий |
| v2.0.1 | 2026-10-23 | AbortSignal fix (Android), таймфреймы, pull-refresh v1 |

---

## 15. Быстрые напоминания

- **Текущая версия:** см. `package.json`.
- **PROJECT_MAP.md** — генерируется при релизе.
- **Keystore** — `Nebula2026!`, alias `nebula`.
- **JDK 21** — `C:\Program Files\Android\Android Studio\jbr`.
- **GitHub** — https://github.com/NEBULA-SAE/nebula-android
- **Текущая задача** — обсуждена в чате, если непонятно, спроси у пользователя.