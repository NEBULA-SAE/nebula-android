# NEBULA Oracle Terminal — AI Context & Operations Manual

> **Ручной handoff-файл** для передачи контекста ИИ-ассистенту в новом чате.
> **Версия файла:** соответствует релизу **v2.0.30+** (Ноябрь 2026)
> **Актуальная версия кода:** см. `package.json`

---

## 1. TL;DR — что это за проект

**NEBULA Oracle Terminal** — персональный торговый терминал для криптовалютного рынка. Один TypeScript-код работает на трёх платформах: **Web** (браузер), **Android** (Capacitor 8), **Windows** (Tauri 2). 

**Ключевая фишка:** алгоритм **Oracle** — скоринг от -100 до +100, агрегирующий технические индикаторы, поведение китов, стакан, funding rate и историю. Выдаёт вердикт (strong_buy / buy / hold / avoid), рекомендует позицию и генерирует 3 сценария через AI (Groq).

**Монетизация:** Система подписок PRO (HWID). Закрытые фичи: ИИ без лимитов, Продвинутая аналитика, Риски, Радар китов. 

**Новое в этой версии:** Полная локализация (RU/EN) и интеграция сторонних Web3-сервисов (P2P Binance и анонимный своп Xgram) через встроенный браузер (InAppBrowser).

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
| **Внешние окна** | `@capacitor/browser` (iOS/Android) + `@tauri-apps/plugin-opener` (Windows) |
| **License Server** | Node.js + SQLite (VPS: `http://85.192.42.177:3000`) |

**Идентификатор приложения:** `com.nebula.oracle`

---

## 3. РЕАЛЬНАЯ Архитектура

### ✅ Ключевые модули:
1. **PRO License System (`src/pro.ts`)**: Проверяет лицензию, генерирует HWID, отправляет запросы на VPS.
2. **Promise-Кэш (Network Deduplication):** В `candles.ts` и `orderbook.ts`. Один запрос на всех.
3. **Data Threading:** В `ui/oracle.ts` свечи загружаются раз и передаются в `market.ts`, `oracle.ts`, `confluence.ts`.
4. **IndexedDB:** Память Оракула (`nebulaMemory`) в `src/db.ts`.
5. **I18N (Мультиязычность):** Полный словарь в `src/i18n.ts`. Функция `applyStaticTranslations()` в `ui/screens.ts` моментально перерисовывает весь интерфейс (включая открытые модалки) при смене языка.
6. **Webview Handler (`src/platform/browser.ts`):** Безопасный мост для открытия сторонних сервисов (P2P, Свопы). Блокирует фишинговые домены через `allowedHosts`.

---

## 4. Бизнес-логика — сердце проекта

### 4.1 Oracle scoring (Ядро)
Файл: `src/oracle.ts` → `oracleAnalyze()`
Формула: `score = tech + whale + obs + funding + onchain + learned + man + market_context`

### 4.2 AI Mentor (Groq) с печатной машинкой
Файл: `src/ai.ts` → `getAiMentor()`, `src/ui/oracle.ts` → `askAIMentor()`.
**Лимиты:** Free — 3 запроса в день. PRO — безлимит.

### 4.3 Whale Radar + PRO блокировки
Файл: `src/ui/whale.ts`. Собирает метрики (OI, LSR, Taker). 
**Free:** Volume (Z-score) и OBV. **PRO:** OI, LSR, Taker, X-Ray, Walls.

### 4.4 Multi-TF Confluence
Файл: `src/sources/confluence.ts`. Анализирует 1h, 1d, 1w.

### 4.5 Web3 Интеграция (P2P & Свопы)
- **Файл:** `src/platform/browser.ts`.
- **Сервисы:** Binance P2P (покупка за фиат) и Xgram (анонимный своп крипты на крипту).
- **UI:** Одна кнопка «Обмен» в шапке (`openExchangeMenu`), которая открывает модальное окно с выбором. 
- **Безопасность:** В `capacitor.config.ts` (allowNavigation) и `browser.ts` (allowedHosts) прописаны белые списки доменов. На Windows открывается в системном браузере, на мобилках — в нативном оверлее (как в Telegram).

### 4.6 PRO License System (Монетизация)
- **Сервер:** Node.js + SQLite (VPS).
- **Генерация:** `admin-gen.html`.
- **Клиент:** `src/pro.ts` (`nebulaProToken`).
- **Стоимость:** Early Bird $29, Regular $249, Monthly $2.99, Yearly $19.99.

---

## 5. UI и Заставка
Файл: `index.html`
**7 экранов:** home, pro, scanner, fav, oracle, risk, portfolio.
**Splash Screen:** 8 секунд. Canvas-анимация.
**Шапка (NEBULA PRO):** 
- Логотип `NEBULA` + кнопка `[PRO]`.
- **Кнопки справа:** Рынок, Обучение, Ордера (только ПК), **Обмен (P2P/Swap)**, **Демо (фиолетовая, пульсирующая)**, Настройки.
- **Язык (RU/EN)** перенесен внутрь Настроек.
**Блокировка PRO в UI:**
- `Risk Center`, `Аналитика`, `Ордера` — закрыты замочками.
- Окно `About` содержит полный перевод на английский (включая списки фич и платформы).

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
1. **Tauri:** Процесс `nebula.exe` висит после закрытия (WebSocket не убивается при закрытии окна).
2. **God Object `main.ts`:** Импортирует 36 файлов из 46.
3. **Duplicate Exports:** Интерфейс `Candle` объявлен в нескольких файлах.
4. **HTTPS на сервере:** Сервер лицензий работает по HTTP. Для Android включен `cleartext: true`.
5. **iOS (iPhone):** Код готов к сборке (Capacitor 8 + Browser Plugin), но требуется Mac и Apple Developer аккаунт для сборки `.ipa`.

---

## 9. Стиль разработки и общения
**Разработчик:** Русскоязычный, Windows 11, VS Code, PowerShell.
**Стиль:** Развёрнуто, структурированно. Готовые команды PowerShell.
**Критично:** При замене кода использовать блоки "Найти: ... Заменить на: ...". Всегда проверять `npm run check`. **Не давать огромных скриптов, которые ломают кодировку или дублируют ключи в словарях.**

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
| v2.0.30+ | Интеграция Web3 (P2P Binance + Xgram Swap), встроенный браузер, полная локализация RU/EN, новые кнопки в шапке. |
| v2.0.27+ | Система PRO (сервер, HWID, UI-заглушки), золотая надпись NEBULA PRO, фикс Android HTTP. |
| v2.0.22+ | Crypto Hub, фикс Landscape Mode, кнопка «Назад» в деталях хаба. |
| v2.0.20+ | IndexedDB для Оракула, Promise-кэш, AI Streaming, White Paper. |

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
| **Полный релиз** | `.\scripts\release.ps1` |
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
| **Логи сервера** | `pm2 logs nebula-api` |
| **Пароль админа** | `cat /var/www/nebula-api/server.js \| grep ADMIN_SECRET` |
| **База ключей** | `sqlite3 /var/www/nebula-api/licenses.db "SELECT * FROM keys;"` |

### 🔍 Отладка
| Действие | Инструкция |
|---|---|
| **База Оракула** | F12 -> Application -> IndexedDB -> NebulaDB -> oracleMemory. |
| **Токен PRO** | F12 -> Application -> Local Storage -> `nebulaProToken`. |
| **HWID** | `localStorage.getItem('nebulaDeviceHwid')` |