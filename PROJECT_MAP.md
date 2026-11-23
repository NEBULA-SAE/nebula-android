# NEBULA Oracle Terminal - Project Map

> **Auto-generated** by `scripts/release.ps1` / `scripts/context.ps1`
> Version: **2.0.50** | Branch: `main` | Commit: `8fe5451`
> Generated: 2026-11-23 14:47

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

- TypeScript files in `src/`: 61
- Total LOC in `src/`: 20398
- Bundle (`dist/`): 63 files, 972.7 KB

## Consistency check

- `package.json` version: **2.0.50**
- Last git tag: `v2.0.49`
- Status: **DRIFT** (package.json != last tag)

## Recent changes

### `8fe5451` - 2026-11-22 - chore(release): v2.0.49

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
- `src/locales/auto-en.json`
- `src/sources/orderbook.ts`
- `src/ui/whale.ts`

### `add454d` - 2026-11-22 - chore(release): v2.0.48

Files:
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/capabilities/default.json`
- `src-tauri/tauri.conf.json`
- `src/sources/candles.ts`
- `src/sources/funding.ts`
- `src/sources/orderbook.ts`
- `src/sources/stream.ts`
- `src/sources/whale-futures.ts`

### `f71b264` - 2026-11-22 - chore(release): v2.0.47

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
- `src/config.ts`
- `src/platform/http.ts`

### `64e90b3` - 2026-11-22 - chore(release): v2.0.46

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
- `src/ui/diagnostics.ts`
- `vite.config.ts`

### `f36ff8e` - 2026-11-21 - chore(release): v2.0.45

Files:
- `.gitignore`
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `repomix.config.json`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

## Last release diff

No changes since `v2.0.49`

## Recent tags

- `v2.0.49`
- `v2.0.48`
- `v2.0.47`
- `v2.0.46`
- `v2.0.45`
- `v2.0.44`
- `v2.0.43`
- `v2.0.42`
- `v2.0.41`
- `v2.0.40`

## File tree (src/)

```
src/
+-- backtest/
|   +--   247 engine.ts
+-- btc/
|   +--   166 outlook-engine.ts
+-- data/
|   +--   310 hub.ts
|   +--    42 info.ts
+-- locales/
|   +--   697 .i18n-lock.json
|   +--   558 auto-en.json
|   +--   697 en.json
|   +--   697 ru.json
+-- platform/
|   +--    58 browser.ts
|   +--   118 http.ts
|   +--    29 index.ts
+-- services/
|   +--   152 audio.ts
+-- sources/
|   +--   384 candles.ts
|   +--   140 confluence.ts
|   +--   158 dash.ts
|   +--   135 funding.ts
|   +--   351 kucoin.ts
|   +--   331 mexc.ts
|   +--   439 orderbook.ts
|   +--   253 stream.ts
|   +--   284 whale-futures.ts
+-- styles/
|   +--   136 main.css
+-- trading/
|   +--   103 costs.ts
+-- ui/
|   +--   415 btc-outlook.ts
|   +--   510 chart-overlay.ts
|   +--   331 dash.ts
|   +--   511 diagnostics.ts
|   +--   121 hub.ts
|   +--   409 init.ts
|   +--   247 learning.ts
|   +--    76 market.ts
|   +--   295 master-signal.ts
|   +--   115 mining.ts
|   +--  1447 oracle.ts
|   +--   435 pull-refresh.ts
|   +--   331 risk.ts
|   +--   458 scanner.ts
|   +--  1015 screens.ts
|   +--   632 settings.ts
|   +--   292 splash.ts
|   +--   149 terms.ts
|   +--   383 themes.ts
|   +--   272 timeframes.ts
|   +--   113 tooltip.ts
|   +--  1259 whale.ts
|   +--    92 white-paper.ts
+--   554 ai.ts
+--   277 alerts.ts
+--   280 auth.ts
+--   363 chart.ts
+--    26 config.ts
+--   210 crypto.ts
+--   174 db.ts
+--   359 demo.ts
+--   188 i18n.ts
+--   411 indicators.ts
+--   249 learning-core.ts
+--   265 main.ts
+--   482 market.ts
+--   975 oracle.ts
+--   236 patterns.ts
+--   279 pro.ts
+--   282 themes.ts
+--   723 trading.ts
+--   228 utils.ts
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

### `src/backtest/engine.ts`
- runBacktest()
- DEFAULT_BACKTEST_PARAMS (const)
- BacktestParams (iface)
- BacktestTrade (iface)
- BacktestResult (iface)

### `src/btc/outlook-engine.ts`
- computeBreakoutStats()
- computeBreakoutProbability()
- computeCalendarComparison()
- analyzeCycles()
- BreakoutStats (iface)
- AnalogForBreakout (iface)
- BreakoutProbability (iface)
- CalendarEntry (iface)

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

### `src/data/hub.ts`
- HUB_DATA (const)
- HubText (iface)
- HubItem (iface)

### `src/data/info.ts`
- WHITE_PAPER (const)

### `src/db.ts`
- db (const)
- StoreName (type)

### `src/demo.ts`
- startDemoEngine()
- stopDemoEngine()
- executeDemoPlan()
- cancelDemoOrder()
- resetDemo()

### `src/i18n.ts`
- applyAutoDomTranslation()
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

### `src/learning-core.ts`
- computeCalibration()
- computeInsights()
- computeDataSummary()
- createDriftSnapshot()
- Insight (iface)
- CalibrationBucket (iface)
- DriftSnapshot (iface)

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
- initOracleDb()
- getOracleMemorySnapshot()
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

### `src/platform/browser.ts`
- openExternalService()

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

### `src/pro.ts`
- getHardwareId()
- checkLocalProStatus()
- activateProKey()
- openProModal()
- showProTariffs()
- submitProKey()
- renewProKey()
- deleteProLicense()
- ProStatus (iface)

### `src/services/audio.ts`
- audioService (const)

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
- WallInfo (iface)
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

### `src/trading/costs.ts`
- DEFAULT_COSTS (const)
- tradingCosts (const)
- CostsConfig (iface)
- EntryFill (iface)
- ExitFill (iface)
- TradingCosts (class)

### `src/ui/btc-outlook.ts`
- openBtcOutlook()
- closeBtcOutlook()
- applyBtcGlow()
- initCoinOutlookInline()

### `src/ui/chart-overlay.ts`
- isOverlayEnabled()
- initOracleOverlay()
- toggleOracleOverlay()
- updateOverlayFromAnalysis()
- updateFundingRate()
- toggleChartFullscreen()
- OverlayData (iface)

### `src/ui/dash.ts`
- refreshDashSection()
- renderDashNetwork (const)

### `src/ui/diagnostics.ts`
- runFullDiagnostics()
- showDiagnosticsModal()
- closeDiagnostics()
- DiagnosticsReport (iface)

### `src/ui/hub.ts`
- openCryptoHub()
- openHubDetails()

### `src/ui/init.ts`
- initApp()

### `src/ui/learning.ts`
- switchLearnTab()
- openLearning()
- refreshLearning()
- openLearningHelp()

### `src/ui/market.ts`
- openMarketPulse()

### `src/ui/master-signal.ts`
- resetMasterSignal()
- setModuleSignal()
- LampLevel (type)
- ModuleKey (type)

### `src/ui/mining.ts`
- openMiningCalculator()

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
- switchHomeTab()
- switchTab()
- setLanguage()
- applyStaticTranslations()
- loadActiveCoinCard()
- openSheet()
- closeSheet()
- enterDemoMode()
- exitDemoMode()
- setDemoAmount()
- renderDemoPlan()
- initRadarMenu()
- openBacktestSheet()
- runBacktestUI()
- loadBTC (const)

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
- WallSideView (iface)
- WallsData (iface)

### `src/ui/white-paper.ts`
- openWhitePaper()

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

### `src/pro.ts` (4)

checkLocalProStatus, openProModal, renewProKey, submitProKey

### `src/themes.ts` (12)

applyTheme, createThemeFromColors, DEFAULT_COLORS, deleteCustomTheme, getActiveThemeId, getAllThemes, getCustomThemes, getTheme, loadThemes, resetTheme, saveCustomTheme, submitTheme

### `src/trading.ts` (16)

mobileAiCommand, mobileCalcGrid, mobileDeleteKeys, mobileExecuteTrade, mobileLoadKeys, mobileSaveKeys, mobileSyncOrders, mobileSyncPortfolio, mobileTwapStart, openOrdersSheet, scheduleAutoSaveKeys, selectExTab, startMonitoring, stopMonitoring, switchAiMode, switchExecMode

### `src/ui/btc-outlook.ts` (3)

closeBtcOutlook, initCoinOutlookInline, openBtcOutlook

### `src/ui/chart-overlay.ts` (7)

initOracleOverlay, isOverlayEnabled, showOverlayHelp, toggleChartFullscreen, toggleOracleOverlay, updateFundingRate, updateOverlayFromAnalysis

### `src/ui/dash.ts` (1)

refreshDashSection

### `src/ui/diagnostics.ts` (4)

closeDiagnostics, openDiagnostics, runFullDiagnostics, showDiagnosticsModal

### `src/ui/hub.ts` (2)

openCryptoHub, openHubDetails

### `src/ui/init.ts` (4)

openExchangeMenu, openMiningWhatToMine, openP2PMarket, openXgramSwap

### `src/ui/learning.ts` (4)

openLearning, openLearningHelp, refreshLearning, switchLearnTab

### `src/ui/market.ts` (1)

openMarketPulse

### `src/ui/master-signal.ts` (1)

__openModuleCard

### `src/ui/mining.ts` (1)

calculateMining

### `src/ui/oracle.ts` (20)

_currentDemoPlan, _journalRecords, answerQuizM, askAIMentor, deleteGroqKeyFromModal, executeDemoTrade, loadChartOnly, mobileAnalyze, openAISettings, openJournalEntry, openQuiz, oracleAnalyzeCurrent, refreshOracleStats, renderConfluence, renderOracleAnalogies, renderOracleDashboard, renderPro, saveGroqKeyFromModal, showConfluenceHelp, switchAiScenario

### `src/ui/pull-refresh.ts` (2)

initPullToRefresh, triggerPullRefresh

### `src/ui/risk.ts` (4)

computeRiskSnapshot, injectRiskHelpBtn, renderRiskCenter, showRiskHelp

### `src/ui/scanner.ts` (8)

initAutocomplete, pickCoin, removeFav, renderFavorites, runScanner, suggestPick, toggleFavCurrent, updateStarButton

### `src/ui/screens.ts` (20)

_currentDemoPlan, applyStaticTranslations, cancelDemoOrder, closeBtcOutlook, closeSheet, enterDemoMode, exitDemoMode, initRadarMenu, loadActiveCoinCard, loadBTC, openBacktestSheet, openBtcOutlook, openSheet, renderDemoPlan, resetDemo, runBacktestUI, setDemoAmount, setLanguage, switchHomeTab, switchTab

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

### `src/ui/white-paper.ts` (1)

openWhitePaper

### `src/utils.ts` (9)

esc, fmt, fmtP, relTime, saveFavorites, setHTML, setText, state, toast

### `src/worker.ts` (1)

wCall

## Network endpoints

- `academy.binance.com` (in `hub.ts`)
- `api.alternative.me` (in `market.ts`)
- `api.binance.com` (in `demo.ts`)
- `api.blockchair.com` (in `dash.ts`)
- `api.bybit.com` (in `candles.ts`)
- `api.coingecko.com` (in `btc-outlook.ts`)
- `api.coinpaprika.com` (in `market.ts`)
- `api.dexpaprika.com` (in `market.ts`)
- `api.gateio.ws` (in `chart.ts`)
- `api.groq.com` (in `ai.ts`)
- `api.kucoin.com` (in `candles.ts`)
- `api.mexc.com` (in `candles.ts`)
- `api.minerstat.com` (in `mining.ts`)
- `api.qrserver.com` (in `terms.ts`)
- `bingx.com` (in `hub.ts`)
- `cdn.jsdelivr.net` (in `scanner.ts`)
- `cointelegraph.com` (in `hub.ts`)
- `dash-rpc.publicnode.com` (in `dash.ts`)
- `essamamdani.github.io` (in `screens.ts`)
- `fapi.binance.com` (in `funding.ts`)
- `generativelanguage.googleapis.com` (in `ai.ts`)
- `github.com` (in `themes.ts`)
- `learn.bybit.com` (in `hub.ts`)
- `nebula-oracle.duckdns.org` (in `config.ts`)
- `p2p.binance.com` (in `init.ts`)
- `rapira.exchange` (in `hub.ts`)
- `raw.githubusercontent.com` (in `themes.ts`)
- `shared.eu-central-1.getblock.io` (in `diagnostics.ts`)
- `t.me` (in `pro.ts`)
- `twitter.com` (in `btc-outlook.ts`)
- `whattomine.com` (in `init.ts`)
- `whitebird.io` (in `hub.ts`)
- `WS stream.binance.com` (in `trading.ts`)
- `WS x-push-spot.kucoin.com` (in `stream.ts`)
- `www.binance.com` (in `hub.ts`)
- `www.bybit.com` (in `hub.ts`)
- `www.cbr-xml-daily.ru` (in `market.ts`)
- `www.coingecko.com` (in `hub.ts`)
- `www.dashcentral.org` (in `dash.ts`)
- `www.gate.io` (in `hub.ts`)
- `www.mexc.com` (in `hub.ts`)
- `www.okx.com` (in `market.ts`)
- `www.tradingview.com` (in `hub.ts`)
- `xgram.io` (in `init.ts`)

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
isPro: false
isDemoMode: false
demoBalance: 10000
demoActiveOrders: []
demoHistory: []
```

## DOM contract (index.html)

**Critical IDs** (app breaks if missing): 23
- Status: **all present**

Critical list: ticker, chart-container, chart-stats, tf-bar, verdict, verdict-title, verdict-text, plan-card, agent-card, whale-card, dash-section, dash-network-content, screen-home, screen-pro, screen-scanner, sheet, sheet-overlay, sheet-title, sheet-body, toast-wrap, app-lock-overlay, al-input, al-submit

All IDs in index.html (259 total):

about-build, about-can, about-features-list, about-feedback, about-feedback-desc, about-overlay, about-plat-and, about-platforms, about-platforms-list, about-plat-web, about-plat-win, about-security, about-security-desc, about-tech, about-title, about-version, about-warn, about-what, about-what-desc, about-who, about-who-desc, agent-card, agent-content, ai-cmd-input, ai-cmd-result, ai-cmd-run, ai-deposit, ai-panel-agent, ai-panel-insight, al-biometric, al-confirm-row, al-desc, al-error, al-input, al-input2, al-reset, al-submit, al-title, app-lock-overlay, assets-list, brand-pro-btn, brand-pro-btn-pc, brand-text, brand-text-pc, btc-advice, btc-change, btc-drop, btc-fullname, btc-outlook-content, btc-outlook-inline, btc-outlook-modal, btc-outlook-overlay, btc-price, btc-rebound, btc-rsi, btc-spark, btc-trend, chart-container, chart-stats, coin-logo-container, coin-logo-img, confluence-card, confluence-content, dash-network-content, dash-network-status, dash-section, demo-balance-free, demo-balance-invested, demo-balance-pnl, demo-empty-oracle, demo-empty-orders, demo-exit-btn, demo-oracle-content, demo-orders-list, demo-panel, demo-reset-btn, demo-ticker, demo-ticker-suggest, demo-ticker-summary, diag-body, diag-overlay, diag-title, fav-count, fav-list, fav-market-header, fmh-alt, fmh-alt-ring, fmh-alt-text, fmh-cmc20, fmh-cmc20-bar, fmh-cmc20-change, fmh-fng, fmh-fng-ring, fmh-fng-text, fmh-mcap, fmh-mcap-bar, fmh-mcap-change, home-fav-content, home-main-content, i-bell, i-bolt, i-brain, i-chart, i-clock, i-demo, i-flask, i-globe, i-info, i-language, i-oracle, i-play, i-pulse, i-refresh, i-scan, i-search, i-settings, i-shield, i-star, i-star-fill, i-target, i-trending, i-wallet, i-whale, lamp-agent, lamp-dash, lamp-oracle, lamp-plan, lamp-tf, lamp-walls, lamp-whale, lamp-xray, lbl-agent, lbl-ai-agent-hint, lbl-ai-deposit, lbl-ai-mode-agent, lbl-ai-mode-insight, lbl-ai-run, lbl-assets, lbl-btc-outlook, lbl-confluence, lbl-demo-free, lbl-demo-invested, lbl-demo-oracle-plan, lbl-demo-pnl, lbl-demo-virtual-trades, lbl-drop, lbl-fav, lbl-fmh-alt, lbl-fmh-cmc20, lbl-fmh-fng, lbl-fmh-mcap, lbl-monitor, lbl-oracle-analogs, lbl-oracle-analyze, lbl-oracle-edit, lbl-oracle-edit-hint, lbl-oracle-name, lbl-oracle-profile, lbl-oracle-recent, lbl-oracle-refresh, lbl-oracle-refresh-hint, lbl-oracle-stats, lbl-oracle-status, lbl-plan, lbl-port-pnl, lbl-port-sync, lbl-port-total, lbl-rebound, lbl-scan-acc, lbl-trend, lbl-walls, lbl-whale, lbl-white-paper, lbl-xray, main-brand, main-brand-pc, main-nav, master-signal-card, master-signal-content, monitor-content, monitor-panel, mon-price, mon-sym, nav-exchange, nav-fav, nav-home, nav-hub, nav-oracle, nav-portfolio, nav-pro, nav-risk, nav-scanner, nebula-splash, oracle-analogs-card, oracle-analogs-content, oracle-analogs-empty, oracle-profile-content, oracle-recent-content, oracle-stats-content, oracle-ticker-hint, plan-card, plan-content, port-pnl, port-rate, port-total, port-total-rub, pro-content, pro-expiry-text, radar-center-orb, radar-hub, radar-items, radar-laser-line, radar-learning, radar-market, radar-orders, radar-overlay, radar-portfolio, radar-risk, radar-trigger, radar-trigger-wrap, risk-content, risk-page-title-text, rt-core-text, scan-list, scan-status, screen-fav, screen-home, screen-oracle, screen-portfolio, screen-pro, screen-risk, screen-scanner, sheet, sheet-body, sheet-overlay, sheet-title, splash-loader-bar, splash-stars-canvas, splash-status, tauri-titlebar, tb-close, tb-max, tb-min, terms-overlay, terms-title, tf-bar, ticker, ticker-suggest, toast-wrap, verdict, verdict-text, verdict-title, walls-card, walls-content, whale-card, whale-content, whale-status-badge, xray-card, xray-content

## Key dependencies

- `lightweight-charts : ^4.2.0`
- `@capacitor/core : ^8.5.2`
- `@capacitor/android : ^8.5.2`
- `@tauri-apps/api : ^2.1.1`
- `@tauri-apps/cli : ^2.1.0`
- `typescript : ^5.6.3`
- `vite : ^5.4.10`

## Tech debt

(no TODO/FIXME/HACK markers)

## Release history (last 15 commits)

- 8fe5451  2026-11-22  chore(release): v2.0.49
- add454d  2026-11-22  chore(release): v2.0.48
- f71b264  2026-11-22  chore(release): v2.0.47
- 64e90b3  2026-11-22  chore(release): v2.0.46
- f36ff8e  2026-11-21  chore(release): v2.0.45
- a5c5811  2026-11-21  chore(release): v2.0.44
- e180104  2026-11-21  chore(release): v2.0.43
- 1324cfa  2026-11-20  chore(release): v2.0.42
- 9c9eb58  2026-11-20  chore(release): v2.0.41
- 904606c  2026-11-20  chore(release): v2.0.40
- 3d5b255  2026-11-20  chore(release): v2.0.39
- 8fa67c2  2026-11-11  chore(release): v2.0.38
- baad85d  2026-11-07  chore(release): v2.0.37
- 3beab82  2026-11-05  chore(release): v2.0.36
- 79a0bca  2026-11-04  chore(release): v2.0.35

---

> Regenerate: `npm run context` or `.\scripts\context.ps1`
