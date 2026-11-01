# NEBULA Oracle Terminal — AI Context & Operations Manual

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> **Версия файла:** соответствует релизу **v2.0.27+** (2026-11-01)
> **Актуальная версия кода:** см. `package.json`

---

## 1. TL;DR — что это за проект

**NEBULA Oracle Terminal** — персональный торговый терминал для криптовалютного рынка. Один TypeScript-код работает на трёх платформах: **Web** (браузер), **Android** (Capacitor 8), **Windows** (Tauri 2). 

**Ключевая фишка:** алгоритм **Oracle** — скоринг от -100 до +100, агрегирующий технические индикаторы, поведение китов, стакан, funding rate и историю. Выдаёт вердикт (strong_buy / buy / hold / avoid), рекомендует позицию и генерирует 3 сценария через AI (Groq).

**Монетизация:** Внедрена система подписок PRO. Есть бесплатный функционал и закрытые фичи (ИИ без лимитов, Продвинутая аналитика, Риски, Радар китов). Лицензия привязывается к железу (HWID).

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
| Хранилище | **IndexedDB** (память Оракула) + localStorage (настройки, токен PRO) |
| **License Server** | Node.js + SQLite (VPS: `http://85.192.42.177:3000`) |

**Идентификатор приложения:** `com.nebula.oracle`

---

## 3. РЕАЛЬНАЯ Архитектура

### ✅ Ключевые модули:
1. **PRO License System (`src/pro.ts`)**: Проверяет лицензию, генерирует HWID, отправляет запросы на VPS (активация, проверка).
2. **Promise-Кэш (Network Deduplication):** В `candles.ts` и `orderbook.ts` внедрен кэш на основе `Promise`. Если 5 модулей одновременно запрашивают одни и те же свечи или стакан, уходит **только один** сетевой запрос.
3. **Data Threading (Единый пайплайн):** В `ui/oracle.ts` массив свечей загружается один раз и передается напрямую в `market.ts`, `oracle.ts` и `confluence.ts`.
4. **IndexedDB:** Память Оракула (`nebulaMemory`) перенесена с `localStorage` на `IndexedDB` (файл `src/db.ts`).

---

## 4. Бизнес-логика — сердце проекта

### 4.1 Oracle scoring (Ядро)
Файл: `src/oracle.ts` → `oracleAnalyze()`
Формула: `score = tech + whale + obs + funding + onchain + learned + man + market_context`
Возвращает 3 сценария (base, bull, bear) с вероятностями.

### 4.2 AI Mentor (Groq) с печатной машинкой
Файл: `src/ai.ts` → `getAiMentor()`, `src/ui/oracle.ts` → `askAIMentor()`.
**Лимиты:** Free — 3 запроса в день (счетчик в localStorage). PRO — безлимит.
Используется Server-Sent Events (SSE) стриминг (эффект печатной машинки).

### 4.3 Whale Radar + PRO блокировки
Файл: `src/ui/whale.ts`
Собирает метрики (OI, LSR, Taker) с Bybit, OKX, Binance. 
**Free-версия:** видит только Volume (Z-score) и OBV.
**PRO-версия:** открывает OI, LSR, Taker, X-Ray, Walls (Плиты).

### 4.4 Multi-TF Confluence
Файл: `src/sources/confluence.ts`
Анализирует 1h, 1d, 1w. Для 1d использует свечи, переданные из `ui/oracle.ts` (Data Threading).

### 4.5 Crypto Hub (Справочник)
Файлы: `src/data/hub.ts` (данные) и `src/ui/hub.ts` (UI).
Информационный справочник по биржам, обучающим материалам и инструментам. Показывает статус доступности для РФ (Работает / VPN / Недоступно). У каждой биржи есть подробное описание (плюсы, минусы, KYC, P2P, комиссии).

### 4.6 PRO License System (Монетизация)
- **Сервер:** Node.js + SQLite (порт 3000). Код сервера лежит на VPS в `/var/www/nebula-api/server.js` (запущен через PM2). Секретный пароль в коде: `ADMIN_SECRET`.
- **Генерация:** Отдельный HTML-файл `admin-gen.html` на ПК (только у админа). Отправляет запрос на VPS и получает ключ.
- **Привязка:** Один ключ = 1 ПК + 1 Смартфон. Сервер записывает HWID при первой активации. Попытка активации на другом устройстве выдаст ошибку.
- **Клиент:** `src/pro.ts`. При активации токен сохраняется в `localStorage` (`nebulaProToken`). При старте `checkLocalProStatus()` проверяет срок действия.
- **Стоимость:** Early Bird $29, Regular $249, Monthly $2.99, Yearly $19.99.

---

## 5. UI и Заставка
Файл: `index.html`
**7 экранов:** home, pro, scanner, fav, oracle, risk, portfolio.
**Splash Screen:** 8 секунд. Canvas-анимация. Загрузка данных (графики/анализ) идет параллельно, заставка скрывается через `hideSplash()`.
**Шапка (NEBULA PRO):** 
- Надпись `NEBULA` (с градиентом) и рядом кнопка `[PRO]`, которая мигает контуром, если подписки нет.
- При клике на `[PRO]` открывается окно тарифов.
- Если PRO активна, кнопка исчезает, а надпись становится золотой `NEBULA PRO`.
**Блокировка PRO в UI:**
- `Risk Center` (`src/ui/risk.ts`) — полностью закрыт замочком.
- `Аналитика` (`src/ui/oracle.ts` → `renderPro`) — закрыта замочком.
- `Ордера` (`src/trading.ts` → `openOrdersSheet`) — при клике открывает окно PRO.

---

## 6. Безопасность
Файлы: `src/auth.ts`, `src/crypto.ts`
Шифрование ключей AES-256-GCM + PBKDF2 (150k). Пароль в sessionStorage, хеш в localStorage. Биометрия (Android).

---

## 7. WebSocket и Real-time
Файл: `src/sources/stream.ts` (класс `PriceStream`)
**Критический фикс:** Символ всегда дополняется до `USDT` (`DASHUSDT`), иначе Binance закрывает соединение с кодом 1008.
**Фикс Heartbeat:** Пинг `{"method":"ping"}` отправляется только для KuCoin. Для Binance полагаемся на нативные WS-пинги браузера.

---

## 8. Известные проблемы / TODO
1. **Tauri:** Процесс `nebula.exe` висит после закрытия (WebSocket не убивается при закрытии окна).
2. **God Object `main.ts`:** Импортирует 36 файлов из 46.
3. **Duplicate Exports:** Интерфейс `Candle` объявлен в нескольких файлах.
4. **HTTPS на сервере:** Сейчас сервер лицензий работает по HTTP (`http://85.192.42.177:3000`). Для Android пришлось включить `cleartext: true` в `capacitor.config.ts`. В будущем стоит повесить SSL (Caddy/Nginx), чтобы не зависеть от этого флага.

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
| v2.0.27+ | Внедрена система PRO (сервер, HWID, UI-заглушки), золотая надпись NEBULA PRO, фикс Android HTTP (cleartext), фикс верстки замочков. |
| v2.0.22+ | Crypto Hub (справочник бирж с деталями), фикс Landscape Mode (боковая панель), кнопка «Назад» в деталях хаба. |
| v2.0.20+ | IndexedDB для Оракула, Promise-кэш (свечи/стакан), AI Streaming (эффект печатной машинки), White Paper. |

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
| **Сборка Windows (.exe)** | `npm run pc:build` |
| **Сборка Android (.apk)** | `npm run android:build:release` |
| **Полный релиз (Всё сразу)** | `.\scripts\release.ps1` |
| **Синхронизировать Web -> Android** | `npx cap sync android` |

### 🧹 Очистка и переустановка
| Действие | Команда |
|---|---|
| **Очистка кэша Vite** | `Remove-Item -Recurse -Force node_modules/.vite` |
| **Полная переустановка** | `Remove-Item -Recurse -Force node_modules; Remove-Item -Force package-lock.json; npm install` |
| **Очистка сборки Tauri** | `Remove-Item -Recurse -Force src-tauri/target` |

### ☁️ Сервер (VPS Ubuntu)
Зайти на сервер: `ssh -p 22 root@85.192.42.177`
| Действие | Команда |
|---|---|
| **Перезагрузить сервер ключей** | `pm2 restart nebula-api` |
| **Посмотреть логи сервера** | `pm2 logs nebula-api` |
| **Посмотреть пароль админа** | `cat /var/www/nebula-api/server.js \| grep ADMIN_SECRET` |
| **Посмотреть базу ключей** | `sqlite3 /var/www/nebula-api/licenses.db "SELECT * FROM keys;"` |

### 🔍 Отладка
| Действие | Инструкция |
|---|---|
| **Посмотреть базу Оракула** | F12 -> Application -> IndexedDB -> NebulaDB -> oracleMemory. |
| **Посмотреть токен PRO** | F12 -> Application -> Local Storage -> `nebulaProToken`. |
| **Проверить HWID** | В консоли приложения ввести: `localStorage.getItem('nebulaDeviceHwid')` |