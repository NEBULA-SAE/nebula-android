# NEBULA Oracle Terminal - Project Map

> **Auto-generated** by `scripts/release.ps1` / `scripts/context.ps1`
> Version: **2.0.19** | Branch: `main` | Commit: `d11ad41`
> Generated: 2026-10-30 17:31

---

## Contents

1. [Overview](#overview)
2. [Stats](#stats)
3. [Consistency check](#consistency-check)
4. [Recent changes](#recent-changes)
5. [Last release diff](#last-release-diff)
6. [Recent tags](#recent-tags)
7. [File tree](#file-tree-src)
8. [Critical files](#critical-files)
9. [Exports by file](#exports-by-file)
10. [Duplicate exports](#duplicate-exports)
11. [Window exports by module](#window-exports-by-module)
12. [Network endpoints](#network-endpoints)
13. [State shape](#state-shape-srcutilsts)
14. [DOM contract](#dom-contract-indexhtml)
15. [Key dependencies](#key-dependencies)
16. [Tech debt](#tech-debt)
17. [Release history](#release-history-last-15-commits)

---

## Overview

Cryptocurrency analysis + trading terminal.
One codebase, three platforms: Web / Android (Capacitor) / Windows (Tauri).

**Stack:** TypeScript, Vite 5, lightweight-charts 4.2, Capacitor 8, Tauri 2, Web Crypto, Groq AI.

## Stats

- TypeScript files in `src/`: 46
- Total LOC in `src/`: 15007
- Bundle (`dist/`): 57 files, 554.4 KB

## Consistency check

- `package.json` version: **2.0.19**
- Last git tag: `v2.0.18`
- Status: **DRIFT** (package.json != last tag)

## Recent changes

### `d11ad41` - 2026-10-30 - chore(release): v2.0.18

Files:
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/chart.ts`
- `src/ui/oracle.ts`
- `src/ui/timeframes.ts`

### `c93e08a` - 2026-10-30 - chore(release): v2.0.17

Files:
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/titlebar-logo.png`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

### `e189a69` - 2026-10-30 - chore(release): v2.0.16

Files:
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/styles/screens.css`
- `resources/icon.png`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/oracle.ts`
- `src/sources/whale-futures.ts`
- `src/ui/oracle.ts`

### `8a239ea` - 2026-10-29 - chore(release): v2.0.15

Files:
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/styles/layout.css`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

### `c695e5d` - 2026-10-29 - chore(release): v2.0.14

Files:
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/icons/icon.ico`
- `src-tauri/tauri.conf.json`

## Last release diff

No changes since `v2.0.18`

## Recent tags

- `v2.0.18`
- `v2.0.17`
- `v2.0.16`
- `v2.0.15`
- `v2.0.14`
- `v2.0.13`
- `v2.0.12`
- `v2.0.11`
- `v2.0.10`
- `v2.0.9`

## File tree (src/)

```
src/
+-- platform/
|   +--   103 http.ts
|   +--    29 index.ts
+-- sources/
|   +--   268 candles.ts
|   +--   147 confluence.ts
|   +--   158 dash.ts
|   +--    95 funding.ts
|   +--   336 kucoin.ts
|   +--   331 mexc.ts
|   +--   192 orderbook.ts
|   +--   234 stream.ts
|   +--   248 whale-futures.ts
+-- styles/
|   +--   136 main.css
+-- ui/
|   +--   428 chart-overlay.ts
|   +--   236 dash.ts
|   +--   498 diagnostics.ts
|   +--   226 init.ts
|   +--   132 learning.ts
|   +--    76 market.ts
|   +--  1095 oracle.ts
|   +--   436 pull-refresh.ts
|   +--   311 risk.ts
|   +--   256 scanner.ts
|   +--   486 screens.ts
|   +--   609 settings.ts
|   +--   292 splash.ts
|   +--   150 terms.ts
|   +--   383 themes.ts
|   +--   272 timeframes.ts
|   +--   113 tooltip.ts
|   +--   691 whale.ts
+--   437 ai.ts
+--   277 alerts.ts
+--   280 auth.ts
+--   342 chart.ts
+--    33 config.ts
+--   210 crypto.ts
+--   330 demo.ts
+--   703 i18n.ts
+--   411 indicators.ts
+--   265 main.ts
+--   475 market.ts
+--   805 oracle.ts
+--   185 patterns.ts
+--   282 themes.ts
+--   687 trading.ts
+--   225 utils.ts
+--   229 worker.ts
```

## Critical files

Files that handle secrets, money, or auth. **Do not modify without backup.**

- `src/auth.ts` (OK) - app password, biometrics
- `src/crypto.ts` (OK) - AES-256-GCM, PBKDF2, API keys
- `src/trading.ts` (OK) - orders, TWAP, MEXC API
- `src/sources/mexc.ts` (OK) - exchange API signing (HMAC)
- `src/ai.ts` (OK) - Groq API, user prompts
- `src/main.ts` (OK) - bootstrap, fetch patch, auth

## Exports by file

### `src/ai.ts`
- getAiMentor()
- parseTradeIntent()
- validateTradeIntent()
- ORACLE_AI_SYSTEM_PROMPT (const)
- TRADE_INTENT_SYSTEM_PROMPT (const)
- AiMentorResult (iface)
- TradeIntent (iface)

### `src/alerts.ts`
- addAlert()
- removeAlert()
- checkAlerts()
- startAlertsLoop()
- stopAlertsLoop()
- openAlertsSheet()
- submitAlertFromSheet()

### `src/auth.ts`
- getAuthPassword()
- hasAppPassword()
- clearAppPassword()
- getOrCreateUserId()
- isBiometricsSupported()
- checkBiometricsAvailable()
- enableBiometrics()
- disableBiometrics()
- initAuth()

### `src/chart.ts`
- showChartLoading()
- hideChartLoading()
- initChart()
- clearLines()
- clearOrderbookLines()
- mapCandleArray()
- fetchCandles()
- drawOrderbookWalls()
- drawNowLine()
- setCandlesAndFit()
- updateCandles()
- updateLastCandle()
- Candle (iface)
- WallsData (iface)

### `src/config.ts`
- P()

### `src/crypto.ts`
- isEncryptedToken()
- encryptJson()
- decryptJson()
- hmacSha256Hex()
- saveGroqKey()
- loadGroqKey()
- deleteGroqKey()

### `src/demo.ts`
- startDemoEngine()
- stopDemoEngine()
- executeDemoPlan()
- cancelDemoOrder()
- resetDemo()

### `src/i18n.ts`
- tm()
- isEN()
- getLang()
- setLang()
- getAllKeys()
- Lang (type)

### `src/indicators.ts`
- ema()
- emaSeries()
- calcMacd()
- calcBollinger()
- calcAtr()
- calcAdx()
- calcRsiSimple()
- calcRsi()
- calcStochRsi()
- findSupportResistance()
- detectDivergence()
- calcVolumeProfile()
- enhancedMarketRegime()
- Candle (iface)
- MacdResult (iface)
- BollingerResult (iface)
- SrResult (iface)
- DivergenceResult (iface)
- VolumeProfileResult (iface)
- MarketRegimeResult (iface)

### `src/market.ts`
- getCurrentRate()
- getOnchainData()
- getMarketContext()
- getBtcDailyAnalysis()
- getAdvancedAnalytics()
- OnchainPool (iface)
- OnchainData (iface)
- MarketContext (iface)
- AdvancedAnalytics (iface)

### `src/oracle.ts`
- saveRiskProfile()
- loadRiskProfile()
- computeRiskProfile()
- saveMemory()
- oracleSaveAnalysis()
- oracleUpdateOutcomes()
- oracleLearnPatterns()
- oracleGetAnalogies()
- oracleGetStats()
- oracleGetRecent()
- oracleGetLearnedWeight()
- oracleAnalyze()
- RiskProfile (iface)
- OracleAnalyzeResult (iface)

### `src/patterns.ts`
- matchPatterns()
- humanizePattern()
- PATTERNS_DB (const)
- PatternRule (iface)
- PatternDef (iface)
- PatternMatch (iface)

### `src/platform/http.ts`
- installFetchPatch()

### `src/platform/index.ts`
- platform (const)
- isWeb (const)
- isAndroid (const)
- isTauri (const)
- isDesktop (const)
- isMobile (const)
- Platform (type)

### `src/sources/candles.ts`
- getTfConfig()
- fetchCandlesWithSource()
- fetchCandles()
- TF_CONFIG (const)
- Candle (iface)
- Timeframe (type)

### `src/sources/confluence.ts`
- getConfluence()
- TFSignal (iface)
- ConfluenceResult (iface)
- ConfluenceTF (type)

### `src/sources/dash.ts`
- getDashNetworkStats()
- DashNetworkStats (iface)

### `src/sources/funding.ts`
- getAggregatedFunding()
- FundingResult (iface)

### `src/sources/kucoin.ts`
- getCurrentPrice()
- executeKucoinOrders()
- getKucoinOpenOrders()
- cancelKucoinOrders()
- placeKucoinMarketOrder()
- placeKucoinLimitOrder()
- getKucoinPortfolio()
- KucoinKeys (iface)
- OrderResponse (iface)
- PlanStep (iface)
- Asset (iface)
- PortfolioData (iface)

### `src/sources/mexc.ts`
- getCurrentPrice()
- executeExchangeOrders()
- getOpenOrders()
- cancelAllOrders()
- placeMarketOrder()
- placeLimitOrder()
- getPortfolio()
- MexcKeys (iface)
- OrderParams (iface)
- OrderResponse (iface)
- Asset (iface)
- PortfolioData (iface)
- PlanStep (iface)

### `src/sources/orderbook.ts`
- getAggregatedOrderbook()
- OrderbookResult (iface)

### `src/sources/stream.ts`
- PriceStreamOptions (iface)
- PriceStream (class)

### `src/sources/whale-futures.ts`
- getWhaleFuturesMetrics()
- WhaleFuturesMetrics (iface)

### `src/themes.ts`
- loadThemes()
- applyTheme()
- resetTheme()
- getActiveThemeId()
- getCustomThemes()
- saveCustomTheme()
- deleteCustomTheme()
- createThemeFromColors()
- submitTheme()
- getAllThemes()
- getTheme()
- DEFAULT_COLORS (const)
- ThemeColors (iface)
- Theme (iface)

### `src/trading.ts`
- saveKeys()
- loadKeys()
- deleteKeys()
- switchAiMode()
- openOrdersSheet()
- selectExTab()
- switchExecMode()
- mobileLoadKeys()
- mobileSaveKeys()
- mobileDeleteKeys()
- scheduleAutoSaveKeys()
- calculateStrategy()
- mobileCalcGrid()
- mobileExecuteTrade()
- mobileSyncOrders()
- startMonitoring()
- stopMonitoring()
- mobileSyncPortfolio()
- mobileAiCommand()
- mobileTwapStart()

### `src/ui/chart-overlay.ts`
- isOverlayEnabled()
- initOracleOverlay()
- toggleOracleOverlay()
- updateOverlayFromAnalysis()
- updateFundingRate()
- OverlayData (iface)

### `src/ui/dash.ts`
- refreshDashSection()
- renderDashNetwork (const)

### `src/ui/diagnostics.ts`
- runFullDiagnostics()
- showDiagnosticsModal()
- closeDiagnostics()
- DiagnosticsReport (iface)

### `src/ui/init.ts`
- initApp()

### `src/ui/learning.ts`
- openLearning()
- refreshLearning()

### `src/ui/market.ts`
- openMarketPulse()

### `src/ui/oracle.ts`
- loadChartOnly()
- mobileAnalyze()
- renderPro()
- renderConfluence()
- askAIMentor()
- switchAiScenario()
- openAISettings()
- saveGroqKeyFromModal()
- deleteGroqKeyFromModal()
- renderOracleDashboard()
- refreshOracleStats()
- oracleAnalyzeCurrent()
- openQuiz()
- answerQuizM()
- executeDemoTrade()
- openJournalEntry()
- showConfluenceHelp()
- renderOracleAnalogies()

### `src/ui/pull-refresh.ts`
- initPullToRefresh()

### `src/ui/risk.ts`
- computeRiskSnapshot()
- renderRiskCenter()
- showRiskHelp()
- injectRiskHelpBtn()

### `src/ui/scanner.ts`
- runScanner()
- pickCoin()
- initAutocomplete()
- suggestPick()
- updateStarButton()
- toggleFavCurrent()
- renderFavorites()
- removeFav()

### `src/ui/screens.ts`
- switchTab()
- setLanguage()
- applyStaticTranslations()
- loadBTC()
- openSheet()
- closeSheet()
- enterDemoMode()
- exitDemoMode()
- setDemoAmount()
- renderDemoPlan()
- initRadarMenu()

### `src/ui/settings.ts`
- openSettings()
- setupBiometrics()
- openGroqSheet()
- saveGroqFromSettings()
- deleteGroqFromSettings()
- openExchangeSheet()
- saveExchangeKeys()
- deleteExchangeKeys()
- openThemesFromSettings()
- openDiagnosticsFromSettings()
- openAboutFromSettings()
- openDonateFromSettings()
- openSupportChat()
- toggleAppPassword()
- resetAllKeys()
- openCommunityChat()
- openFunChat()

### `src/ui/terms.ts`
- acceptTerms()
- showAbout()
- hideAbout()
- copyDonate()
- openDonateModal()

### `src/ui/themes.ts`
- openThemeEditor()
- applyThemeById()
- removeTheme()
- openThemeCreator()
- saveAndApplyTheme()
- saveAndSubmitTheme()
- applyThemePreset()

### `src/ui/timeframes.ts`
- getCurrentTimeframe()
- setTimeframe()
- startAutoRefresh()
- stopAutoRefresh()
- initTimeframeBar()

### `src/ui/whale.ts`
- calculateVolumeAnomalies()
- mergeWhaleMetrics()
- renderWhaleData()
- fetchExtras()
- Candle (iface)
- WhaleSpotData (iface)
- WhaleFuturesInput (iface)
- WhaleMergedData (iface)
- XrayData (iface)
- WallsData (iface)

### `src/utils.ts`
- saveFavorites()
- fmt()
- fmtP()
- setText()
- setHTML()
- esc()
- relTime()
- toast()
- state (const)
- Candle (iface)
- PlanStep (iface)
- ToastType (iface)
- RiskIndicator (iface)
- RiskSnapshot (iface)
- Alert (iface)
- RiskLevel (type)
- AlertKind (type)

### `src/worker.ts`
- wCall()
- destroyWorker()
- ScanItem (iface)
- ScanResult (iface)
- RsiData (iface)
- WCallType (type)

## Duplicate exports

Same interface/type declared in multiple files. Candidates for refactor into shared module.

- **Asset** - src/sources/kucoin.ts, src/sources/mexc.ts
- **Candle** - src/chart.ts, src/indicators.ts, src/utils.ts, src/sources/candles.ts, src/ui/whale.ts
- **OrderResponse** - src/sources/kucoin.ts, src/sources/mexc.ts
- **PlanStep** - src/utils.ts, src/sources/kucoin.ts, src/sources/mexc.ts
- **PortfolioData** - src/sources/kucoin.ts, src/sources/mexc.ts
- **WallsData** - src/chart.ts, src/ui/whale.ts

## Window exports by module

Functions/objects assigned to `window` for inline HTML handlers.

### `src/alerts.ts` (7)

addAlert, checkAlerts, openAlertsSheet, removeAlert, startAlertsLoop, stopAlertsLoop, submitAlertFromSheet

### `src/chart.ts` (12)

clearLines, clearOrderbookLines, drawNowLine, drawOrderbookWalls, fetchCandles, hideChartLoading, initChart, mapCandleArray, setCandlesAndFit, showChartLoading, updateCandles, updateLastCandle

### `src/i18n.ts` (5)

getAllKeys, getLang, isEN, setLang, tm

### `src/oracle.ts` (5)

oracleGetAnalogies, oracleGetRecent, oracleGetStats, oracleLearnPatterns, oracleUpdateOutcomes

### `src/themes.ts` (12)

applyTheme, createThemeFromColors, DEFAULT_COLORS, deleteCustomTheme, getActiveThemeId, getAllThemes, getCustomThemes, getTheme, loadThemes, resetTheme, saveCustomTheme, submitTheme

### `src/trading.ts` (16)

mobileAiCommand, mobileCalcGrid, mobileDeleteKeys, mobileExecuteTrade, mobileLoadKeys, mobileSaveKeys, mobileSyncOrders, mobileSyncPortfolio, mobileTwapStart, openOrdersSheet, scheduleAutoSaveKeys, selectExTab, startMonitoring, stopMonitoring, switchAiMode, switchExecMode

### `src/ui/chart-overlay.ts` (6)

initOracleOverlay, isOverlayEnabled, showOverlayHelp, toggleOracleOverlay, updateFundingRate, updateOverlayFromAnalysis

### `src/ui/dash.ts` (1)

refreshDashSection

### `src/ui/diagnostics.ts` (4)

closeDiagnostics, openDiagnostics, runFullDiagnostics, showDiagnosticsModal

### `src/ui/learning.ts` (2)

openLearning, refreshLearning

### `src/ui/market.ts` (1)

openMarketPulse

### `src/ui/oracle.ts` (20)

_currentDemoPlan, _journalRecords, answerQuizM, askAIMentor, deleteGroqKeyFromModal, executeDemoTrade, loadChartOnly, mobileAnalyze, openAISettings, openJournalEntry, openQuiz, oracleAnalyzeCurrent, refreshOracleStats, renderConfluence, renderOracleAnalogies, renderOracleDashboard, renderPro, saveGroqKeyFromModal, showConfluenceHelp, switchAiScenario

### `src/ui/pull-refresh.ts` (2)

initPullToRefresh, triggerPullRefresh

### `src/ui/risk.ts` (4)

computeRiskSnapshot, injectRiskHelpBtn, renderRiskCenter, showRiskHelp

### `src/ui/scanner.ts` (8)

initAutocomplete, pickCoin, removeFav, renderFavorites, runScanner, suggestPick, toggleFavCurrent, updateStarButton

### `src/ui/screens.ts` (14)

_currentDemoPlan, applyStaticTranslations, cancelDemoOrder, closeSheet, enterDemoMode, exitDemoMode, initRadarMenu, loadBTC, openSheet, renderDemoPlan, resetDemo, setDemoAmount, setLanguage, switchTab

### `src/ui/settings.ts` (17)

deleteExchangeKeys, deleteGroqFromSettings, openAboutFromSettings, openCommunityChat, openDiagnosticsFromSettings, openDonateFromSettings, openExchangeSheet, openFunChat, openGroqSheet, openSettings, openSupportChat, openThemesFromSettings, resetAllKeys, saveExchangeKeys, saveGroqFromSettings, setupBiometrics, toggleAppPassword

### `src/ui/splash.ts` (1)

NebulaSplash

### `src/ui/terms.ts` (5)

acceptTerms, copyDonate, hideAbout, openDonateModal, showAbout

### `src/ui/themes.ts` (7)

applyThemeById, applyThemePreset, openThemeCreator, openThemeEditor, removeTheme, saveAndApplyTheme, saveAndSubmitTheme

### `src/ui/timeframes.ts` (6)

_tfDebounce, getCurrentTimeframe, initTimeframeBar, setTimeframe, startAutoRefresh, stopAutoRefresh

### `src/ui/tooltip.ts` (1)

_nebulaTipInit

### `src/ui/whale.ts` (4)

calculateVolumeAnomalies, fetchExtras, mergeWhaleMetrics, renderWhaleData

### `src/utils.ts` (9)

esc, fmt, fmtP, relTime, saveFavorites, setHTML, setText, state, toast

### `src/worker.ts` (1)

wCall

## Network endpoints

- `api.alternative.me` (in `market.ts`)
- `api.binance.com` (in `trading.ts`)
- `api.blockchair.com` (in `dash.ts`)
- `api.bybit.com` (in `candles.ts`)
- `api.coinpaprika.com` (in `market.ts`)
- `api.dexpaprika.com` (in `market.ts`)
- `api.gateio.ws` (in `chart.ts`)
- `api.groq.com` (in `ai.ts`)
- `api.kucoin.com` (in `candles.ts`)
- `api.mexc.com` (in `candles.ts`)
- `api.qrserver.com` (in `terms.ts`)
- `dash-rpc.publicnode.com` (in `dash.ts`)
- `fapi.binance.com` (in `whale-futures.ts`)
- `github.com` (in `themes.ts`)
- `nebula-oracle.duckdns.org` (in `config.ts`)
- `raw.githubusercontent.com` (in `themes.ts`)
- `shared.eu-central-1.getblock.io` (in `diagnostics.ts`)
- `t.me` (in `settings.ts`)
- `WS stream.binance.com` (in `trading.ts`)
- `WS x-push-spot.kucoin.com` (in `stream.ts`)
- `www.cbr-xml-daily.ru` (in `market.ts`)
- `www.dashcentral.org` (in `dash.ts`)
- `www.okx.com` (in `market.ts`)

## State shape (src/utils.ts)

```
chart: null
candleSeries: null
priceLines: []
orderbookLines: []
lastAdv: null
currentTicker: 'DASH'
currentTimeframe: '1d'
scannerRunning: false
scannerTimer: null
monitorInterval: null
monitorWs: null
currentPlan: null
trackingSymbol: null
allPairs: []
allPairsBySymbol: {}
favoriteCoins: JSON.parse(localStorage.getItem('smartMoneyFavorites') || '[]')
currentExchange: 'mexc'
quizAnswers: {}
lastOracleResult: null
lastMarketData: null
lastWhaleData: null
riskSnapshot: null
alerts: JSON.parse(localStorage.getItem('nebulaAlerts') || '[]')
alertsLastCheck: 0
lastFuturesMetrics: null
lastMarketContext: null
isDemoMode: false
demoBalance: 10000
demoActiveOrders: []
demoHistory: []
```

## DOM contract (index.html)

**Critical IDs** (app breaks if missing): 23
- Status: **all present**

Critical list: ticker, chart-container, chart-stats, tf-bar, verdict, verdict-title, verdict-text, plan-card, agent-card, whale-card, dash-section, dash-network-content, screen-home, screen-pro, screen-scanner, sheet, sheet-overlay, sheet-title, sheet-body, toast-wrap, app-lock-overlay, al-input, al-submit

All IDs in index.html (181 total):

about-overlay, about-title, agent-card, agent-content, ai-cmd-input, ai-cmd-result, ai-cmd-run, ai-deposit, ai-panel-agent, ai-panel-insight, al-biometric, al-confirm-row, al-desc, al-error, al-input, al-input2, al-reset, al-submit, al-title, app-lock-overlay, assets-list, btc-advice, btc-change, btc-drop, btc-price, btc-rebound, btc-rsi, btc-trend, chart-container, chart-stats, confluence-badge, confluence-card, confluence-content, dash-network-content, dash-network-status, dash-section, demo-balance-free, demo-balance-invested, demo-balance-pnl, demo-oracle-content, demo-orders-list, demo-panel, demo-ticker, demo-ticker-suggest, demo-ticker-summary, diag-body, diag-overlay, fav-count, fav-list, i-bell, i-bolt, i-brain, i-chart, i-check, i-clock, i-flask, i-globe, i-info, i-lock, i-oracle, i-play, i-pulse, i-radar, i-refresh, i-scan, i-search, i-settings, i-shield, i-star, i-star-fill, i-target, i-trending, i-wallet, i-whale, i-x, lang-en, lang-ru, lbl-agent, lbl-ai-agent-hint, lbl-ai-deposit, lbl-ai-mode-agent, lbl-ai-mode-insight, lbl-ai-run, lbl-assets, lbl-confluence, lbl-drop, lbl-fav, lbl-monitor, lbl-oracle-analogs, lbl-oracle-analyze, lbl-oracle-edit, lbl-oracle-edit-hint, lbl-oracle-name, lbl-oracle-profile, lbl-oracle-recent, lbl-oracle-refresh, lbl-oracle-refresh-hint, lbl-oracle-stats, lbl-oracle-status, lbl-plan, lbl-port-pnl, lbl-port-sync, lbl-port-total, lbl-rebound, lbl-scan-acc, lbl-trend, lbl-walls, lbl-whale, lbl-xray, main-nav, monitor-content, monitor-panel, mon-price, mon-sym, nav-fav, nav-home, nav-oracle, nav-portfolio, nav-pro, nav-risk, nav-scanner, nebula-splash, oracle-analogs-card, oracle-analogs-content, oracle-profile-content, oracle-recent-content, oracle-stats-content, oracle-ticker-hint, plan-card, plan-content, port-pnl, port-rate, port-total, port-total-rub, pro-content, radar-center-orb, radar-items, radar-laser-line, radar-overlay, radar-trigger, radar-trigger-wrap, risk-content, risk-page-title-text, scan-list, scan-status, screen-fav, screen-home, screen-oracle, screen-portfolio, screen-pro, screen-risk, screen-scanner, sheet, sheet-body, sheet-overlay, sheet-title, splash-loader-bar, splash-stars-canvas, splash-status, star-btn, star-icon, tauri-titlebar, tb-close, tb-max, tb-min, terms-overlay, terms-title, tf-bar, ticker, ticker-suggest, toast-wrap, verdict, verdict-text, verdict-title, walls-card, walls-content, whale-card, whale-content, whale-status-badge, xray-card, xray-content

## Key dependencies

- `lightweight-charts : ^4.2.0`
- `@capacitor/core : ^8.5.2`
- `@capacitor/android : ^8.5.2`
- `@tauri-apps/api : ^2.1.1`
- `@tauri-apps/cli : ^2.1.0`
- `typescript : ^5.6.3`
- `vite : ^5.4.10`

## Tech debt

5 markers found (TODO / FIXME / HACK / XXX):

- `src/sources/kucoin.ts:282` - const rate = 95; // TODO: подтягивать из market.ts, как в mexc.ts
- `src/sources/kucoin.ts:303` - // TODO: fetch price
- `src/ui/learning.ts:5` - // TODO: oracle_get_stats пока не перенесён — заглушка.
- `src/ui/learning.ts:32` - // TODO: заменить на реальный источник, когда перенесём oracle.py
- `src/ui/learning.ts:117` - // TODO: заменить на реальные oracle_update_outcomes / oracle_learn_patterns

## Release history (last 15 commits)

- d11ad41  2026-10-30  chore(release): v2.0.18
- c93e08a  2026-10-30  chore(release): v2.0.17
- e189a69  2026-10-30  chore(release): v2.0.16
- 8a239ea  2026-10-29  chore(release): v2.0.15
- c695e5d  2026-10-29  chore(release): v2.0.14
- 5a93e1f  2026-10-29  chore(release): v2.0.13
- 3ef9fd6  2026-10-29  chore(release): v2.0.12
- caf4a6a  2026-10-28  chore(release): v2.0.11
- 2410041  2026-10-28  chore(release): v2.0.10
- 1f2c272  2026-10-28  chore(release): v2.0.9
- 4d05231  2026-10-28  chore(release): v2.0.8
- c2a620d  2026-10-28  chore(release): v2.0.7
- 3a37664  2026-10-28  chore(release): v2.0.6
- 0afb819  2026-10-28  backup before chart race fix
- 373f3de  2026-10-27  chore(release): v2.0.5

---

> Regenerate: `npm run context` or `.\scripts\context.ps1`
