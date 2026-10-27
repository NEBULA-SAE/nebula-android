// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · ORACLE (UI)
// Анализ монеты + RenderPro + AI Mentor + Dashboard + Quiz + AI Settings
// ═══════════════════════════════════════════════════════════════

import { tm, isEN } from '../i18n';
import { state, fmt, fmtP, setText, setHTML, esc, toast, relTime } from '../utils';
import { wCall } from '../worker';
import { initChart, clearLines, drawNowLine, setCandlesAndFit } from '../chart';
import { fetchCandlesWithSource } from '../sources/candles';
import { getWhaleFuturesMetrics } from '../sources/whale-futures';
import { getAdvancedAnalytics } from '../market';
import type { AdvancedAnalytics } from '../market';
import { getConfluence } from '../sources/confluence';
import type { ConfluenceResult } from '../sources/confluence';
import {
  oracleAnalyze as engineOracleAnalyze,
  loadRiskProfile,
  computeRiskProfile,
  saveRiskProfile,
  oracleGetStats,
  oracleGetRecent,
  oracleUpdateOutcomes,
  oracleLearnPatterns,
} from '../oracle';
import { getAiMentor } from '../ai';
import {
  calculateVolumeAnomalies,
  mergeWhaleMetrics,
  renderWhaleData,
  fetchExtras,
} from './whale';

// ═══ ОСНОВНОЙ АНАЛИЗ ═══

export async function mobileAnalyze(): Promise<void> {
  // Смотрим, откуда брать тикер: из демо-режима или из главного
  const inputId = state.isDemoMode ? 'demo-ticker' : 'ticker';
  const tickerInput = document.getElementById(inputId) as HTMLInputElement | null;
  
  const raw = (tickerInput?.value || '').toUpperCase().trim();
  if (!raw) return;

  // Синхронизируем оба инпута
  state.currentTicker = raw;
  const mainInp = document.getElementById('ticker') as HTMLInputElement | null;
  if (mainInp) mainInp.value = raw;

  state.lastOracleResult = null;
  state.lastMarketData = null;

  const hint = document.getElementById('oracle-ticker-hint');
  if (hint) hint.textContent = raw;
  document.getElementById('ticker-suggest')?.classList.remove('open');
  document.getElementById('demo-ticker-suggest')?.classList.remove('open');

  // Скрываем старую карточку Confluence до прихода новых данных
  const confCard = document.getElementById('confluence-card');
  if (confCard) confCard.style.display = 'none';

  try {
    // ── Параллельный старт: candles + futures + extras ──
    const tf = ((state as any).currentTimeframe || '1d') as import('../sources/candles').Timeframe;
    const [candlesResult, futuresMetrics] = await Promise.all([
      fetchCandlesWithSource(raw, tf),
      getWhaleFuturesMetrics(raw).catch(() => null),
    ]);

    // Сохраняем для Risk Center
    (state as any).lastFuturesMetrics = futuresMetrics;

    // fetchExtras — параллельно, не блокирует рендер
    const extrasPromise = fetchExtras(raw);

    const candles = candlesResult.data;
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    const min120 = Math.min(...lows);
    const max120 = Math.max(...highs);
    const price = closes[closes.length - 1];

    const rsiVal = await Promise.race([
      wCall('rsi', { closes }),
      new Promise<number>((_, rej) => setTimeout(() => rej(new Error('rsi timeout')), 5000)),
    ]).catch(() => 50);
    
    const rebound = ((price - min120) / min120) * 100;
    const drop = ((max120 - price) / max120) * 100;

    let status: 'green' | 'yellow' | 'red' = 'yellow';
    if (rsiVal > 65 || rebound > 60) status = 'red';
    else if (rsiVal < 45 && rebound < 30 && drop > 40) status = 'green';

    // ─── ИНДИКАТОР ЗАГРУЗКИ: начальная загрузка ───
    const vd = document.getElementById('verdict');
    if (vd) {
      vd.style.display = 'block';
      vd.className = 'verdict loading';
      setText('verdict-title', `${raw} · ${tm('loading')}`);
      setHTML('verdict-text', `<span style="color:var(--dim);">⏳ ${tm('loading')}…</span>`);
    }
    const whaleCard = document.getElementById('whale-card');
    if (whaleCard) {
      whaleCard.style.display = 'block';
      const content = whaleCard.querySelector('.empty-msg');
      if (content) {
        content.innerHTML = `<span style="color:var(--dim);">⏳ ${tm('loading')}…</span>`;
      }
    }
    // Pro‑section: показать состояние загрузки до прихода advanced analytics
    const proTarget = document.getElementById('pro-content');
    if (proTarget) {
      proTarget.innerHTML = `<div class="empty-msg" style="padding:20px 0;">${tm('loading')}…</div>`;
    }

    // ─── График (использует setCandlesAndFit из chart.ts) ───
    if (!state.chart) initChart();
    clearLines();
    setCandlesAndFit(candles as any);
    drawNowLine(price);

    setHTML('chart-stats',
      `<span>${tm('min')}: <b>${fmt(min120)}</b></span>` +
      `<span class="cur">${tm('cur')}: <b>${fmt(price)}</b></span>` +
      `<span>${tm('max')}: <b>${fmt(max120)}</b></span>`);

    // Временно заполняем verdict данными свечей
    if (vd) {
      vd.className = 'verdict ' + status;
      setText('verdict-title', `${raw}`);
      setHTML('verdict-text', `RSI: <b style="color:#fff">${rsiVal.toFixed(1)}</b> · ${tm('rebound')}: <b style="color:#fff">+${rebound.toFixed(1)}%</b><br>${status === 'green' ? tm('acc_text') : status === 'red' ? tm('sell_text') : tm('flat_text')}`);
    }

    const planCard = document.getElementById('plan-card');
    if (planCard) {
      if (status === 'red') {
        planCard.style.display = 'none';
      } else {
        planCard.style.display = 'block';
        const tr = max120 - price, dr = price - min120;
        const p = {
          entry: price,
          buy1: price,
          buy2: price - dr * 0.4,
          buy3: min120 * 1.01,
          tp1: price + tr * 0.3,
          tp2: price + tr * 0.6,
          tp3: max120 * 0.98,
          stop: min120 * 0.92,
        };
        
        // ⚠️ СОХРАНЯЕМ ПЛАН ДЛЯ ДЕМО-РЕЖИМА
        (window as any)._currentDemoPlan = p;

        setHTML('plan-content', `
          <div><div class="plan-lbl">🔵 ${tm('entry')}</div>
            <div class="plan-entry">1: ${fmt(p.buy1)}</div>
            <div class="plan-entry">2: ${fmt(p.buy2)}</div>
            <div class="plan-entry">3: ${fmt(p.buy3)}</div>
            <span class="plan-stop">🛑 ${tm('stop')}: ${fmt(p.stop)}</span>
          </div>
          <div><div class="plan-lbl">🟢 ${tm('targets')}</div>
            <div class="plan-tp">TP1: ${fmt(p.tp1)}</div>
            <div class="plan-tp">TP2: ${fmt(p.tp2)}</div>
            <div class="plan-tp">TP3: ${fmt(p.tp3)}</div>
          </div>`);
      }
    }

    const agentCard = document.getElementById('agent-card');
    if (agentCard) {
      agentCard.style.display = 'block';
      let aCls = 'yellow', aTitle = '', aText = '';
      if (status === 'green') { aCls = 'green'; aTitle = '✅ ' + tm('agent_perfect'); aText = tm('agent_perfect_text'); }
      else if (status === 'red') { aCls = 'red'; aTitle = '🚫 ' + tm('agent_forbid'); aText = tm('agent_forbid_text'); }
      else { aCls = 'yellow'; aTitle = '⚖️ ' + tm('agent_watch'); aText = tm('agent_watch_text'); }
      setHTML('agent-content', `
        <div class="agent-title ${aCls}">${aTitle}</div>
        <div class="agent-text">${aText}</div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px dashed rgba(255,255,255,.08);">
          <button onclick="askAIMentor()" class="btn-primary btn-violet" style="margin:0;font-size:11px;">${tm('ask_ai_short')}</button>
          <div id="ai-result" style="margin-top:12px;"></div>
        </div>
      `);
    }

    const whaleSpot = calculateVolumeAnomalies(candles);
    const hasFutures = !!(futuresMetrics && (futuresMetrics as any).sources?.length);
    const merged = mergeWhaleMetrics(whaleSpot, hasFutures ? (futuresMetrics as any) : null, price);
    state.lastWhaleData = merged;
    renderWhaleData(merged);

    // Ждем прихода fetchExtras (funding + orderbook) — он сам отрисует xray/walls
    extrasPromise.catch(() => { /* silent */ });

    const marketData = {
      current_price: price,
      rsi: rsiVal,
      rebound_pct: rebound,
      drop_pct: drop,
      min_120: min120,
      max_120: max120,
      whale_active: merged ? merged.isWhaleActive : false,
      whale_trend: merged ? merged.obvTrend : '',
      whale_score: merged ? merged.score : 0,
      whale_pressure: merged ? merged.pressure : 'neutral',
      funding_rate: 0,
      bids_pct: 50,
    };
    state.lastMarketData = marketData;

    const profile = loadRiskProfile();
    const [oracleResult, adv] = await Promise.all([
      engineOracleAnalyze(raw, marketData, {}, profile),
      getAdvancedAnalytics(raw),
    ]);

    if (oracleResult.status === 'success') {
      const vd2 = document.getElementById('verdict');
      if (vd2 && oracleResult.verdict_text) {
        const oldOracle = vd2.querySelector('.oracle-line');
        if (oldOracle) oldOracle.remove();
        const oracleDiv = document.createElement('div');
        oracleDiv.className = 'oracle-line';
        oracleDiv.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px dashed rgba(255,255,255,.06);font-size:12px;color:var(--cyan);';
        oracleDiv.textContent = `🔮 ${oracleResult.verdict_text} · ${oracleResult.confidence}%`;
        vd2.appendChild(oracleDiv);
      }
      state.lastOracleResult = oracleResult;

      // Для Risk Center — контекст рынка (Fear & Greed, regime)
      if (oracleResult.market_context) {
        (state as any).lastMarketContext = {
          fear_greed: oracleResult.market_context.fear_greed,
          fear_greed_text: oracleResult.market_context.desc,
          regime: oracleResult.market_context.regime,
        };
      }
    }

    if (adv.status === 'success') {
      state.lastAdv = adv;
      // Show pro content immediately (advanced analytics loaded quickly)
      renderPro(adv);
    } else {
      setHTML('pro-content', `<div class="empty-msg">${tm('error')}: ${adv.message || 'no data'}</div>`);
    }

    if ((state.currentTicker || '').toUpperCase() === 'DASH') {
      setTimeout(async () => {
        try {
          const { renderDashNetwork } = await import('./dash');
          renderDashNetwork();
        } catch { /* silent */ }
      }, 100);
    } else {
      const ds = document.getElementById('dash-section');
      if (ds) ds.style.display = 'none';
    }

    // ═══ Multi-TF Confluence (не блокируем основной рендер) ═══
    getConfluence(raw).then(conf => {
      if (state.currentTicker === raw) {
        renderConfluence(conf);
      }
    }).catch(() => { /* silent */ });

    // ⚠️ ОБНОВЛЕНИЕ ДЕМО-РЕЖИМА: если мы в песочнице, перерисовываем её
    if (state.isDemoMode) {
      import('./screens').then(m => m.renderDemoPlan());
    }

  } catch (e: any) {
    toast(tm('error') + ': ' + e.message, 'error');
  }
}

// ═══ RENDER PRO ═══

export function renderPro(adv: AdvancedAnalytics): void {
  const target = document.getElementById('pro-content');
  if (!target) return;
  const en = isEN();

  if (!adv || adv.status !== 'success') {
    target.innerHTML = `<div class="empty-msg">${tm('pro_hint')}</div>`;
    return;
  }

  const m = adv.macd, b = adv.bollinger, a = adv.adx, s = adv.stoch_rsi, d = adv.divergence;
  const sr = adv.support_resistance;
  const vp = adv.volume_profile;
  const price = adv.price;

  let macdBig: string, macdCls: string, macdExp: string;
  if (m.crossover === 'bullish') { macdBig = en ? '📈 Price wants up' : '📈 Цена хочет вверх'; macdCls = 'good'; macdExp = en ? 'Buyers stronger.' : 'Покупатели сильнее.'; }
  else if (m.crossover === 'bearish') { macdBig = en ? '📉 Price wants down' : '📉 Цена хочет вниз'; macdCls = 'bad'; macdExp = en ? 'Sellers push.' : 'Продавцы давят.'; }
  else { macdBig = en ? '⚖️ Unclear' : '⚖️ Пока непонятно'; macdCls = 'mid'; macdExp = en ? 'Balanced.' : 'Силы равны.'; }

  let bbBig: string, bbCls: string, bbExp: string;
  if (b.state === 'oversold') { bbBig = en ? '💎 Coin is cheap' : '💎 Монета дешёвая'; bbCls = 'good'; bbExp = en ? 'Lower band. Buy zone.' : 'Нижняя граница. Зона покупки.'; }
  else if (b.state === 'overbought') { bbBig = en ? '🔥 Coin is expensive' : '🔥 Монета дорогая'; bbCls = 'bad'; bbExp = en ? 'Upper band. Careful.' : 'Верхняя граница. Осторожно.'; }
  else { bbBig = en ? '⚖️ Normal price' : '⚖️ Нормальная цена'; bbCls = 'mid'; bbExp = en ? 'Middle of channel.' : 'Цена в середине канала.'; }

  let adxBig: string, adxCls: string, adxExp: string;
  const ts = a.trend_strength;
  if (ts === 'very_strong') { adxBig = en ? '🔥 Very strong trend' : '🔥 Очень сильный тренд'; adxCls = 'bad'; adxExp = en ? 'Do NOT trade against!' : 'Не входи против тренда!'; }
  else if (ts === 'strong') { adxBig = en ? '💪 Confident trend' : '💪 Уверенный тренд'; adxCls = 'mid'; adxExp = en ? 'Trade with trend.' : 'Работаем по тренду.'; }
  else if (ts === 'weak') { adxBig = en ? '🌊 Weak trend' : '🌊 Слабый тренд'; adxCls = 'mid'; adxExp = en ? 'Reversal may come.' : 'Возможен разворот.'; }
  else { adxBig = en ? '😴 Flat' : '😴 Флэт'; adxCls = 'flat'; adxExp = en ? 'Price stands still.' : 'Цена стоит.'; }

  let stochBig: string, stochCls: string, stochExp: string;
  if (s.state === 'oversold') { stochBig = en ? '🟢 Oversold' : '🟢 Перепродан'; stochCls = 'good'; stochExp = en ? 'Good time to buy.' : 'Хорошее время купить.'; }
  else if (s.state === 'overbought') { stochBig = en ? '🔴 Overbought' : '🔴 Перекуплен'; stochCls = 'bad'; stochExp = en ? 'Reversal down possible.' : 'Возможен разворот вниз.'; }
  else { stochBig = en ? '⚖️ Normal' : '⚖️ Норма'; stochCls = 'mid'; stochExp = en ? 'No signal.' : 'Сигнала нет.'; }

  let divHtml: string;
  if (d.type === 'bullish') divHtml = `<div class="div-main bull"><div class="div-icon">🐂</div><div><div class="div-title" style="color:var(--mint)">${en ? 'Expect growth 🚀' : 'Жди рост 🚀'}</div><div class="div-desc">${en ? 'Hidden bullish signal.' : 'Скрытый бычий сигнал.'}</div></div></div>`;
  else if (d.type === 'bearish') divHtml = `<div class="div-main bear"><div class="div-icon">🐻</div><div><div class="div-title" style="color:var(--coral)">${en ? 'Expect drop 📉' : 'Жди падение 📉'}</div><div class="div-desc">${en ? 'Hidden bearish signal.' : 'Скрытый медвежий сигнал.'}</div></div></div>`;
  else divHtml = `<div class="div-main"><div class="div-icon">—</div><div><div class="div-title">${en ? 'None yet' : 'Пока нет'}</div><div class="div-desc">${en ? 'Consistent.' : 'Согласованы.'}</div></div></div>`;

  let srHtml = '';
  if (sr.resistance?.length) {
    srHtml += `<div class="sr-head">🔴 ${en ? 'Expensive (sell)' : 'Где дорого'}</div>`;
    sr.resistance.slice().reverse().forEach((r, i) => {
      const dist = ((r - price) / price) * 100;
      srHtml += `<div class="sr-item res"><span class="sr-lbl">${en ? 'R' : 'Ур.'} ${sr.resistance.length - i}</span><span><span class="sr-val">${fmtP(r)}</span><span class="sr-pct">+${dist.toFixed(1)}%</span></span></div>`;
    });
  }
  srHtml += `<div class="sr-head">💠 ${en ? 'Price now' : 'Цена сейчас'}</div><div class="sr-item poc"><span class="sr-lbl">◉</span><span class="sr-val">${fmtP(price)}</span></div>`;
  if (sr.support?.length) {
    srHtml += `<div class="sr-head">🟢 ${en ? 'Cheap (buy)' : 'Где дёшево'}</div>`;
    sr.support.forEach((sup, i) => {
      const dist = ((price - sup) / price) * 100;
      srHtml += `<div class="sr-item sup"><span class="sr-lbl">${en ? 'S' : 'Ур.'} ${i + 1}</span><span><span class="sr-val">${fmtP(sup)}</span><span class="sr-pct">-${dist.toFixed(1)}%</span></span></div>`;
    });
  }

  let vpHtml = '';
  if (vp.poc) {
    let pos = '—';
    if (price >= vp.va_low && price <= vp.va_high) {
      const nearPoc = Math.abs(price - vp.poc) / vp.poc < 0.02;
      pos = nearPoc ? (en ? 'at POC 🎯' : 'у POC 🎯') : (en ? 'in zone' : 'в зоне');
    } else if (price > vp.va_high) pos = en ? 'high ⚠️' : 'высоко ⚠️';
    else pos = en ? 'low 💎' : 'низко 💎';
    vpHtml = `
      <div class="vp-grid">
        <div class="vp-cell poc"><div class="vp-lbl">POC</div><div class="vp-val">${fmtP(vp.poc)}</div></div>
        <div class="vp-cell"><div class="vp-lbl">${en ? 'Zone' : 'Зона'}</div><div class="vp-val">${fmtP(vp.va_low)} — ${fmtP(vp.va_high)}</div></div>
        <div class="vp-cell"><div class="vp-lbl">${en ? 'Now' : 'Сейчас'}</div><div class="vp-val">${pos}</div></div>
      </div>`;
  }

  target.innerHTML = `
    <div class="card" style="border-color:rgba(94,203,255,.25)">
      <div class="card-head" style="color:var(--cyan)">${tm('pro_macd')}</div>
      <div class="card-body">
        <div class="pro-big ${macdCls}">${macdBig}</div>
        <div class="pro-explain">${macdExp}</div>
        <div class="pro-nums">
          <div class="pro-num-cell"><div class="pro-num-lbl">Line</div><div class="pro-num-val">${m.line.toFixed(5)}</div></div>
          <div class="pro-num-cell"><div class="pro-num-lbl">Signal</div><div class="pro-num-val">${m.signal.toFixed(5)}</div></div>
          <div class="pro-num-cell"><div class="pro-num-lbl">${en ? 'Diff' : 'Разница'}</div><div class="pro-num-val" style="color:${m.histogram >= 0 ? 'var(--mint)' : 'var(--coral)'}">${m.histogram >= 0 ? '+' : ''}${m.histogram.toFixed(5)}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="border-color:rgba(167,139,250,.25)">
      <div class="card-head" style="color:var(--violet)">${tm('pro_bb')}</div>
      <div class="card-body">
        <div class="pro-big ${bbCls}">${bbBig}</div>
        <div class="pro-explain">${bbExp}</div>
        <div class="pro-nums">
          <div class="pro-num-cell"><div class="pro-num-lbl">Upper</div><div class="pro-num-val">${fmtP(b.upper)}</div></div>
          <div class="pro-num-cell"><div class="pro-num-lbl">${en ? 'Mid' : 'Центр'}</div><div class="pro-num-val">${fmtP(b.middle)}</div></div>
          <div class="pro-num-cell"><div class="pro-num-lbl">Lower</div><div class="pro-num-val">${fmtP(b.lower)}</div></div>
        </div>
      </div>
    </div>
    <div class="card" style="border-color:rgba(255,184,88,.25)">
      <div class="card-head" style="color:var(--amber)">${tm('pro_adx')}</div>
      <div class="card-body">
        <div class="pro-big ${adxCls}">${adxBig}</div>
        <div class="pro-explain">${adxExp}</div>
        <div class="scale-track">
          <div class="scale-seg weak">${en ? 'Weak' : 'Слаб'}</div>
          <div class="scale-seg normal">${en ? 'Mid' : 'Сред'}</div>
          <div class="scale-seg strong">${en ? 'Strong' : 'Сил'}</div>
          <div class="scale-seg vstrong">${en ? 'Very' : 'Очень'}</div>
          <div class="scale-ptr" style="left:${Math.min(98, Math.max(2, (a.value / 60) * 100))}%"></div>
        </div>
      </div>
    </div>
    <div class="card" style="border-color:rgba(255,140,74,.25)">
      <div class="card-head" style="color:var(--fire)">${tm('pro_stoch')}</div>
      <div class="card-body">
        <div class="pro-big ${stochCls}">${stochBig}</div>
        <div class="pro-explain">${stochExp}</div>
        <div class="scale-track">
          <div class="scale-seg overs">${en ? 'Cheap' : 'Дёшево'}</div>
          <div class="scale-seg neut">${en ? 'Normal' : 'Норма'}</div>
          <div class="scale-seg overb">${en ? 'Expensive' : 'Дорого'}</div>
          <div class="scale-ptr" style="left:${Math.min(98, Math.max(2, s.value))}%"></div>
        </div>
      </div>
    </div>
    <div class="card" style="border-color:rgba(255,101,132,.25)">
      <div class="card-head" style="color:var(--coral)">${tm('pro_div')}</div>
      <div class="card-body">${divHtml}</div>
    </div>
    <div class="card" style="border-color:rgba(69,224,168,.25)">
      <div class="card-head" style="color:var(--mint)">${tm('pro_sr')}</div>
      <div class="card-body"><div class="sr-list">${srHtml}</div></div>
    </div>
    <div class="card" style="border-color:rgba(78,143,255,.25)">
      <div class="card-head" style="color:var(--accent-hi)">${tm('pro_vp')}</div>
      <div class="card-body">${vpHtml || `<div class="empty-msg">${en ? 'No data' : 'Нет данных'}</div>`}</div>
    </div>
  `;
}

// ═══ MULTI-TF CONFLUENCE RENDERER ═══

export function renderConfluence(result: ConfluenceResult): void {
  const card = document.getElementById('confluence-card');
  const content = document.getElementById('confluence-content');
  const badge = document.getElementById('confluence-badge');
  if (!card || !content) return;

  if (result.status !== 'success' || result.overall === 'no_data') {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  if (badge) {
    const labels: Record<string, string> = {
      strong_buy: '🟢 STRONG BUY',
      buy: '🟢 BUY',
      hold: '🟡 HOLD',
      avoid: '🔴 AVOID',
      no_data: '—',
    };
    badge.textContent = labels[result.overall] || '—';
    badge.style.color =
      result.overall === 'strong_buy' || result.overall === 'buy' ? 'var(--mint)' :
      result.overall === 'avoid' ? 'var(--coral)' : 'var(--amber)';
  }

  const tfHtml = result.signals.map(s => {
    const color = !s.ok ? 'var(--dim)' :
      s.verdict === 'buy' ? 'var(--mint)' :
      s.verdict === 'avoid' ? 'var(--coral)' : 'var(--amber)';
    const icon = !s.ok ? '—' :
      s.verdict === 'buy' ? '✅' :
      s.verdict === 'avoid' ? '❌' : '⚖️';
    return `
      <div class="conf-tf" style="border-color:${s.ok ? color : 'var(--border)'}">
        <div class="conf-tf-label">${s.tf.toUpperCase()}</div>
        <div class="conf-tf-rsi" style="color:${color}">RSI ${s.rsi.toFixed(0)}</div>
        <div class="conf-tf-verdict" style="color:${color}">${icon}</div>
      </div>`;
  }).join('');

  content.innerHTML = `
    <div class="conf-grid">${tfHtml}</div>
    <div class="conf-summary">
      <div class="conf-summary-text">
        ${result.buyCount}/${result.totalCount} buy · ${tm('journal_confidence')} <b>${result.confidence}%</b>
      </div>
      <div class="conf-bar">
        <div class="conf-fill" style="width:${result.confidence}%"></div>
      </div>
    </div>
  `;
}

// ═══ AI MENTOR ═══

export async function askAIMentor(): Promise<void> {
  if (!state.currentTicker) { toast(tm('enter_ticker'), 'warn'); return; }

  const resultBox = document.getElementById('ai-result');
  if (!resultBox) return;

  const marketData = state.lastMarketData;
  const oracleResult = state.lastOracleResult;
  if (!marketData || !oracleResult) {
    resultBox.innerHTML = `<div class="empty-msg" style="padding:8px 0;">${tm('ai_need_analysis')}</div>`;
    return;
  }

  resultBox.innerHTML = `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mut);padding:8px 0;">${tm('ai_thinking')}</div>`;

  const result = await getAiMentor(
    state.currentTicker,
    marketData,
    oracleResult.verdict,
    oracleResult.reasons || [],
    oracleResult.warnings || [],
    loadRiskProfile(),
    state.lastAdv || {},
    oracleResult.market_context || {}
  );

  if (result.status === 'success') {
    const text = (result.advice || '')
      .replace(/\*\*(.*?)\*\*/g, '<b style="color:var(--hi);">$1</b>')
      .replace(/\n/g, '<br>');
    resultBox.innerHTML = `<div style="font-size:13.5px;line-height:1.7;color:var(--tx);">${text}</div>`;
  } else if (result.message === 'no_key') {
    toast(tm('ai_no_key'), 'warn', 3500);
    resultBox.innerHTML = `<div class="empty-msg" style="padding:8px 0;">${tm('ai_no_key')}</div>`;
  } else {
    resultBox.innerHTML = `<div class="empty-msg" style="padding:8px 0;">${tm('error')}: ${esc(result.message || 'unknown')}</div>`;
  }
}

// ═══ AI SETTINGS (кнопка шестерёнки в топбаре) ═══

export function openAISettings(): void {
  const html = `
    <div class="form-row">
      <label class="form-lbl">${tm('ai_key_label')}</label>
      <input class="form-input" type="password" id="groq-key-input" placeholder="gsk_...">
      <div style="font-size:11px;color:var(--mut);margin-top:6px">${tm('ai_key_hint')}</div>
    </div>
    <button class="btn-primary btn-mint" onclick="saveGroqKeyFromModal()">${tm('ai_save')}</button>
    <button class="btn-primary btn-coral" onclick="deleteGroqKeyFromModal()" style="margin-top:8px">${tm('ai_delete')}</button>`;

  (window as any).openSheet?.(tm('ai_settings'), html);

  import('../crypto').then(async (m) => {
    const key = await m.loadGroqKey();
    const inp = document.getElementById('groq-key-input') as HTMLInputElement | null;
    if (inp) inp.value = key || '';
  }).catch(() => {});
}

export function saveGroqKeyFromModal(): void {
  const inp = document.getElementById('groq-key-input') as HTMLInputElement | null;
  const key = (inp?.value || '').trim();
  if (!key) return;

  import('../crypto').then(async (m) => {
    await m.saveGroqKey(key);
    toast(tm('ai_key_saved'), 'success');
    (window as any).closeSheet?.();
  });
}

export function deleteGroqKeyFromModal(): void {
  import('../crypto').then((m) => {
    m.deleteGroqKey();
    toast(tm('ai_key_deleted'), 'info');
    (window as any).closeSheet?.();
  });
}

// ═══ ORACLE DASHBOARD ═══

export async function renderOracleDashboard(): Promise<void> {
  const en = isEN();

  const prof = document.getElementById('oracle-profile-content');
  if (prof) {
    const rp = loadRiskProfile();
    if (!rp) {
      prof.innerHTML = `<div class="empty-msg" style="padding:20px 10px;">${tm('profile_not_set')}<br><span style="font-size:10.5px;color:var(--dim);margin-top:8px;display:block;">${tm('profile_not_set_hint')}</span></div>`;
    } else {
      const levelNames: Record<string, string> = {
        conservative: en ? '🛡️ Conservative' : '🛡️ Консервативный',
        balanced: en ? '⚖️ Balanced' : '⚖️ Сбалансированный',
        aggressive: en ? '🔥 Aggressive' : '🔥 Агрессивный',
      };
      prof.innerHTML = `
        <div class="oracle-profile-grid">
          <div class="oracle-profile-cell" style="grid-column:1/-1">
            <div class="oracle-profile-lbl">${tm('level')}</div>
            <div class="oracle-profile-val violet">${levelNames[rp.level] || rp.level}</div>
          </div>
          <div class="oracle-profile-cell">
            <div class="oracle-profile-lbl">${tm('risk_per_trade')}</div>
            <div class="oracle-profile-val mint">${rp.max_risk_per_trade}%</div>
          </div>
          <div class="oracle-profile-cell">
            <div class="oracle-profile-lbl">${tm('pos_size')}</div>
            <div class="oracle-profile-val cyan">${rp.max_position_size}%</div>
          </div>
        </div>`;
    }
  }

  try {
    const st = oracleGetStats();
    const stats = document.getElementById('oracle-stats-content');
    if (stats) {
      stats.innerHTML = `
        <div class="oracle-stats-grid">
          <div class="oracle-stat-cell">
            <div class="oracle-stat-lbl">${tm('completed')}</div>
            <div class="oracle-stat-val">${st.completed_analyses}</div>
          </div>
          <div class="oracle-stat-cell">
            <div class="oracle-stat-lbl">${tm('win_rate')}</div>
            <div class="oracle-stat-val mint">${st.win_rate}%</div>
          </div>
          <div class="oracle-stat-cell">
            <div class="oracle-stat-lbl">${tm('patterns')}</div>
            <div class="oracle-stat-val cyan">${st.patterns_count}</div>
          </div>
          <div class="oracle-stat-cell">
            <div class="oracle-stat-lbl">${tm('profit_factor')}</div>
            <div class="oracle-stat-val amber">${st.profit_factor.toFixed(2)}</div>
          </div>
          <div class="oracle-stat-cell">
            <div class="oracle-stat-lbl">Win</div>
            <div class="oracle-stat-val mint">+${st.avg_win_pct.toFixed(1)}%</div>
          </div>
          <div class="oracle-stat-cell">
            <div class="oracle-stat-lbl">Loss</div>
            <div class="oracle-stat-val" style="color:var(--coral)">${st.avg_loss_pct.toFixed(1)}%</div>
          </div>
        </div>
        <div style="text-align:center;margin-top:10px;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--dim)">
          ${st.days_learning.toFixed(1)} ${tm('days')} · ${st.pending_outcomes} ${tm('pending')}
        </div>`;
    }
  } catch {
    const stats = document.getElementById('oracle-stats-content');
    if (stats) stats.innerHTML = `<div class="empty-msg">${tm('error')}</div>`;
  }

  try {
    const rc = oracleGetRecent(5);
    const list = document.getElementById('oracle-recent-content');
    if (!list) return;
    if (!rc || !rc.length) {
      list.innerHTML = `<div class="empty-msg" style="padding:20px 10px">${tm('no_recent')}<br><span style="font-size:10.5px;color:var(--dim);margin-top:8px;display:block">${tm('no_recent_hint')}</span></div>`;
    } else {
      // Сохраняем полный массив для Дневника
      (window as any)._journalRecords = rc;
      
      list.innerHTML = rc.map((r, i) => {
        const v = r.verdict || 'hold';
        const verdictMap: Record<string, string> = { strong_buy: 'buy', buy: 'buy', hold: 'hold', avoid: 'avoid' };
        const cls = verdictMap[v] || 'hold';
        const vLabel = v === 'strong_buy' ? (en ? 'STRONG BUY' : 'СИЛЬНО')
                     : v === 'buy' ? (en ? 'BUY' : 'ПОКУПКА')
                     : v === 'avoid' ? (en ? 'AVOID' : 'ИЗБЕГАТЬ')
                     : (en ? 'HOLD' : 'ЖДАТЬ');
        let outcomeHtml = '';
        if (r.outcome) {
          const oc = ['win', 'win_big'].includes(r.outcome) ? 'win'
                   : ['loss', 'loss_big'].includes(r.outcome) ? 'loss' : '';
          const label = oc === 'win' ? '✅ WIN' : oc === 'loss' ? '❌ LOSS' : '— FLAT';
          const pct = r.outcome_pct != null ? (r.outcome_pct >= 0 ? '+' : '') + r.outcome_pct + '%' : '';
          outcomeHtml = `<div class="recent-outcome ${oc}">${label} ${pct}</div>`;
        } else {
          outcomeHtml = `<div class="recent-outcome pending">⏳ ${tm('pending')}</div>`;
        }
        return `
          <div class="recent-item" onclick="openJournalEntry(${i})">
            <div class="recent-left">
              <div class="recent-ticker">${r.ticker}</div>
              <div class="recent-time">${relTime(r.timestamp)}</div>
            </div>
            <div class="recent-right">
              <div class="recent-verdict ${cls}">${vLabel}</div>
              ${outcomeHtml}
            </div>
          </div>`;
      }).join('');
    }
  } catch {
    const list = document.getElementById('oracle-recent-content');
    if (list) list.innerHTML = `<div class="empty-msg">${tm('error')}</div>`;
  }
}

export async function refreshOracleStats(): Promise<void> {
  toast(isEN() ? 'Updating...' : 'Обновляю...', 'info');
  try {
    const r = await oracleUpdateOutcomes();
    await oracleLearnPatterns();
    toast(
      `${isEN() ? 'Checked' : 'Проверено'} ${r.checked}, ${isEN() ? 'updated' : 'обновлено'} ${r.updated}`,
      'success'
    );
    renderOracleDashboard();
  } catch (e: any) {
    toast(tm('error') + ': ' + e.message, 'error');
  }
}

export function oracleAnalyzeCurrent(): void {
  const el = document.getElementById('ticker') as HTMLInputElement | null;
  const t = (el?.value || '').toUpperCase().trim();
  if (!t) { toast(tm('enter_ticker'), 'warn'); return; }
  (window as any).switchTab?.('home');
  mobileAnalyze();
}

// ═══ QUIZ ═══

export function openQuiz(): void {
  state.quizAnswers = {};
  const html = `
    <div style="font-size:13px;color:var(--tx);line-height:1.6;margin-bottom:14px">${tm('quiz_intro')}</div>
    <div class="quiz-step">
      <div class="quiz-question">${tm('quiz_q1')}</div>
      <button class="quiz-opt" onclick="answerQuizM('experience','newbie')">${tm('quiz_q1_a1')}</button>
      <button class="quiz-opt" onclick="answerQuizM('experience','mid')">${tm('quiz_q1_a2')}</button>
      <button class="quiz-opt" onclick="answerQuizM('experience','pro')">${tm('quiz_q1_a3')}</button>
    </div>`;
  (window as any).openSheet?.(tm('quiz_title'), html);
}

export function answerQuizM(key: string, val: string): void {
  state.quizAnswers[key] = val;
  if (key === 'experience') {
    setHTML('sheet-body', `
      <div style="font-size:13px;color:var(--tx);line-height:1.6;margin-bottom:14px">${tm('quiz_intro')}</div>
      <div class="quiz-step">
        <div class="quiz-question">${tm('quiz_q2')}</div>
        <button class="quiz-opt" onclick="answerQuizM('capital','small')">${tm('quiz_q2_a1')}</button>
        <button class="quiz-opt" onclick="answerQuizM('capital','mid')">${tm('quiz_q2_a2')}</button>
        <button class="quiz-opt" onclick="answerQuizM('capital','large')">${tm('quiz_q2_a3')}</button>
      </div>`);
  } else if (key === 'capital') {
    setHTML('sheet-body', `
      <div style="font-size:13px;color:var(--tx);line-height:1.6;margin-bottom:14px">${tm('quiz_intro')}</div>
      <div class="quiz-step">
        <div class="quiz-question">${tm('quiz_q3')}</div>
        <button class="quiz-opt" onclick="answerQuizM('drawdown','low')">${tm('quiz_q3_a1')}</button>
        <button class="quiz-opt" onclick="answerQuizM('drawdown','med')">${tm('quiz_q3_a2')}</button>
        <button class="quiz-opt" onclick="answerQuizM('drawdown','high')">${tm('quiz_q3_a3')}</button>
      </div>`);
  } else if (key === 'drawdown') {
    computeQuiz();
  }
}

function computeQuiz(): void {
  const profile = computeRiskProfile(state.quizAnswers);
  saveRiskProfile(profile);

  const labels: Record<string, string> = {
    conservative: isEN() ? '🛡️ Conservative' : '🛡️ Консервативный',
    balanced: isEN() ? '⚖️ Balanced' : '⚖️ Сбалансированный',
    aggressive: isEN() ? '🔥 Aggressive' : '🔥 Агрессивный',
  };

  setHTML('sheet-body', `
    <div style="text-align:center;padding:14px 0">
      <div style="font-size:42px;margin-bottom:10px">🔮</div>
      <div style="font-family:'Space Grotesk';font-size:18px;font-weight:700;color:var(--mint);margin-bottom:8px">${tm('quiz_done')}</div>
      <div style="font-family:'Space Grotesk';font-size:20px;font-weight:700;color:var(--hi);margin-bottom:8px">${labels[profile.level] || profile.level}</div>
      <div style="font-size:12.5px;color:var(--mut);line-height:1.6;margin-bottom:12px">${esc(profile.description)}</div>
      <button class="btn-primary" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');">OK</button>
    </div>`);
}

// ═══ DEMO MODE ═══

export async function executeDemoTrade(): Promise<void> {
  const plan = (window as any)._currentDemoPlan;
  if (!plan || !plan.entry || !plan.tp1 || !plan.stop) {
    toast(tm('demo_need_analysis'), 'warn');
    return;
  }

  // Определяем выбранную стратегию (2 или 3 шага)
  const is3Steps = document.getElementById('demo-strat-3')?.classList.contains('active') || false;
  const steps = is3Steps ? 3 : 2;

  const { executeDemoPlan } = await import('../demo');
  await executeDemoPlan(plan.entry, plan, steps);
}

// ═══ TRADE JOURNAL (ДНЕВНИК ОРАКУЛА) ═══

export function openJournalEntry(index: number): void {
  const records = (window as any)._journalRecords || [];
  const r = records[index];
  if (!r) return;

  const date = new Date(r.timestamp * 1000).toLocaleString();

  const isWin = ['win', 'win_big'].includes(r.outcome);
  const isLoss = ['loss', 'loss_big'].includes(r.outcome);
  const isPending = !r.outcome;

  const statusColor = isWin ? 'var(--mint)' : isLoss ? 'var(--coral)' : 'var(--amber)';
  const statusText = isWin ? '✅ WIN' : isLoss ? '❌ LOSS' : '⏳ PENDING';
  const pnlText = r.outcome_pct != null ? `${r.outcome_pct > 0 ? '+' : ''}${r.outcome_pct}%` : '—';

  const html = `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--dim);letter-spacing:1px;text-transform:uppercase;">${date}</div>
      <div style="font-family:'Space Grotesk',sans-serif;font-size:28px;font-weight:800;color:var(--hi);margin:6px 0;">${r.ticker}</div>
      <div style="display:inline-block;padding:6px 14px;border-radius:20px;background:rgba(0,0,0,.4);border:1px solid ${statusColor};color:${statusColor};font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:700;">
        ${statusText} ${!isPending ? `· ${pnlText}` : ''}
      </div>
    </div>

    <!-- Оценка Оракула -->
    <div class="card" style="margin-bottom:12px;border-color:var(--border-hi);">
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--mut);letter-spacing:1px;text-transform:uppercase;">${tm('journal_verdict')}</div>
          <div style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:var(--cyan);">${r.score > 0 ? '+' : ''}${r.score} / 100</div>
        </div>
        <div style="font-family:'Space Grotesk',sans-serif;font-size:14px;font-weight:700;color:var(--hi);margin-bottom:4px;">
          ${r.verdict === 'buy' ? '🟢 BUY' : r.verdict === 'strong_buy' ? '🟢 STRONG BUY' : r.verdict === 'avoid' ? '🔴 AVOID' : '🟡 HOLD'}
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mut);">
          ${tm('journal_confidence')}: ${r.confidence}%
        </div>
      </div>
    </div>

    <!-- Метрики на момент входа -->
    <div class="settings-section-title" style="margin-top:16px;">${tm('journal_snapshot')}</div>
    <div class="journal-grid">
      <div class="journal-cell">
        <div class="j-lbl">RSI</div>
        <div class="j-val" style="color:${r.rsi < 35 ? 'var(--mint)' : r.rsi > 65 ? 'var(--coral)' : 'var(--hi)'}">${r.rsi.toFixed(1)}</div>
      </div>
      <div class="journal-cell">
        <div class="j-lbl">${tm('journal_whale')}</div>
        <div class="j-val" style="color:${r.whale_active ? 'var(--cyan)' : 'var(--mut)'}">${r.whale_active ? tm('journal_whale_act') : '—'}</div>
      </div>
      <div class="journal-cell">
        <div class="j-lbl">Funding</div>
        <div class="j-val">${(r.funding_rate || 0).toFixed(4)}%</div>
      </div>
      <div class="journal-cell">
        <div class="j-lbl">${tm('journal_price')}</div>
        <div class="j-val">$${fmtP(r.price_at_analysis)}</div>
      </div>
    </div>

    <button class="btn-primary btn-mint" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="margin-top:20px;">
      ${tm('journal_close')}
    </button>
  `;

  (window as any).openSheet?.(tm('journal_title'), html);
}

// ═══ MULTI-TF CONFLUENCE HELP ═══

export function showConfluenceHelp(): void {
  const html = `
    <div style="font-size:13.5px;color:var(--tx);line-height:1.6;padding-bottom:10px;">
      ${tm('conf_help_desc')}
    </div>

    <div style="background:rgba(94,203,255,.08);border-left:3px solid var(--cyan);padding:12px;border-radius:8px;margin-bottom:14px;font-size:12.5px;line-height:1.5;color:var(--tx);">
      <b>${tm('conf_help_why_title')}</b><br>
      ${tm('conf_help_why_desc')}
    </div>

    <div style="font-size:12.5px;line-height:1.7;color:var(--tx);">
      <b>${tm('conf_help_how')}</b><br>
      🟢 ${tm('conf_help_strong')}<br>
      🟡 ${tm('conf_help_hold')}<br>
      🔴 ${tm('conf_help_avoid')}<br><br>
      
      <b>${tm('conf_help_rsi')}</b><br>
      ${tm('conf_help_rsi_desc')}
    </div>

    <button class="btn-primary btn-mint" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="margin-top:20px;">
      ${tm('conf_help_ok')}
    </button>
  `;

  (window as any).openSheet?.(tm('conf_help_title'), html);
}

// ═══ Экспорт в window ═══

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    mobileAnalyze,
    askAIMentor,
    renderPro,
    renderConfluence,
    showConfluenceHelp,
    openJournalEntry,
    openQuiz,
    answerQuizM,
    renderOracleDashboard,
    refreshOracleStats,
    oracleAnalyzeCurrent,
    openAISettings,
    saveGroqKeyFromModal,
    deleteGroqKeyFromModal,
    executeDemoTrade,
  });
}