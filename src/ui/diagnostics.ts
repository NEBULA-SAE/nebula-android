// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · DIAGNOSTICS
// Проверка: фронт + API + прокси + источники данных
// ═══════════════════════════════════════════════════════════════

import { esc } from '../utils';

const IS_DEV = (import.meta as any).env?.DEV;
const P = (name: string, real: string) => IS_DEV ? `/proxy/${name}` : real;

// ─── Что проверяем (фронт) ───

const REQUIRED_FUNCTIONS: Record<string, string[]> = {
  'I18N':    ['tm', 'isEN'],
  'Utils':   ['fmt', 'fmtP', 'setText', 'setHTML', 'esc', 'relTime', 'toast'],
  'Chart':   ['initChart', 'clearLines', 'clearOrderbookLines', 'drawOrderbookWalls'],
  'Whale':   ['calculateVolumeAnomalies', 'mergeWhaleMetrics', 'renderWhaleData'],
  'Oracle':  ['mobileAnalyze', 'renderPro', 'askAIMentor', 'openQuiz'],
  'Trading': ['openOrdersSheet', 'startMonitoring', 'stopMonitoring', 'mobileSyncPortfolio',
              'mobileAiCommand', 'mobileTwapStart'],
  'Security':['checkMasterPassword', 'showMasterPwdModal', 'hideMasterPwd', 'masterPwdSubmit'],
  'Scanner': ['runScanner', 'pickCoin', 'renderFavorites', 'toggleFavCurrent', 'initAutocomplete'],
  'UI':      ['switchTab', 'setLanguage', 'openMarketPulse', 'openLearning', 'loadBTC', 'openSheet', 'closeSheet'],
  'Terms':   ['acceptTerms', 'showAbout', 'hideAbout'],
};

const REQUIRED_DOM: string[] = [
  'ticker', 'ticker-suggest', 'star-btn', 'chart-container',
  'verdict', 'plan-card', 'agent-card', 'whale-card',
  'xray-card', 'walls-card', 'monitor-panel',
  'screen-home', 'screen-pro', 'screen-scanner',
  'screen-fav', 'screen-oracle', 'screen-portfolio',
  'sheet', 'sheet-overlay', 'sheet-title', 'sheet-body',
  'toast-wrap', 'terms-overlay', 'about-overlay', 'scan-list', 'fav-list',
  'ai-cmd-input', 'ai-deposit', 'ai-cmd-result',
  'dash-section', 'dash-network-content',
  'master-pwd-overlay', 'mp-input', 'mp-input2', 'mp-submit', 'mp-error',
];

interface DiagCheck {
  group: string;
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail?: string;
  ms?: number;
}

// ─── Утилита: ping ───

async function ping(
  url: string,
  validate?: (json: any) => boolean | string,
  timeoutMs = 5000
): Promise<{ ok: boolean; ms: number; detail: string }> {
  const t0 = performance.now();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const ms = Math.round(performance.now() - t0);
    if (!r.ok) return { ok: false, ms, detail: `HTTP ${r.status}` };
    if (!validate) return { ok: true, ms, detail: 'OK' };
    try {
      const j = await r.json();
      const v = validate(j);
      if (v === true) return { ok: true, ms, detail: 'OK' };
      if (typeof v === 'string') return { ok: false, ms, detail: v };
      return { ok: false, ms, detail: 'невалидный ответ' };
    } catch {
      return { ok: true, ms, detail: 'OK' };
    }
  } catch (e: any) {
    const ms = Math.round(performance.now() - t0);
    const msg = String(e?.message || e);
    return { ok: false, ms, detail: ms >= timeoutMs - 100 ? 'timeout' : msg };
  }
}

// ─── Фронт ───

function checkFrontendLibraries(): DiagCheck[] {
  const LW = (window as any).LightweightCharts;
  return [
    { group: 'Библиотеки', name: 'lightweight-charts', status: LW?.createChart ? 'ok' : 'error', detail: LW?.createChart ? 'загружен' : 'не загружен' },
    { group: 'Библиотеки', name: 'Web Worker', status: typeof Worker !== 'undefined' ? 'ok' : 'warn', detail: typeof Worker !== 'undefined' ? 'доступен' : 'не поддерживается' },
    { group: 'Библиотеки', name: 'Web Crypto', status: (typeof crypto !== 'undefined' && crypto.subtle) ? 'ok' : 'error', detail: (typeof crypto !== 'undefined' && crypto.subtle) ? 'AES-GCM доступен' : 'недоступен' },
    { group: 'Библиотеки', name: 'IndexedDB', status: typeof indexedDB !== 'undefined' ? 'ok' : 'warn', detail: typeof indexedDB !== 'undefined' ? 'доступна' : 'недоступна' },
  ];
}

function checkFrontendFunctions(): DiagCheck[] {
  const checks: DiagCheck[] = [];
  const w = window as any;
  for (const [group, fns] of Object.entries(REQUIRED_FUNCTIONS)) {
    const missing = fns.filter(fn => typeof w[fn] !== 'function');
    checks.push({
      group: 'Функции', name: group,
      status: missing.length === 0 ? 'ok' : 'error',
      detail: missing.length === 0
        ? `${fns.length} функций OK`
        : `Нет (${missing.length}): ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
    });
  }
  return checks;
}

function checkFrontendDOM(): DiagCheck[] {
  const missing = REQUIRED_DOM.filter(id => !document.getElementById(id));
  return [{
    group: 'DOM', name: 'Базовые элементы',
    status: missing.length === 0 ? 'ok' : 'warn',
    detail: missing.length === 0
      ? `Все ${REQUIRED_DOM.length} элементов`
      : `Нет (${missing.length}): ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
  }];
}

function checkStorage(): DiagCheck[] {
  try {
    localStorage.setItem('__diag_test', '1');
    const v = localStorage.getItem('__diag_test');
    localStorage.removeItem('__diag_test');
    return [{ group: 'Хранилище', name: 'localStorage', status: v === '1' ? 'ok' : 'error', detail: v === '1' ? 'round-trip OK' : 'не сохраняет' }];
  } catch (e: any) {
    return [{ group: 'Хранилище', name: 'localStorage', status: 'error', detail: String(e?.message || e) }];
  }
}

async function checkWorkerAlive(): Promise<DiagCheck[]> {
  const wCallFn = (window as any).wCall;
  if (typeof wCallFn !== 'function') {
    return [{ group: 'Web Worker', name: 'Ответ воркера', status: 'error', detail: 'wCall недоступна' }];
  }
  const t0 = performance.now();
  try {
    const result = await Promise.race([
      wCallFn('rsi', { closes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout 3s')), 3000)),
    ]);
    const ms = Math.round(performance.now() - t0);
    return [{ group: 'Web Worker', name: 'Ответ воркера', status: 'ok', detail: `RSI=${Math.round(Number(result))}`, ms }];
  } catch (e: any) {
    return [{ group: 'Web Worker', name: 'Ответ воркера', status: 'error', detail: String(e?.message || e) }];
  }
}

async function checkCryptoRoundtrip(): Promise<DiagCheck[]> {
  const encFn = (window as any).__nebulaEncryptTest;
  if (typeof encFn !== 'function') {
    const ok = typeof crypto !== 'undefined' && crypto.subtle;
    return [{ group: 'Крипто', name: 'Web Crypto API', status: ok ? 'ok' : 'error', detail: ok ? 'готов' : 'недоступен' }];
  }
  try {
    const t0 = performance.now();
    const ok = await encFn();
    const ms = Math.round(performance.now() - t0);
    return [{ group: 'Крипто', name: 'AES-GCM round-trip', status: ok ? 'ok' : 'error', detail: ok ? 'encrypt/decrypt OK' : 'fail', ms }];
  } catch (e: any) {
    return [{ group: 'Крипто', name: 'AES-GCM round-trip', status: 'error', detail: String(e?.message || e) }];
  }
}

// ─── Прокси ───

async function checkProxies(): Promise<DiagCheck[]> {
  const probes: [string, string, (j: any) => boolean | string][] = [
    ['/proxy/mexc',        `${P('mexc', 'https://api.mexc.com')}/api/v3/ping`, () => true],
    ['/proxy/okx',         `${P('okx', 'https://www.okx.com')}/api/v5/public/time`, (j) => j?.code === '0' || `code=${j?.code}`],
    ['/proxy/coinpaprika', `${P('coinpaprika', 'https://api.coinpaprika.com')}/v1/global`, (j) => !!j?.market_cap_usd || 'нет market_cap_usd'],
    ['/proxy/cbr',         `${P('cbr', 'https://www.cbr-xml-daily.ru')}/daily_json.js`, (j) => !!j?.Valute?.USD?.Value || 'нет USD'],
    ['/proxy/gateio',      `${P('gateio', 'https://api.gateio.ws')}/api/v4/spot/tickers?currency_pair=BTC_USDT`,
                           (j) => (Array.isArray(j) && j.length > 0) || 'нет данных'],
    ['/proxy/dashcentral', `${P('dashcentral', 'https://www.dashcentral.org')}/api/v1/public`,
                           (j) => !!j?.general?.consensus_masternodes || 'нет general.consensus_masternodes'],
  ];
  const results = await Promise.all(probes.map(async ([name, url, validate]) => {
    const r = await ping(url, validate, 5000);
    return { name, r };
  }));
  return results.map(({ name, r }) => ({
    group: 'Прокси', name,
    status: r.ok ? 'ok' : 'error',
    detail: r.detail, ms: r.ms,
  })) as DiagCheck[];
}

// ─── Биржи ───

async function checkExchanges(): Promise<DiagCheck[]> {
  const probes: [string, string, (j: any) => boolean | string][] = [
    ['gateio',  `${P('gateio', 'https://api.gateio.ws')}/api/v4/spot/currency_pairs/BTC_USDT`, (j) => !!j?.id || 'нет id'],
    ['binance', 'https://api.binance.com/api/v3/ping', () => true],
    ['okx',     `${P('okx', 'https://www.okx.com')}/api/v5/public/time`, (j) => j?.code === '0' || `code=${j?.code}`],
    ['bybit',   'https://api.bybit.com/v5/market/time', (j) => j?.retCode === 0 || `code=${j?.retCode}`],
    ['mexc',    `${P('mexc', 'https://api.mexc.com')}/api/v3/time`, (j) => !!j?.serverTime || 'нет serverTime'],
  ];
  const results = await Promise.all(probes.map(async ([name, url, validate]) => {
    const r = await ping(url, validate, 5000);
    return { name, r };
  }));
  return results.map(({ name, r }) => ({
    group: 'Биржи (свечи/стакан)',
    name,
    status: r.ok ? 'ok' : 'error',
    detail: r.detail, ms: r.ms,
  })) as DiagCheck[];
}

// ─── Whale futures ───

async function checkWhaleFutures(): Promise<DiagCheck[]> {
  const ticker = 'DASH';
  const probes: [string, string, (j: any) => boolean | string][] = [
    ['Bybit OI', `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${ticker}USDT&intervalTime=1h&limit=2`,
      (j) => (j?.retCode === 0 && j?.result?.list?.length > 0) || `code=${j?.retCode}`],
    ['Bybit LSR', `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${ticker}USDT&period=1h&limit=1`,
      (j) => (j?.retCode === 0 && j?.result?.list?.length > 0) || `code=${j?.retCode}`],
    ['OKX Taker', `${P('okx', 'https://www.okx.com')}/api/v5/rubik/stat/taker-volume-contract?instId=${ticker}-USDT-SWAP&period=1H`,
      (j) => (j?.code === '0' && j?.data?.length > 0) || `code=${j?.code}`],
    ['OKX Top LSR', `${P('okx', 'https://www.okx.com')}/api/v5/rubik/stat/contracts/long-short-account-ratio-contract-top-trader?instId=${ticker}-USDT-SWAP&period=1H`,
      (j) => (j?.code === '0' && j?.data?.length > 0) || `code=${j?.code}`],
  ];
  const results = await Promise.all(probes.map(async ([name, url, validate]) => {
    const r = await ping(url, validate, 5000);
    return { name, r };
  }));
  return results.map(({ name, r }) => ({
    group: 'Whale futures',
    name,
    status: r.ok ? 'ok' : 'warn',
    detail: r.detail, ms: r.ms,
  })) as DiagCheck[];
}

// ─── Funding ───

async function checkFunding(): Promise<DiagCheck[]> {
  const ticker = 'DASH';
  const probes: [string, string, (j: any) => boolean | string][] = [
    ['Bybit funding', `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${ticker}USDT`,
      (j) => (j?.retCode === 0 && j?.result?.list?.length > 0) || `code=${j?.retCode}`],
    ['OKX funding', `${P('okx', 'https://www.okx.com')}/api/v5/public/funding-rate?instId=${ticker}-USDT-SWAP`,
      (j) => (j?.code === '0' && j?.data?.length > 0) || `code=${j?.code}`],
  ];
  const results = await Promise.all(probes.map(async ([name, url, validate]) => {
    const r = await ping(url, validate, 5000);
    return { name, r };
  }));
  return results.map(({ name, r }) => ({
    group: 'Funding',
    name,
    status: r.ok ? 'ok' : 'warn',
    detail: r.detail, ms: r.ms,
  })) as DiagCheck[];
}

// ─── Market data ───

async function checkMarketData(): Promise<DiagCheck[]> {
  const probes: [string, string, (j: any) => boolean | string][] = [
    ['Coinpaprika global',
      `${P('coinpaprika', 'https://api.coinpaprika.com')}/v1/global`,
      (j) => !!j?.market_cap_usd || 'нет market_cap_usd'],
    ['Coinpaprika BTC',
      `${P('coinpaprika', 'https://api.coinpaprika.com')}/v1/tickers/btc-bitcoin`,
      (j) => !!j?.quotes?.USD?.price || 'нет BTC price'],
    ['Fear & Greed',
      `${P('fng', 'https://api.alternative.me')}/fng/?limit=1`,
      (j) => !!j?.data?.[0]?.value || 'нет F&G'],
    ['ЦБ РФ USD',
      `${P('cbr', 'https://www.cbr-xml-daily.ru')}/daily_json.js`,
      (j) => !!j?.Valute?.USD?.Value || 'нет USD'],
  ];
  const results = await Promise.all(probes.map(async ([name, url, validate]) => {
    const r = await ping(url, validate, 5000);
    return { name, r };
  }));
  return results.map(({ name, r }) => ({
    group: 'Market data',
    name,
    status: r.ok ? 'ok' : 'error',
    detail: r.detail, ms: r.ms,
  })) as DiagCheck[];
}

// ─── DASH сеть ───

async function checkDashNetwork(): Promise<DiagCheck[]> {
  const checks: DiagCheck[] = [];

  const probes: [string, string, (j: any) => boolean | string][] = [
    ['DashCentral',
      `${P('dashcentral', 'https://www.dashcentral.org')}/api/v1/public`,
      (j) => !!j?.general?.consensus_masternodes || 'нет masternodes'],
    ['Blockchair stats',
      `${P('blockchair', 'https://api.blockchair.com')}/dash/stats`,
      (j) => !!j?.data?.difficulty || 'нет difficulty'],
  ];
  const results = await Promise.all(probes.map(async ([name, url, validate]) => {
    const r = await ping(url, validate, 6000);
    return { name, r };
  }));
  for (const { name, r } of results) {
    checks.push({
      group: 'DASH сеть', name,
      status: r.ok ? 'ok' : 'warn',
      detail: r.detail, ms: r.ms,
    });
  }

  // ─── GetBlock + Allnodes fallback ───
  const GB_URL = IS_DEV
    ? '/proxy/gb-shared/2b1115df73384c3ca7a0839c9a1869d9/'
    : 'https://shared.eu-central-1.getblock.io/2b1115df73384c3ca7a0839c9a1869d9/';
  const ALL_URL = 'https://dash-rpc.publicnode.com';

  let gbOk = false;
  let gbDetail = 'оба endpoint недоступны';
  let gbMs = 0;

  for (const [label, url] of [['GetBlock', GB_URL], ['Allnodes', ALL_URL]] as const) {
    const t0 = performance.now();
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'masternode', params: ['count'], id: 'diag' }),
        signal: AbortSignal.timeout(6000),
      });
      const ms = Math.round(performance.now() - t0);
      const raw = await r.text();

      if (raw.trim().startsWith('<')) { gbDetail = `${label}: HTML`; gbMs = ms; continue; }
      if (!r.ok) { gbDetail = `${label}: HTTP ${r.status}`; gbMs = ms; continue; }

      const j = JSON.parse(raw);
      const total = j?.result?.total;
      if (total) {
        gbOk = true;
        gbDetail = `${label}: total=${total}`;
        gbMs = ms;
        break;
      }
    } catch (e: any) {
      gbDetail = `${label}: ${String(e?.message || e).slice(0, 50)}`;
      gbMs = Math.round(performance.now() - t0);
    }
  }

  checks.push({
    group: 'DASH сеть',
    name: 'GetBlock (masternodes)',
    status: gbOk ? 'ok' : 'warn',
    detail: gbDetail,
    ms: gbMs,
  });

  return checks;
}

// ─── Оркестратор ───

export interface DiagnosticsReport {
  overall: 'ok' | 'warn' | 'error';
  summary: { total: number; passed: number; warned: number; failed: number };
  checks: DiagCheck[];
  duration_ms: number;
}

export async function runFullDiagnostics(opts: { silent?: boolean } = {}): Promise<DiagnosticsReport> {
  const silent = !!opts.silent;
  if (!silent) showDiagnosticsModal(true);

  const all: DiagCheck[] = [];
  const t0 = performance.now();

  all.push(...checkFrontendLibraries());
  all.push(...checkFrontendFunctions());
  all.push(...checkFrontendDOM());
  all.push(...checkStorage());

  const [workerChecks, cryptoChecks, proxyChecks, exchangeChecks, whaleChecks, fundingChecks, marketChecks, dashChecks] =
    await Promise.all([
      checkWorkerAlive(), checkCryptoRoundtrip(), checkProxies(), checkExchanges(),
      checkWhaleFutures(), checkFunding(), checkMarketData(), checkDashNetwork(),
    ]);

  all.push(...workerChecks, ...cryptoChecks, ...proxyChecks, ...exchangeChecks);
  all.push(...whaleChecks, ...fundingChecks, ...marketChecks, ...dashChecks);

  const passed = all.filter(c => c.status === 'ok').length;
  const warned = all.filter(c => c.status === 'warn').length;
  const failed = all.filter(c => c.status === 'error').length;
  const overall: DiagnosticsReport['overall'] =
    failed === 0 && warned === 0 ? 'ok' : (failed === 0 ? 'warn' : 'error');

  const report: DiagnosticsReport = {
    overall,
    summary: { total: all.length, passed, warned, failed },
    checks: all,
    duration_ms: Math.round(performance.now() - t0),
  };

  if (!silent) renderDiagnosticsReport(report);
  return report;
}

// ─── UI ───

function groupChecks(checks: DiagCheck[]): Record<string, DiagCheck[]> {
  const groups: Record<string, DiagCheck[]> = {};
  for (const c of checks) {
    if (!groups[c.group]) groups[c.group] = [];
    groups[c.group].push(c);
  }
  return groups;
}

function renderDiagnosticsReport(report: DiagnosticsReport): void {
  const body = document.getElementById('diag-body');
  if (!body) return;

  const statusText = {
    ok:    { label: 'Всё работает' },
    warn:  { label: 'Есть предупреждения' },
    error: { label: 'Есть ошибки' },
  }[report.overall];

  const groups = groupChecks(report.checks);
  let html = `
    <div class="diag-summary diag-${report.overall}">
      <div class="diag-summary-row">
        <span class="diag-total">${report.summary.passed}<small>/ ${report.summary.total}</small></span>
        <span class="diag-label">${statusText.label}</span>
      </div>
      <div class="diag-counters">
        <span class="diag-cnt diag-ok">✅ ${report.summary.passed}</span>
        <span class="diag-cnt diag-warn">⚠️ ${report.summary.warned}</span>
        <span class="diag-cnt diag-err">❌ ${report.summary.failed}</span>
        <span class="diag-ms">${report.duration_ms} мс</span>
      </div>
    </div>
  `;

  for (const [group, items] of Object.entries(groups)) {
    html += `<div class="diag-group"><div class="diag-group-title">${esc(group)}</div>`;
    for (const c of items) {
      const icon = c.status === 'ok' ? '✅' : c.status === 'warn' ? '⚠️' : '❌';
      const ms = c.ms ? `<span class="diag-ms-item">${c.ms}мс</span>` : '';
      html += `
        <div class="diag-row diag-row-${c.status}">
          <span class="diag-icon">${icon}</span>
          <div class="diag-content">
            <div class="diag-name">${esc(c.name)} ${ms}</div>
            ${c.detail ? `<div class="diag-detail">${esc(c.detail)}</div>` : ''}
          </div>
        </div>`;
    }
    html += `</div>`;
  }

  html += `<button class="btn-primary btn-mint" onclick="runFullDiagnostics()" style="margin-top:16px">
    ↻ Запустить заново
  </button>`;

  body.innerHTML = html;
}

export function showDiagnosticsModal(loading = false): void {
  const ov = document.getElementById('diag-overlay');
  if (ov) ov.classList.add('open');

  if (loading) {
    const body = document.getElementById('diag-body');
    if (body) {
      body.innerHTML = `
        <div class="diag-loading">
          <div class="loader">Проверяю все компоненты…</div>
          <div style="text-align:center;color:var(--mut);font-size:11px;margin-top:8px;">
            Биржи, прокси, API — параллельно, до 5 секунд
          </div>
        </div>`;
    }
  }
}

export function closeDiagnostics(): void {
  const ov = document.getElementById('diag-overlay');
  if (ov) ov.classList.remove('open');
}

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    runFullDiagnostics,
    showDiagnosticsModal,
    closeDiagnostics,
    openDiagnostics: () => runFullDiagnostics(),
  });
}