// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · RISK COMMAND CENTER
// Агрегирует 5 индикаторов риска в единый светофор
// ═══════════════════════════════════════════════════════════════

import { state, esc } from '../utils';
import type { RiskLevel, RiskIndicator, RiskSnapshot } from '../utils';
import { tm } from '../i18n';

// ─── Веса индикаторов (сумма = 1) ───

const WEIGHTS = {
  concentration: 0.25,
  confidence: 0.20,
  whale: 0.20,
  funding: 0.15,
  fear: 0.20,
};

// ─── Сбор метрик ───

function getConcentration(): { level: RiskLevel; value: string; hint: string } {
  const assets = (state as any).portfolioAssets as Array<{ coin: string; total_usd: number }> | undefined;

  if (!assets || assets.length === 0) {
    return { level: 'low', value: '—', hint: tm('risk_no_portfolio') };
  }

  const total = assets.reduce((s, a) => s + (a.total_usd || 0), 0);
  if (total <= 0) {
    return { level: 'low', value: '—', hint: tm('risk_no_portfolio') };
  }

  const top = Math.max(...assets.map(a => a.total_usd || 0));
  const pct = (top / total) * 100;

  let level: RiskLevel = 'low';
  if (pct > 60) level = 'high';
  else if (pct > 40) level = 'medium';

  return { level, value: `${pct.toFixed(0)}%`, hint: tm('risk_concentration_hint') };
}

function getConfidence(): { level: RiskLevel; value: string; hint: string } {
  const oracle = state.lastOracleResult;
  if (!oracle || typeof oracle.confidence !== 'number') {
    return { level: 'low', value: '—', hint: tm('risk_confidence_hint') };
  }

  const conf = oracle.confidence;
  let level: RiskLevel = 'low';
  if (conf < 40) level = 'high';
  else if (conf < 55) level = 'medium';

  return { level, value: `${conf.toFixed(0)}%`, hint: tm('risk_confidence_hint') };
}

function getWhale(): { level: RiskLevel; value: string; hint: string } {
  const whale = state.lastWhaleData;
  const active = !!whale?.isWhaleActive;
  return {
    level: active ? 'medium' : 'low',
    value: active ? tm('risk_whale_active') : tm('risk_whale_calm'),
    hint: tm('risk_whale_hint'),
  };
}

function getFunding(): { level: RiskLevel; value: string; hint: string } {
  const wf = (state as any).lastFuturesMetrics;
  const funding = wf?.funding_rate;
  if (typeof funding !== 'number') {
    return { level: 'low', value: '—', hint: tm('risk_funding_neutral') };
  }

  const abs = Math.abs(funding);
  let level: RiskLevel = 'low';
  let value = `${funding >= 0 ? '+' : ''}${funding.toFixed(4)}%`;

  if (abs > 0.1) level = 'high';
  else if (abs > 0.05) level = 'medium';

  return {
    level,
    value,
    hint: level !== 'low' ? tm('risk_funding_overheated') : tm('risk_funding_neutral'),
  };
}

function getFear(): { level: RiskLevel; value: string; hint: string } {
  const mctx = (state as any).lastMarketContext;
  const fng = mctx?.fear_greed;
  if (typeof fng !== 'number') {
    return { level: 'low', value: '—', hint: tm('risk_fear_hint') };
  }

  let level: RiskLevel = 'low';
  if (fng > 80 || fng < 20) level = 'high';
  else if (fng > 70 || fng < 30) level = 'medium';

  return {
    level,
    value: `${fng}`,
    hint: mctx?.fear_greed_text || tm('risk_fear_hint'),
  };
}

// ─── Снимок риска ───

export function computeRiskSnapshot(): RiskSnapshot {
  const conc = getConcentration();
  const conf = getConfidence();
  const whale = getWhale();
  const funding = getFunding();
  const fear = getFear();

  const indicators: RiskIndicator[] = [
    { key: 'concentration', label: tm('risk_concentration'), ...conc },
    { key: 'confidence', label: tm('risk_confidence'), ...conf },
    { key: 'whale', label: tm('risk_whale'), ...whale },
    { key: 'funding', label: tm('risk_funding'), ...funding },
    { key: 'fear', label: tm('risk_fear'), ...fear },
  ];

  // Итог: если хоть один high → high. Если ≥2 medium или 1 medium с high-весом → medium. Иначе low.
  const highCount = indicators.filter(i => i.level === 'high').length;
  const mediumCount = indicators.filter(i => i.level === 'medium').length;

  let overall: RiskLevel = 'low';
  if (highCount >= 1) overall = 'high';
  else if (mediumCount >= 2) overall = 'medium';
  else if (mediumCount === 1) overall = 'medium';

  const snap: RiskSnapshot = {
    overall,
    indicators,
    updated: Date.now(),
  };

  state.riskSnapshot = snap;
  return snap;
}

// ─── Рендер ───

function levelIcon(level: RiskLevel): string {
  return level === 'low' ? '🟢' : level === 'medium' ? '🟡' : '🔴';
}

function renderHero(snap: RiskSnapshot): string {
  const overall = snap.overall;
  const titleMap: Record<RiskLevel, string> = {
    low: tm('risk_overall_low'),
    medium: tm('risk_overall_medium'),
    high: tm('risk_overall_high'),
  };

  return `
    <div class="risk-hero risk-hero-${overall}">
      <div class="risk-hero-glow"></div>
      <div class="risk-hero-content">
        <div class="risk-hero-icon">${levelIcon(overall)}</div>
        <div class="risk-hero-body">
          <div class="risk-hero-title">${esc(titleMap[overall])}</div>
          <div class="risk-hero-sub">${esc(tm('risk_subtitle'))}</div>
        </div>
      </div>
    </div>
  `;
}

function renderIndicator(ind: RiskIndicator): string {
  const pulseClass = ind.level === 'high' ? ' risk-pulse' : '';
  return `
    <div class="risk-indicator risk-indicator-${ind.level}${pulseClass}">
      <div class="risk-indicator-head">
        <div class="risk-indicator-label">${esc(ind.label)}</div>
        <div class="risk-indicator-badge risk-badge-${ind.level}">${levelIcon(ind.level)}</div>
      </div>
      <div class="risk-indicator-value">${esc(ind.value)}</div>
      <div class="risk-indicator-hint">${esc(ind.hint)}</div>
    </div>
  `;
}

export function renderRiskCenter(): void {
  const host = document.getElementById('risk-content');
  if (!host) return;

  // Добавляем кнопку справки
  injectRiskHelpBtn();

  const snap = computeRiskSnapshot();

  host.innerHTML = `
    ${renderHero(snap)}
    <div class="risk-grid">
      ${snap.indicators.map(renderIndicator).join('')}
    </div>
    <div class="risk-actions">
      <button class="risk-action-btn risk-action-alerts" onclick="openAlertsSheet()">
        <svg style="width:18px;height:18px;margin-right:8px;"><use href="#i-bell"/></svg>
        ${esc(tm('alerts_title'))}
      </button>
    </div>
    <div class="risk-updated">
      ${new Date(snap.updated).toLocaleTimeString()}
    </div>
  `;
}

// ─── СПРАВКА (HELP) ───

export function showRiskHelp(): void {
  const openSheet = (window as any).openSheet;
  
  const html = `
    <div style="font-size: 13.5px; color: var(--tx); line-height: 1.6;">
      <div style="margin-bottom: 16px; color: var(--dim);">
        ${tm('risk_help_desc')}
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center;">🥧</div>
          <div>
            <div style="font-weight: 700; color: var(--cyan); margin-bottom: 2px;">${tm('risk_help_conc')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('risk_help_conc_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center;">🔮</div>
          <div>
            <div style="font-weight: 700; color: #45e0a8; margin-bottom: 2px;">${tm('risk_help_conf')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('risk_help_conf_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center;">🐋</div>
          <div>
            <div style="font-weight: 700; color: #5ecbff; margin-bottom: 2px;">${tm('risk_help_whale')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('risk_help_whale_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center;">⚖️</div>
          <div>
            <div style="font-weight: 700; color: #ffb858; margin-bottom: 2px;">${tm('risk_help_fund')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('risk_help_fund_desc')}</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: flex-start; background: rgba(255,255,255,.02); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,.05);">
          <div style="font-size: 20px; width: 30px; text-align: center;">😱</div>
          <div>
            <div style="font-weight: 700; color: #a78bfa; margin-bottom: 2px;">${tm('risk_help_fear')}</div>
            <div style="font-size: 11.5px; color: var(--mut);">${tm('risk_help_fear_desc')}</div>
          </div>
        </div>
      </div>

      <button class="btn-primary btn-mint" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="margin-top: 20px;">
        ${tm('risk_help_close')}
      </button>
    </div>
  `;

  if (openSheet) {
    openSheet(tm('risk_help_title'), html);
  }
}

export function injectRiskHelpBtn(): void {
  const titleEl = document.getElementById('risk-page-title-text');
  if (!titleEl || document.getElementById('risk-help-btn')) return;

  const parent = titleEl.parentElement;
  if (parent) {
    parent.style.display = 'flex';
    parent.style.alignItems = 'center';
    parent.style.gap = '10px';
  }

  const btn = document.createElement('button');
  btn.id = 'risk-help-btn';
  btn.innerHTML = 'ℹ️';
  btn.title = tm('risk_help_title');
  btn.style.cssText = `
    height: 24px; width: 24px; border-radius: 50%;
    background: rgba(0,0,0,.6); border: 1px solid rgba(140,170,220,.25);
    color: #6b7a94; font-size: 12px;
    cursor: pointer; transition: all .15s;
    display: flex; align-items: center; justify-content: center;
    padding: 0;
  `;
  btn.addEventListener('click', showRiskHelp);
  titleEl.after(btn);
}

// ─── Экспорт ───

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    computeRiskSnapshot,
    renderRiskCenter,
    showRiskHelp,
    injectRiskHelpBtn,
  });
}