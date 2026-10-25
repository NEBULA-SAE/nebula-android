📄 AI_CONTEXT.md — ручной handoff-файл для ИИ

Создай в корне проекта рядом с PROJECT_MAP.md. Обновляй вручную при значимых изменениях (новая фича, новый модуль, смена архитектуры). PROJECT_MAP.md обновляется автоматически при релизе — они дополняют друг друга.
markdown

# NEBULA Oracle Terminal — AI Context

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> Обновляется вручную при значимых изменениях архитектуры, бизнес-логики, роадмапа.
> Структурная карта проекта — отдельный файл `PROJECT_MAP.md` (генерируется автоматически).
>
> **Версия этого файла:** соответствует релизу **v2.0.2** (2026-10-25)
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

**Проверка свежести:** если `PROJECT_MAP.md` показывает `Version: 2.0.5`, а `AI_CONTEXT.md` — `v2.0.2`, значит после 2.0.2 были релизы. `PROJECT_MAP.md` актуальнее по структуре, но бизнес-логика в `AI_CONTEXT.md` меняется редко — обычно остаётся верной.

---

## 1. TL;DR — что это за проект

**NEBULA Oracle Terminal** — персональный торговый терминал для криптовалютного рынка. Один TypeScript-код работает на трёх платформах: **Web** (браузер), **Android** (Capacitor 8), **Windows** (Tauri 2). Сделан одним разработчиком-трейдером в сотрудничестве с ИИ.

**Задача приложения:** дать розничному трейдеру то, что обычно доступно только профессионалам — глубокий анализ монеты с 5 бирж, метрики крупных игроков (киты, funding, OI), AI-наставник, который объясняет «что происходит» простым языком.

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
**Bundle size:** ~450 KB dist, ~7 MB APK, ~7 MB EXE

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
[5 бирж race] [Bybit+OKX+Binance] [orderbook+funding]
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
┌────┴────┬─────────┬──────────┬────────────┐
▼ ▼ ▼ ▼ ▼
renderPro setCandles whale- renderOracle agent-card
(pro tab) +drawNow radar Dashboard (AI Mentor)
text


Параллельно при старте:
- `loadBTC()` — карточка BTC каждые 90 сек
- `initTimeframeBar()` — панель tf + WebSocket стрим
- `runFullDiagnostics()` — раз в сутки
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

### 4.2 Whale detection

Файл: `src/ui/whale.ts` → `calculateVolumeAnomalies()`, `mergeWhaleMetrics()`

**Volume anomaly:** если объём последних 2 свечей > 180% от среднего за 30 дней → `isWhaleActive = true`

**OBV trend:** rising / falling / neutral — по накоплению объёма

**Futures metrics** (`src/sources/whale-futures.ts`):
- **OI change 24h** — Bybit → Binance fallback. > +5% = rising, < -5% = falling
- **LSR Top Traders** — OKX → Binance → Bybit. Топ-трейдеры vs толпа
- **LSR Global** — Bybit → Binance. Толпа (толпа обычно неправа)
- **Taker Buy/Sell** — OKX → Binance. Агрессивные покупки vs продажи

**Интерпретация:**
- OI растёт + LSR толпы растёт → перегрев лонгов, вероятен шорт-сквиз
- OI растёт + LSR топ-трейдеров растёт → умные деньги набирают
- Funding > 0.03% → эйфория, скоро коррекция
- Funding < -0.01% → паника, потенциал short squeeze

### 4.3 AI Mentor (Groq)

Файл: `src/ai.ts` → `getAiMentor()`

Отправляет в Groq **все** метрики (технические, whale, funding, стакан, контекст рынка) + совпадения с базой паттернов. Просит ответить строго по 7 блокам:

1. 📌 **Что происходит** — развёрнутая картина (3-5 предложений)
2. 🎯 **На что похоже** — 2-3 паттерна из базы (Wyckoff, шорт-сквиз, капитуляция...)
3. 🧠 **Почему так** — причинно-следственные связи (5-7 предложений)
4. ⚖️ **За и против** — два списка по 3-5 пунктов
5. 📈 **Сценарии** — бычий / базовый / медвежий с процентами (сумма 100%)
6. ⚡ **Что делать** — направление, вход, стоп, TP, R:R, размер позиции
7. 📊 **Уверенность** — X/10 с обоснованием

**Объём:** 350-450 слов. Не растягивать, не сжимать.

**Модель:** `openai/gpt-oss-120b` (быстрая, дешёвая на Groq). Пользователь вводит свой Groq API-ключ в настройках → шифруется AES.

### 4.4 Trade Intent Parser

Файл: `src/ai.ts` → `parseTradeIntent()`

Команда на естественном языке → JSON-интент через Groq (модель та же, но `temperature: 0.1` + `response_format: json_object`).

Примеры:

"Купи DASH на 10% депо" →
{"action":"market_buy","symbol":"DASH/USDT","capital_pct":10}

"Поставь сетку на BTC 60000-65000 на 5 шагов"
→ {"action":"grid","symbol":"BTC/USDT","side":"buy",
"capital_pct":20,"price_low":60000,"price_high":65000,"steps":5}
text


Валидация через `validateTradeIntent()`. Если интент невалидный — exception, ордер не размещается.

### 4.5 Сканер дна

Файл: `src/ui/scanner.ts` → `runScanner()`

Проходит топ-200 монет (список из Gate.io). Для каждой:
1. Загружает 120 свечей с приоритетом Binance → Gate.io
2. Считает RSI, rebound, drop через Web Worker (батчами)
3. Отбрасывает если `RSI > 55` или `rebound > 45%`
4. Проверяет аномалию объёма (если > 180% от 30d avg → whale active)
5. Оставляет только «на дне»: `RSI < 45 && rebound < 30 && drop > 40`

Worker (`src/worker.ts`) — inline Blob, не отдельный файл. Причина: Tauri и Capacitor плохо работают с внешними worker-файлами в production-сборке.

### 4.6 Планы и мониторинг

Файл: `src/trading.ts`

**Grid plan** (`calculateStrategy`): берёт объём инвестиций в USDT, делит на N шагов, каждый лимитник ставится на N% выше breakeven. Цель — выйти в плюс при движении вверх.

**Мониторинг** (`startMonitoring`): WebSocket на `stream.binance.com`, отслеживает исполнение шагов. Если цена достигла TP шага → перечёркивает в UI. Сохраняется в `localStorage.nebulaMonitor`, восстанавливается при перезапуске (но не старше 14 дней).

**TWAP** (`mobileTwapStart`): разбивает крупный ордер на N слайсов за M минут. Рандомизирует объём слайса ±10%, чтобы не светить паттерн. Last slice забирает остаток (без округлений).

---

## 5. Безопасность — критично, не сломать

Файлы: `src/auth.ts`, `src/crypto.ts`

**Мастер-пароль:**
- При первом запуске пользователь создаёт пароль (мин. 4 символа)
- Хранится **только хеш** в `localStorage.nebulaAppPasswordHash` (SHA-256 с солью)
- Сам пароль — в `sessionStorage.nebula_session_pwd` (умирает при закрытии вкладки)
- **НЕ хранится** на сервере, в облаке, нигде

**Шифрование ключей:**
- Алгоритм: **AES-256-GCM + PBKDF2** (150 000 итераций)
- Ключи MEXC: `localStorage.nebulaConfig` — зашифрованный blob
- Groq API-ключ: `localStorage.nebulaGroqKey` — тоже зашифрованный
- Формат: `NBLA2:` + соль(16) + iv(12) + ciphertext
- Кодировка: base64

**Функции:**
- `encryptJson(data, password)` → string
- `decryptJson(token, password)` → any
- `hmacSha256Hex(secret, msg)` — для MEXC API-подписей

**Биометрия (только Android):**
- `@capgo/capacitor-native-biometric`
- Пароль шифруется в нативном хранилище (Android Keystore)
- Отпечаток / FaceID → разблокировка → пароль восстанавливается

**Сброс пароля = потеря ключей.** В UI это подтверждается через `confirm()` с предупреждением.

**Keystore APK:** `android/app/nebula-release.keystore` — **НИКОГДА не в git**, в `.gitignore`. Без него нельзя обновить APK. Пароль в `Knowledge Base` проекта (не в этом файле). Есть бэкап.

---

## 6. Обход CORS — три платформы, три способа

Все три в `src/main.ts` + `src/platform/http.ts`.

**Web (dev):**
- Vite proxy в `vite.config.ts`
- `/proxy/gateio` → `api.gateio.ws`
- `/proxy/mexc` → `api.mexc.com`
- Используется ТОЛЬКО в dev (`import.meta.env.DEV`)

**Android (Capacitor):**
- `CapacitorHttp` перехватывает `window.fetch` в `main.ts`
- НО: `CapacitorHttp.request()` **не поддерживает AbortSignal**
- Поэтому обёрнут в `Promise.race([runNative(), abortPromise])` — это **ключевой фикс производительности** (без него запрос висит 30-60 сек вместо 6)
- Если нативный запрос упал с `AbortError` — **не** делать fallback на `origFetch`, иначе двойное ожидание

**Windows (Tauri):**
- `@tauri-apps/plugin-http` только для whitelist-доменов
- Whitelist в `src/platform/http.ts` → `TAURI_PROXY_HOSTS`
- Остальные домены (gateio, binance, bybit, okx) идут нативно — они CORS-friendly
- В whitelist: mexc, okx-rubik, groq, getblock, dash-rpc, blockchair, dashcentral, dexpaprika

---

## 7. UI — 6 экранов + sheet-модалки

Файл: `index.html` (основная разметка) + `src/ui/*.ts` (логика)

**Bottom nav (6 вкладок):**
1. **home** — главный анализ (график + verdict + план + AI-наставник + whale-радар)
2. **pro** — продвинутая аналитика (MACD/BB/ADX/Stoch/S&R/VP в карточках)
3. **scanner** — сканер дна по топ-200
4. **fav** — избранное (звёздочка на тикере)
5. **oracle** — дашборд обучения (профиль, статы, история)
6. **portfolio** — синхронизация баланса MEXC

**Плюс:**
- **Demo mode** — виртуальная торговля $10,000, отдельный экран
- **Radar menu** — круговое меню на центральной кнопке (мобилка)
- **Sheet-модалки** — settings, orders, quiz, themes, about, donate
- **Terms overlay** — при первом запуске
- **App lock overlay** — пароль при каждом старте
- **Splash** — анимация загрузки (canvas + звёзды)

**Таймфреймы графика:** `1m / 15m / 1h / 1d / 7d / 1M / ALL` — горизонтальная панель над графиком (`#tf-bar`).

**Pull-to-refresh:** свайп вниз от верха активного экрана → SVG-кольцо → обновление текущего экрана. Не работает внутри `#chart-container` (там свой зум) и `.tf-bar` (там горизонтальный скролл).

---

## 8. WebSocket — real-time цена

Файл: `src/sources/stream.ts` (класс `PriceStream`)

**Только Binance:** `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}`
**Почему:** самый стабильный, отдаёт данные push-ом, не считается в rate-limit

**Логика:**
- При смене tf или тикера — `destroy()` + новый `connect()`
- Reconnect: экспоненциальный бэкофф 1s → 2s → 4s → ... → 30s max, 10 попыток
- Heartbeat: ping каждые 30 сек (чтобы NAT не рвал TCP)
- Нормальное закрытие (код 1000) — не реконнектить
- Fallback на REST (`refreshIntervalMs` в `timeframes.ts`) — если WS не подключился за 8 сек

**Обновление графика:**
- Обычный REST → `updateCandles()` — полностью перерисовывает серию, сбрасывает зум при новом tf, не сбрасывает при автообновлении
- WebSocket → `updateLastCandle()` — `series.update()` одного бара, <1мс, зум не трогает

**Известное ограничение:** на спокойных монетах (DASH) цена может стоять 10-30 сек без движения. Это нормально, WebSocket присылает только при реальном изменении.

---

## 9. Релиз и сборка

**Один скрипт для всего:** `scripts/release.ps1`

Что делает:
1. Проверяет окружение (node, npm, git, keystore)
2. Проверяет на секреты (Groq/OpenAI/GitHub PAT/пароли) — блокирует при находке
3. `npm run check` — TypeScript
4. Bump версии во всех 8 файлах + `versionCode`
5. Собирает через `build-all.ps1` (Windows + Android)
6. Проверяет артефакты в `dist_release/`
7. Генерирует `PROJECT_MAP.md`
8. Коммит + тег + push

**Флаги:**
- `-DryRun` — только проверки, без изменений
- `-Minor` / `-Major` — тип bump
- `-SkipBuild` — bump+commit+push без сборки
- `-SkipPush` — всё локально
- `-SkipTests` — пропустить TypeScript
- `-Yes` — без подтверждений (для CI)

**Отдельные команды:**
```powershell
npm run dev                    # Web (localhost:5173)
npm run pc:dev                 # Tauri dev
npm run pc:build               # Windows EXE+MSI
npm run android:build:release  # Android APK
npm run check                  # TypeScript
npm run context                # перегенерировать PROJECT_MAP.md
.\scripts\build-all.ps1        # Windows + Android (без bump)

Файлы в dist_release/: NEBULA-{ver}-Setup.exe (NSIS), NEBULA-{ver}-Portable.exe, NEBULA-{ver}-x64.msi, NEBULA-{ver}.apk
10. Known issues / TODO (что не сделано)

Обучение Оракула (src/ui/learning.ts):

    3 TODO-заглушки: oracleGetStats, oracleUpdateOutcomes, oracleLearnPatterns не подключены к UI

    Причина: UI-часть переносилась из Python-версии, не доделана

    Что делать: заменить заглушки на реальные вызовы (функции уже готовы в src/oracle.ts)

WebSocket только Binance:

    Bybit (wss://stream.bybit.com/v5/public/spot) не подключён

    OKX (wss://ws.okx.com:8443/ws/v5/public) не подключён

    Для РФ Binance может блокироваться — fallback на REST работает, но не real-time

Tauri эксклюзивы (в config есть, не активированы):

    Tray icon (иконка в системном трее) — плагин в Cargo.toml, но lib.rs не инициализирует

    Глобальные хоткеи (@tauri-apps/plugin-global-shortcut) — не подключены

    Mini-режим окна (в tauri.conf.json есть, JS не переключает)

    Auto-updater — @tauri-apps/plugin-updater не установлен

Проблема с process nebula.exe:

    После закрытия окна процесс висит (~8 MB) — WebSocket не закрывается

    Решение: Stop-Process -Name nebula -Force вручную, или CloseRequested handler в Rust

Duplicate exports:

    Candle объявлен в 5 файлах (chart.ts, indicators.ts, sources/candles.ts, ui/whale.ts, utils.ts)

    PlanStep в 2 файлах

    WallsData в 2 файлах

    Не баг, TypeScript справляется. Но при изменении Candle (например, добавить trades) придётся править все 5. Кандидат на src/types.ts в будущем.

Android allowBackup:

    Сейчас android:allowBackup="true" в AndroidManifest.xml

    Риск: localStorage можно извлечь через USB-бэкап

    Решение: поставить "false" (MobSF score вырастет)

11. Стиль разработки и общения

Разработчик:

    Русскоязычный, Windows 11 + VS Code + PowerShell 5.1

    Не профессиональный программист, но разбирается в трейдинге

    Работает с ИИ как «второй разработчик»

    Ценит конкретику, готовые команды, объяснения «почему»

Стиль ответов ИИ:

    Русский язык

    Развёрнуто, но по делу — не «вот пример кода», а «вот полный файл, вот что изменилось, вот как проверить»

    Структурированно — заголовки, таблицы, списки

    Готовые команды PowerShell — не «можно запустить через…», а «вот команда, копируй»

    Прямо говорить о проблемах — если подход неверный, сказать «это не сработает потому что…»

    Проверка после каждого шага — «ожидаемый вывод», «если видишь X — значит Y»

    Не переспрашивать базу — если контекст в AI_CONTEXT.md + PROJECT_MAP.md, не надо «а что такое Oracle?»

Избегать:

    Общих советов («попробуй посмотреть в логах»)

    Воды («криптовалюты — это волатильный рынок»)

    Отписок («это сложно объяснить»)

    Lorem ipsum кода — давать полные файлы, а не обрывки

12. Красные флаги — что НЕ делать без бэкапа

Критичные файлы (ломается всё):

    src/main.ts — bootstrap, fetch patch, auth init

    src/auth.ts + src/crypto.ts — шифрование, потеря ключей = сброс пароля

    src/trading.ts — ордера, реальные деньги

    src/sources/mexc.ts — подписи API, HMAC

Файлы, где каждая строка важна:

    scripts/release.ps1 — если сломать, релиз не соберётся

    scripts/build-all.ps1 — то же

    src/sources/candles.ts — 5 бирж, race logic, таймфреймы

    src/chart.ts — серии, priceLines, память

    src/sources/stream.ts — WebSocket, reconnect, heartbeat

Файлы, где легко сломать кодировку:

    index.html — там кириллица в UI-текстах

    src/i18n.ts — словари RU/EN

    src/ui/terms.ts — текст соглашения

Всегда при правке этих файлов:

    Читать через -Encoding UTF8 в PowerShell

    Писать через Write-FileUtf8 (без BOM)

    git status до и после — проверять что не появилось лишних M

    При сомнении — git checkout HEAD -- <файл> для отката

Keystore — АБСОЛЮТНО не трогать:

    android/app/nebula-release.keystore

    Лежит в .gitignore (android/app/.gitignore → *.keystore)

    Без него нельзя обновить APK

    Пароль в Knowledge Base проекта (не в этом файле)

13. Полезные команды для ИИ

Когда пользователь говорит «покажи что изменилось»:
powershell

git log --oneline -5
git status --short

Когда «проверь что не сломалось»:
powershell

npm run check

Когда «что в проекте сейчас»:
powershell

Get-Content package.json -Raw | Select-String '"version"'
Select-String -Path "PROJECT_MAP.md" -Pattern "Version:"

Когда «установи что за версия»:
powershell

git describe --tags --abbrev=0

14. История версий (последние)
Версия	Дата	Ключевое
v2.0.2	2026-10-25	WebSocket real-time, pull-refresh v3, build-all fix версий
v2.0.1	2026-10-23	AbortSignal fix (Android), таймфреймы, pull-refresh v1
8234933	2026-10-23	(commit) fix(android): AbortSignal в fetch-патче
eb6d48b	2026-10-22	About page, reset demo, tauri fix
352b9ca	2026-10-21	Mobile radial HUD, demo sandbox
3ec7e5c	2026-10-19	Полный рефакторинг, VPS-прокси, пароль, Telegram

Теги в git — только с v2.0.1. До этого версии были только в коммитах (v2.0.3 в коммите 1cf6a91 — это историческая версия Python-версии, не наш релиз).

Полная история: PROJECT_MAP.md → Release history.
15. Быстрые напоминания

    v2.0.2 — текущая версия, тег v2.0.2, коммит fdf138a

    PROJECT_MAP.md — генерируется при каждом релизе, показывает реальное состояние

    AI_CONTEXT.md — этот файл, обновляется вручную при значимых изменениях

    Keystore — Nebula2026!, alias nebula, файл android/app/nebula-release.keystore

    Пароль Groq API — пользователь вводит сам в настройках

    Пароль на вход — пользователь вводит сам при первом запуске

    JDK 21 — C:\Program Files\Android\Android Studio\jbr

    GitHub — https://github.com/NEBULA-SAE/nebula-android

    Текущая задача — обсуждена в чате, если непонятно, спроси у пользователя