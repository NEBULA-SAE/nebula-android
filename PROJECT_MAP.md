# NEBULA Oracle Terminal - Project Map

> **Auto-generated** by `scripts/release.ps1` / `scripts/context.ps1`
> Version: **2.0.37** | Branch: `main` | Commit: `3beab82`
> Generated: 2026-11-07 17:52

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

- TypeScript files in `src/`: 57
- Total LOC in `src/`: 18717
- Bundle (`dist/`): 60 files, 722.8 KB

## Consistency check

- `package.json` version: **2.0.37**
- Last git tag: `v2.0.36`
- Status: **DRIFT** (package.json != last tag)

## Recent changes

### `3beab82` - 2026-11-05 - chore(release): v2.0.36

Files:
- `AI_CONTEXT.md`
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/styles/components.css`
- `public/styles/screens.css`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/i18n.ts`
- `src/oracle.ts`
- `src/patterns.ts`
- `src/ui/oracle.ts`
- `src/ui/scanner.ts`
- `src/ui/screens.ts`

### `79a0bca` - 2026-11-04 - chore(release): v2.0.35

Files:
- `AI_CONTEXT.md`
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/styles/components.css`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/ui/scanner.ts`
- `src/ui/screens.ts`

### `6e12419` - 2026-11-03 - chore(release): v2.0.34

Files:
- `AI_CONTEXT.md`
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/i18n.ts`
- `src/learning-core.ts`
- `src/oracle.ts`
- `src/patterns.ts`
- `src/ui/learning.ts`
- `src/ui/oracle.ts`

### `4b13def` - 2026-11-03 - chore(release): v2.0.33

Files:
- `AI_CONTEXT.md`
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/styles/components.css`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/ui/chart-overlay.ts`

### `95f9b76` - 2026-11-03 - chore(release): v2.0.32

Files:
- `PROJECT_MAP.md`
- `README.md`
- `android/app/build.gradle`
- `android/app/capacitor.build.gradle`
- `android/capacitor.settings.gradle`
- `capacitor.config.ts`
- `index.html`
- `package-lock.json`
- `package.json`
- `public/styles/components.css`
- `src-tauri/Cargo.lock`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src/chart.ts`
- `src/data/info.ts`
- `src/i18n.ts`
- `src/platform/browser.ts`
- `src/ui/chart-overlay.ts`
- `src/ui/init.ts`
- `src/ui/mining.ts`
- `src/ui/white-paper.ts`

## Last release diff

No changes since `v2.0.36`

## Recent tags

- `v2.0.36`
- `v2.0.35`
- `v2.0.34`
- `v2.0.33`
- `v2.0.32`
- `v2.0.31`
- `v2.0.30`
- `v2.0.29`
- `v2.0.28`
- `v2.0.27`

## File tree (src/)

```
src/
+-- btc/
|   +--   193 outlook-engine.ts
+-- data/
|   +--   310 hub.ts
|   +--    42 info.ts
+-- platform/
|   +--    58 browser.ts
|   +--   103 http.ts
|   +--    29 index.ts
+-- sources/
|   +--   289 candles.ts
|   +--   140 confluence.ts
|   +--   158 dash.ts
|   +--    95 funding.ts
|   +--   336 kucoin.ts
|   +--   331 mexc.ts
|   +--   241 orderbook.ts
|   +--   237 stream.ts
|   +--   248 whale-futures.ts
+-- styles/
|   +--   136 main.css
+-- ui/
|   +--   282 btc-outlook.ts
|   +--   510 chart-overlay.ts
|   +--   236 dash.ts
|   +--   511 diagnostics.ts
|   +--   121 hub.ts
|   +--   333 init.ts
|   +--   244 learning.ts
|   +--    76 market.ts
|   +--   115 mining.ts
|   +--  1208 oracle.ts
|   +--   436 pull-refresh.ts
|   +--   331 risk.ts
|   +--   447 scanner.ts
|   +--   567 screens.ts
|   +--   628 settings.ts
|   +--   292 splash.ts
|   +--   149 terms.ts
|   +--   383 themes.ts
|   +--   272 timeframes.ts
|   +--   113 tooltip.ts
|   +--   738 whale.ts
|   +--    92 white-paper.ts
+--   483 ai.ts
+--   277 alerts.ts
+--   280 auth.ts
+--   363 chart.ts
+--    33 config.ts
+--   210 crypto.ts
+--    52 db.ts
+--   330 demo.ts
+--  1506 i18n.ts
+--   411 indicators.ts
+--   249 learning-core.ts
+--   265 main.ts
+--   482 market.ts
+--   971 oracle.ts
+--   236 patterns.ts
+--   242 pro.ts
+--   282 themes.ts
+--   694 trading.ts
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

### `src/btc/outlook-engine.ts`
- analyzeCycles()
- computeBreakoutStats()
- computeBreakoutProbability()
- computeCalendarComparison()
- HISTORICAL_ATHS (const)
- AthCycleInfo (iface)
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

### `src/ui/btc-outlook.ts`
- openBtcOutlook()
- closeBtcOutlook()
- applyBtcGlow()

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

### `src/ui/btc-outlook.ts` (2)

closeBtcOutlook, openBtcOutlook

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

### `src/ui/screens.ts` (17)

_currentDemoPlan, applyStaticTranslations, cancelDemoOrder, closeBtcOutlook, closeSheet, enterDemoMode, exitDemoMode, initRadarMenu, loadBTC, openBtcOutlook, openSheet, renderDemoPlan, resetDemo, setDemoAmount, setLanguage, switchHomeTab, switchTab

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
- `api.binance.com` (in `trading.ts`)
- `api.blockchair.com` (in `dash.ts`)
- `api.bybit.com` (in `candles.ts`)
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
- `fapi.binance.com` (in `whale-futures.ts`)
- `github.com` (in `themes.ts`)
- `learn.bybit.com` (in `hub.ts`)
- `nebula-oracle.duckdns.org` (in `config.ts`)
- `p2p.binance.com` (in `init.ts`)
- `rapira.exchange` (in `hub.ts`)
- `raw.githubusercontent.com` (in `themes.ts`)
- `shared.eu-central-1.getblock.io` (in `diagnostics.ts`)
- `t.me` (in `pro.ts`)
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

All IDs in index.html (234 total):

about-build, about-can, about-features-list, about-feedback, about-feedback-desc, about-overlay, about-plat-and, about-platforms, about-platforms-list, about-plat-web, about-plat-win, about-security, about-security-desc, about-tech, about-title, about-version, about-warn, about-what, about-what-desc, about-who, about-who-desc, agent-card, agent-content, ai-cmd-input, ai-cmd-result, ai-cmd-run, ai-deposit, ai-panel-agent, ai-panel-insight, al-biometric, al-confirm-row, al-desc, al-error, al-input, al-input2, al-reset, al-submit, al-title, app-lock-overlay, assets-list, brand-pro-btn, brand-pro-btn-pc, brand-text, brand-text-pc, btc-advice, btc-change, btc-drop, btc-outlook-content, btc-outlook-modal, btc-outlook-overlay, btc-price, btc-rebound, btc-rsi, btc-trend, chart-container, chart-stats, confluence-badge, confluence-card, confluence-content, dash-network-content, dash-network-status, dash-section, demo-balance-free, demo-balance-invested, demo-balance-pnl, demo-empty-oracle, demo-empty-orders, demo-exit-btn, demo-oracle-content, demo-orders-list, demo-panel, demo-reset-btn, demo-ticker, demo-ticker-suggest, demo-ticker-summary, diag-body, diag-overlay, diag-title, fav-count, fav-list, fav-market-header, fmh-alt, fmh-alt-ring, fmh-alt-text, fmh-cmc20, fmh-cmc20-bar, fmh-cmc20-change, fmh-fng, fmh-fng-ring, fmh-fng-text, fmh-mcap, fmh-mcap-bar, fmh-mcap-change, home-fav-content, home-main-content, htab-fav, htab-main, i-bolt, i-brain, i-chart, i-demo, i-flask, i-globe, i-language, i-oracle, i-settings, i-shield, i-star, i-star-fill, i-target, i-wallet, lbl-agent, lbl-ai-agent-hint, lbl-ai-deposit, lbl-ai-mode-agent, lbl-ai-mode-insight, lbl-ai-run, lbl-assets, lbl-btc-outlook, lbl-confluence, lbl-demo-free, lbl-demo-invested, lbl-demo-oracle-plan, lbl-demo-pnl, lbl-demo-virtual-trades, lbl-drop, lbl-fav, lbl-fmh-alt, lbl-fmh-cmc20, lbl-fmh-fng, lbl-fmh-mcap, lbl-oracle-analogs, lbl-oracle-analyze, lbl-oracle-edit, lbl-oracle-edit-hint, lbl-oracle-name, lbl-oracle-profile, lbl-oracle-recent, lbl-oracle-refresh, lbl-oracle-refresh-hint, lbl-oracle-stats, lbl-oracle-status, lbl-plan, lbl-port-pnl, lbl-port-sync, lbl-port-total, lbl-rebound, lbl-scan-acc, lbl-tab-chart, lbl-tab-favorites, lbl-trend, lbl-walls, lbl-whale, lbl-white-paper, lbl-xray, main-brand, main-brand-pc, main-nav, monitor-panel, nav-home, nav-hub, nav-oracle, nav-portfolio, nav-pro, nav-risk, nav-scanner, nebula-splash, oracle-analogs-card, oracle-analogs-content, oracle-analogs-empty, oracle-profile-content, oracle-recent-content, oracle-stats-content, oracle-ticker-hint, plan-card, plan-content, port-pnl, port-rate, port-total, port-total-rub, pro-content, radar-center-orb, radar-hub, radar-items, radar-laser-line, radar-learning, radar-market, radar-orders, radar-overlay, radar-portfolio, radar-risk, radar-trigger, radar-trigger-wrap, risk-content, risk-page-title-text, rt-core-text, scan-list, scan-status, screen-fav, screen-home, screen-oracle, screen-portfolio, screen-pro, screen-risk, screen-scanner, sheet, sheet-body, sheet-overlay, sheet-title, splash-loader-bar, splash-stars-canvas, splash-status, star-btn, star-icon, tauri-titlebar, tb-close, tb-max, tb-min, terms-overlay, terms-title, tf-bar, ticker, ticker-suggest, toast-wrap, verdict, verdict-text, verdict-title, walls-card, walls-content, whale-card, whale-content, whale-status-badge, xray-card, xray-content

## Key dependencies

- `lightweight-charts : ^4.2.0`
- `@capacitor/core : ^8.5.2`
- `@capacitor/android : ^8.5.2`
- `@tauri-apps/api : ^2.1.1`
- `@tauri-apps/cli : ^2.1.0`
- `typescript : ^5.6.3`
- `vite : ^5.4.10`

## Tech debt

2 markers found (TODO / FIXME / HACK / XXX):

- `src/sources/kucoin.ts:282` - const rate = 95; // TODO: подтягивать из market.ts, как в mexc.ts
- `src/sources/kucoin.ts:303` - // TODO: fetch price

## Release history (last 15 commits)

- 3beab82  2026-11-05  chore(release): v2.0.36
- 79a0bca  2026-11-04  chore(release): v2.0.35
- 6e12419  2026-11-03  chore(release): v2.0.34
- 4b13def  2026-11-03  chore(release): v2.0.33
- 95f9b76  2026-11-03  chore(release): v2.0.32
- a2ca92b  2026-11-02  chore(release): v2.0.31
- 5b7bfc0  2026-11-02  before i18n fix
- 5e5791c  2026-11-01  chore(release): v2.0.30
- 6f7a1b1  2026-11-01  chore(release): v2.0.29
- 1d8acd6  2026-11-01  chore(release): v2.0.28
- c30bae8  2026-11-01  chore(release): v2.0.27
- d7db1b1  2026-10-31  chore(release): v2.0.26
- 44c550b  2026-10-31  chore(release): v2.0.25
- 8984049  2026-10-31  chore(release): v2.0.24
- e62752a  2026-10-31  chore(release): v2.0.23

---

> Regenerate: `npm run context` or `.\scripts\context.ps1`
