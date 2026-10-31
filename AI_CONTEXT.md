# NEBULA Oracle Terminal — AI Context & Operations Manual

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> **Версия файла:** соответствует релизу **v2.0.20+** (2026-11-01)
> **Актуальная версия кода:** см. `package.json`

---

## 1. TL;DR — что это за проект

**NEBULA Oracle Terminal** — персональный торговый терминал для криптовалютного рынка. Один TypeScript-код работает на трёх платформах: **Web** (браузер), **Android** (Capacitor 8), **Windows** (Tauri 2). 

**Ключевая фишка:** алгоритм **Oracle** — скоринг от -100 до +100, агрегирующий технические индикаторы, поведение китов, стакан, funding rate и историю. Выдаёт вердикт (strong_buy / buy / hold / avoid), рекомендует позицию и генерирует 3 сценария через AI (Groq).

---

## 2. Стек и платформы

| Слой | Технология |
|---|---|
| Frontend | TypeScript + Vite 5.4 |
| Графики | lightweight-charts 4.2 |
| Android | Capacitor 8.5 |
| Windows | Tauri 2.x |
| AI | Groq API (`openai/gpt-oss-120b`) + SSE Streaming |
| Криптография | Web Crypto API (AES-256-GCM + PBKDF2) |
| Хранилище | **IndexedDB** (память Оракула) + localStorage (настройки) |

**Идентификатор приложения:** `com.nebula.oracle`

---

## 3. РЕАЛЬНАЯ Архитектура (оптимизированная)

В ходе последнего рефакторинга (v2.0.20) архитектура была значительно улучшена.

### ✅ Выполненные оптимизации:
1. **Promise-Кэш (Network Deduplication):** В `candles.ts` и `orderbook.ts` внедрен кэш на основе `Promise`. Если 5 модулей одновременно запрашивают одни и те же свечи или стакан, уходит **только один** сетевой запрос.
2. **Data Threading (Единый пайплайн):** В `ui/oracle.ts` массив свечей загружается один раз и передается напрямую в `market.ts`, `oracle.ts` и `confluence.ts`. Больше нет дублирующих запросов.
3. **IndexedDB:** Память Оракула (`nebulaMemory`) перенесена с `localStorage` на `IndexedDB` (файл `src/db.ts`). Это убрало лимит в 5 МБ и синхронные фризы.

### ⚠️ Оставшиеся архитектурные проблемы:
1. **God Object `main.ts`:** Импортирует 36 файлов из 46, раздувая бандл.
2. **Циклические зависимости:** `ui/screens.ts` ↔ `ui/oracle.ts` ↔ `ui/pull-refresh.ts`.
3. **Duplicate Exports:** Интерфейс `Candle` объявлен в нескольких файлах.

---

## 4. Бизнес-логика — сердце проекта

### 4.1 Oracle scoring (Ядро)
Файл: `src/oracle.ts` → `oracleAnalyze()`
Формула: `score = tech + whale + obs + funding + onchain + learned + man + market_context`
Возвращает 3 сценария (base, bull, bear) с вероятностями.

### 4.2 AI Mentor (Groq) с печатной машинкой
Файл: `src/ai.ts` → `getAiMentor()`, `src/ui/oracle.ts` → `askAIMentor()`.
**Новое:** Используется Server-Sent Events (SSE) стриминг. Функция `getAiMentor` возвращает данные чанками (`onStream`), а UI накапливает их и выводит на экран по 3 символа каждые 15мс (эффект печатной машинки ChatGPT).

### 4.3 Whale Radar
Файл: `src/ui/whale.ts`
Собирает метрики (OI, LSR, Taker) с Bybit, OKX, Binance. Считает Whale Score. Выводит сигналы с простыми пояснениями (адаптировано под ПК `.pc-only` и мобилки `.mobile-only`).

### 4.4 Multi-TF Confluence
Файл: `src/sources/confluence.ts`
Анализирует 1h, 1d, 1w. Для 1d использует свечи, переданные из `ui/oracle.ts` (Data Threading).

---

## 5. Безопасность
Файлы: `src/auth.ts`, `src/crypto.ts`
Шифрование ключей AES-256-GCM + PBKDF2 (150k). Пароль в sessionStorage, хеш в localStorage. Биометрия (Android).

---

## 6. WebSocket и Real-time
Файл: `src/sources/stream.ts` (класс `PriceStream`)
**Критический фикс:** Символ всегда дополняется до `USDT` (`DASHUSDT`), иначе Binance закрывает соединение с кодом 1008.
**Фикс Heartbeat:** Пинг `{"method":"ping"}` отправляется только для KuCoin. Для Binance полагаемся на нативные WS-пинги браузера.
**Защита:** Флаг `chartLoading` блокирует отрисовку WS-свечей во время загрузки графика.

---

## 7. UI и Заставка
Файл: `index.html`
**7 экранов:** home, pro, scanner, fav, oracle, risk, portfolio.
**Splash Screen:** 8 секунд. Canvas-анимация с гироскопом (на мобилках) и мышью (на ПК). Кометы, глубокий космос, огромный логотип.
**White Paper:** Внизу главного экрана находится футер с баннером партнеров и кнопкой вызова Белой Книги (`src/ui/white-paper.ts` и `src/data/info.ts`).

---

## 8. Известные проблемы / TODO
1. **Tauri:** Процесс `nebula.exe` висит после закрытия (WebSocket не убивается при закрытии окна).
2. **God Object `main.ts`:** Разбить на более мелкие точки входа.
3. **Duplicate Exports:** Убрать дублирование интерфейса `Candle`.

---

## 9. Стиль разработки и общения
**Разработчик:** Русскоязычный, Windows 11, VS Code, PowerShell.
**Стиль:** Развёрнуто, структурированно. Готовые команды PowerShell.
**Критично:** При замене кода использовать блоки "Найти: ... Заменить на: ...". Не давать абстрактных инструкций. Всегда проверять `npm run check`.

---

## 10. Красные флаги (Не трогать без бэкапа)
* `main.ts` (патчи fetch)
* `auth.ts`, `crypto.ts` (ключи пользователя)
* `trading.ts`, `sources/mexc.ts`, `sources/kucoin.ts` (реальные деньги)
* `release.ps1` (может затереть старые версии)
* `android/app/nebula-release.keystore` (потеря = невозможность обновить приложение).

---

## 11. История версий (последние)
| Версия | Ключевое |
|---|---|
| v2.0.20+ | IndexedDB для Оракула, Promise-кэш (свечи/стакан), AI Streaming (эффект печатной машинки), White Paper (футер и партнеры), фикс heartbeat WS. |
| v2.0.19+ | Dash Accordion, Whale Radar v2 (подсказки), AI 3-сценария, Blockbuster Splash, фикс WS (1008). |
| v2.0.15+ | Зеркало истории, оптимизация графиков, фикс Taker, Landscape fix. |

---

## 12. ПОЛНАЯ ШПАРГАЛКА КОМАНД (PowerShell)

Здесь собраны все команды для работы с проектом: от запуска до релиза.

### 🚀 Запуск и разработка
| Действие | Команда | Описание |
|---|---|---|
| **Запуск Web (Браузер)** | `npm run dev` | Открывает `http://localhost:5173` (или 127.0.0.1). Используй для быстрой проверки UI. |
| **Запуск Windows (Tauri)** | `npm run pc:dev` | Запускает нативное приложение (WebView2). Удобно для проверки нативных фич. |
| **Запуск Android (Live Reload)** | `npx cap run android` | Собирает и запускает на подключенном устройстве/эмуляторе. |

### 🛠️ Проверка и сборка
| Действие | Команда | Описание |
|---|---|---|
| **Проверка типов** | `npm run check` | Запускает `tsc --noEmit`. **Всегда** запускай перед коммитом. |
| **Сборка Windows (.exe)** | `npm run pc:build` | Создает установщик в `src-tauri/target/release/bundle/`. |
| **Сборка Android (.apk)** | `npm run android:build:release` | Создает подписанный APK в `android/app/build/outputs/apk/release/`. |
| **Полный релиз (Всё сразу)** | `.\scripts\release.ps1` | Скрипт сам поднимет версию, проверит секреты, соберет Web/PC/Android, сделает Git commit + push. |
| **Генерация карты проекта** | `npm run context` | Обновляет `PROJECT_MAP.md` (сканирует структуру файлов). |

### 🧹 Очистка и переустановка (Если что-то сломалось)
| Действие | Команда | Описание |
|---|---|---|
| **Очистка кэша Vite** | `Remove-Item -Recurse -Force node_modules/.vite` | Если Vite начал выдавать странные ошибки или не видит изменения. |
| **Полная переустановка** | `Remove-Item -Recurse -Force node_modules; Remove-Item -Force package-lock.json; npm install` | Удаляет все пакеты и ставит заново (займет время). |
| **Очистка сборки Tauri** | `Remove-Item -Recurse -Force src-tauri/target` | Если сборка `.exe` падает с ошибками компиляции Rust. |

### 🔍 Отладка и Инструменты
| Действие | Инструкция |
|---|---|
| **Посмотреть базу Оракула** | 1. Открой `npm run dev` в Chrome. 2. Нажми `F12`. 3. Вкладка **Application** -> **IndexedDB** -> **NebulaDB** -> **oracleMemory**. |
| **Посмотреть сохраненные ключи** | 1. Открой `npm run dev` в Chrome. 2. Нажми `F12`. 3. Вкладка **Application** -> **Local Storage** -> `http://localhost:5173`. (Ищи `nebulaGroqKey`, `nebulaConfig`). |
| **Посмотреть логи WebSocket** | Открой консоль (F12), ищи строки `[stream] Binance open...`. Если видишь `close code=1008` — значит биржа отклонила соединение. |
| **Проверить скорость загрузки** | В консоли ищи `[perf] candles ... in XXXms`. Если время > 1000ms — возможно, биржа тормозит или пропал интернет. |

### 🌐 Git и версии
| Действие | Команда |
|---|---|
| **Посмотреть последние коммиты** | `git log --oneline -5` |
| **Посмотреть статус изменений** | `git status --short` |
| **Сделать коммит вручную** | `git add .; git commit -m "Твое сообщение"; git push` |
| **Откатиться к последнему коммиту** | `git reset --hard HEAD` (Осторожно: удалит все несохраненные изменения). |

### 📱 Android (Вспомогательные)
| Действие | Команда / Инструкция |
|---|---|
| **Открыть Android Studio** | `npx cap open android` (Откроет проект в Android Studio для настройки подписи или эмулятора). |
| **Синхронизировать Web -> Android** | `npx cap sync android` (Копирует свежие файлы из `dist/` в `android/app/src/main/assets/`). |
| **Где лежит Keystore** | `android/app/nebula-release.keystore` (Пароль: `Nebula2026!`, Alias: `nebula`). |

### 🪟 Windows (Tauri Вспомогательные)
| Действие | Команда / Инструкция |
|---|---|
| **Открыть конфиг Tauri** | `src-tauri/tauri.conf.json` (Здесь настраиваются иконки, название, размеры окна). |
| **Где лежат иконки** | `src-tauri/icons/` (Генерируются через `npx tauri icon path/to/image.png`). |
