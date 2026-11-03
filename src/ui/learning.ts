// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · LEARNING (UI)
// 3 таба: Обзор, Паттерны, Инсайты
// ═══════════════════════════════════════════════════════════════
import { humanizePattern } from '../patterns';
import { setHTML, toast } from '../utils';
import { tm, isEN } from '../i18n';
import { openSheet } from './screens';
import { oracleGetStats, oracleUpdateOutcomes, oracleLearnPatterns, getOracleMemorySnapshot } from '../oracle';
import { computeCalibration, computeInsights, createDriftSnapshot } from '../learning-core';

// ─── Вспомогательная функция для получения выученных паттернов ───
function getLearnedPatterns(): Record<string, any> {
  try {
    const raw = localStorage.getItem('nebulaLearnedPatterns');
    if (raw) return JSON.parse(raw).patterns || {};
  } catch { /* silent */ }
  return {};
}

// ─── Переключение табов ───
export function switchLearnTab(tab: 'overview' | 'patterns' | 'insights'): void {
  document.querySelectorAll('.learn-tab-content').forEach(el => (el as HTMLElement).style.display = 'none');
  document.querySelectorAll('.learn-tab').forEach(el => {
    el.classList.remove('active');
    (el as HTMLElement).style.background = 'transparent';
    (el as HTMLElement).style.color = 'var(--mut)';
  });

  const activeContent = document.getElementById(`learn-tab-${tab}`);
  if (activeContent) activeContent.style.display = 'block';

  const activeBtn = document.getElementById(`tab-btn-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.background = 'linear-gradient(135deg, rgba(94,203,255,.2), rgba(167,139,250,.2))';
    activeBtn.style.color = 'var(--hi)';
  }
}

// ═══ ОСНОВНАЯ ФУНКЦИЯ ═══
export async function openLearning(): Promise<void> {
  openSheet(tm('learning'), `<div class="loader">${tm('loading')}</div>`);

  try {
    const st = oracleGetStats();
    const mem = getOracleMemorySnapshot();
    const learned = getLearnedPatterns();
    const drift = createDriftSnapshot(mem, learned);

    // ─── ВКЛАДКА 1: ОБЗОР ───
    const progress = Math.min(1, st.completed_analyses / Math.max(10, st.completed_analyses * 0.5 + 10));
    const circumference = 2 * Math.PI * 46;
    const offset = circumference * (1 - progress);

    let overviewHtml = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="position:relative;width:110px;height:110px;margin:0 auto 10px">
          <svg width="110" height="110" style="transform:rotate(-90deg)">
            <defs><linearGradient id="gradStroke2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#5ecbff"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient></defs>
            <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="8"/>
            <circle cx="55" cy="55" r="46" fill="none" stroke="url(#gradStroke2)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div style="font-family:'Space Grotesk';font-size:22px;font-weight:700;color:var(--hi)">${st.completed_analyses}</div>
            <div style="font-family:'JetBrains Mono';font-size:8px;color:var(--dim);letter-spacing:1.2px;text-transform:uppercase">${tm('completed')}</div>
          </div>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--mut)">${st.days_learning.toFixed(1)} ${tm('days')} · ${st.pending_outcomes} ${tm('pending')}</div>
      </div>

      <div class="learn-grid" style="grid-template-columns: 1fr 1fr;">
        <div class="learn-stat"><div class="learn-lbl">${tm('win_rate')}</div><div class="learn-val" style="color:var(--mint)">${st.win_rate}%</div><div class="learn-sub">${st.wins}W / ${st.losses}L</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('profit_factor')}</div><div class="learn-val" style="color:var(--cyan)">${st.profit_factor.toFixed(2)}</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('learn_calibration_error')}</div><div class="learn-val" style="color:${drift.calibration_error > 15 ? 'var(--coral)' : 'var(--amber)'}">${drift.calibration_error}%</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('learn_sample_size')}</div><div class="learn-val">${st.completed_analyses}</div></div>
      </div>
      
      <div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--muted);margin:16px 0 8px">${tm('learn_drift_title')}</div>
      <div style="background:rgba(0,0,0,.3); border-radius:8px; padding:12px; border:1px solid var(--border); font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--mut); text-align:center;">
        📈 ${drift.week_iso} — WR: ${drift.win_rate}% | PF: ${drift.profit_factor}
      </div>
    `;

    // ─── ВКЛАДКА 2: ПАТТЕРНЫ ───
    const cal = computeCalibration(mem);
    let patternsHtml = `
      <div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--hi);margin-bottom:8px">${tm('learn_calibration_title')}</div>
    `;
    if (cal.length > 0) {
      patternsHtml += `<div style="background:rgba(0,0,0,.3); border-radius:8px; padding:12px; margin-bottom:16px;">`;
      for (const b of cal) {
        const maxVal = Math.max(b.predicted, b.actual, 100);
        patternsHtml += `
          <div style="margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; font-family:'JetBrains Mono',monospace; font-size:9.5px; color:var(--mut); margin-bottom:2px;">
              <span>${b.range}% (n=${b.n})</span>
              <span>${b.predicted}% → ${b.actual}%</span>
            </div>
            <div style="display:flex; gap:2px; height:6px;">
              <div style="width:${(b.predicted / maxVal) * 100}%; background:rgba(94,203,255,.4); border-radius:2px;"></div>
              <div style="width:${(b.actual / maxVal) * 100}%; background:var(--mint); border-radius:2px;"></div>
            </div>
          </div>
        `;
      }
      patternsHtml += `</div>`;
    } else {
      patternsHtml += `<div class="empty-msg">${tm('learn_calibration_empty')}</div>`;
    }

    patternsHtml += `<div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--mint);margin:12px 0 8px">🏆 ${tm('learn_best')}</div>`;
    if (st.top_patterns?.length > 0) {
      patternsHtml += st.top_patterns.map((p: any) => `
        <div class="pattern-card">
          <div class="pattern-header"><div class="pattern-name">${humanizePattern(p.key)}</div><div class="pattern-rate">${p.win_rate}%</div></div>
          <div class="pattern-stats"><span>📊 ${p.count}</span><span>✅ ${p.wins ?? 0}W</span><span>❌ ${p.losses ?? 0}L</span><span>⚖️ ${tm('learn_pattern_weight')}: ${p.weight}</span></div>
        </div>`).join('');
    } else {
      patternsHtml += `<div class="empty-msg">${tm('learn_not_enough')}</div>`;
    }

    patternsHtml += `<div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--coral);margin:14px 0 8px">⚠️ ${tm('learn_worst')}</div>`;
    if (st.worst_patterns?.length > 0) {
      patternsHtml += st.worst_patterns.map((p: any) => `
        <div class="pattern-card bad">
          <div class="pattern-header"><div class="pattern-name">${humanizePattern(p.key)}</div><div class="pattern-rate">${p.win_rate}%</div></div>
          <div class="pattern-stats"><span>📊 ${p.count}</span><span>✅ ${p.wins}W</span><span>❌ ${p.losses}L</span><span>⚖️ ${tm('learn_pattern_weight')}: ${p.weight}</span></div>
        </div>`).join('');
    } else {
      patternsHtml += `<div class="empty-msg">${tm('learn_not_enough')}</div>`;
    }

    // ─── ВКЛАДКА 3: ИНСАЙТЫ ───
    const insights = computeInsights(mem, learned);
    
    // Запоминаем, какой milestone мы уже показали
    const milestones = [10, 50, 100, 500, 1000];
    let currentMilestone = 0;
    for (const m of milestones) if (st.completed_analyses >= m) currentMilestone = m;
    if (currentMilestone > (mem.last_milestone || 0)) {
      mem.last_milestone = currentMilestone;
      // Сохраняем в базу, чтобы не показывать этот инсайт снова
      import('../oracle').then(m => m.saveMemory(mem));
    }
    let insightsHtml = '';
    if (insights.length > 0) {
      insightsHtml = insights.map((ins: any) => {
        const icon = ins.type === 'new_pattern' ? '✅' : ins.type === 'dead_pattern' ? '⚠️' : ins.type === 'milestone' ? '🏆' : ins.type === 'data_gap' ? '⏳' : '📊';
        // Просто убедись, что в learning-core.ts мы убрали эмодзи из title_ru/title_en
        const color = ins.severity === 'positive' ? 'var(--mint)' : ins.severity === 'warning' ? 'var(--coral)' : 'var(--cyan)';
        return `
          <div style="background:rgba(0,0,0,.3); border-left:3px solid ${color}; border-radius:8px; padding:12px; margin-bottom:10px;">
            <div style="font-family:'Space Grotesk'; font-size:13px; font-weight:700; color:${color}; margin-bottom:4px;">
              ${icon} ${isEN() ? ins.title_en : ins.title_ru}
            </div>
            <div style="font-family:'JetBrains Mono',monospace; font-size:11px; line-height:1.5; color:var(--tx);">
              ${isEN() ? ins.body_en : ins.body_ru}
            </div>
          </div>
        `;
      }).join('');
    } else {
      insightsHtml = `<div class="empty-msg">${tm('learn_insights_empty')}</div>`;
    }

    // ─── СБОРКА ВСЕГО HTML ───
    const finalHtml = `
      <!-- Табы -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
         <div class="learn-tabs" style="display:flex; gap:8px; flex:1; background:rgba(0,0,0,.4); padding:4px; border-radius:10px; margin-right:8px;">
        <button class="learn-tab active" onclick="switchLearnTab('overview')" id="tab-btn-overview" style="flex:1; padding:10px; border:none; border-radius:8px; background:linear-gradient(135deg, rgba(94,203,255,.2), rgba(167,139,250,.2)); color:var(--hi); font-family:'Space Grotesk'; font-size:12px; font-weight:700; cursor:pointer;">${tm('learn_tab_overview')}</button>
        <button class="learn-tab" onclick="switchLearnTab('patterns')" id="tab-btn-patterns" style="flex:1; padding:10px; border:none; border-radius:8px; background:transparent; color:var(--mut); font-family:'Space Grotesk'; font-size:12px; font-weight:700; cursor:pointer;">${tm('learn_tab_patterns')}</button>
        <button class="learn-tab" onclick="switchLearnTab('insights')" id="tab-btn-insights" style="flex:1; padding:10px; border:none; border-radius:8px; background:transparent; color:var(--mut); font-family:'Space Grotesk'; font-size:12px; font-weight:700; cursor:pointer;">${tm('learn_tab_insights')}</button>
      </div>
      <button onclick="openLearningHelp()" style="background:rgba(255,255,255,.1); border:1px solid var(--border); border-radius:10px; padding:10px 14px; color:var(--hi); cursor:pointer; font-size:16px;" title="${tm('learn_help_title')}">❓</button>
    </div>

      <!-- Контент -->
      <div id="learn-tab-overview" class="learn-tab-content" style="display:block;">${overviewHtml}</div>
      <div id="learn-tab-patterns" class="learn-tab-content" style="display:none;">${patternsHtml}</div>
      <div id="learn-tab-insights" class="learn-tab-content" style="display:none;">${insightsHtml}</div>

      <button class="btn-primary btn-mint" onclick="refreshLearning()" style="margin-top:16px">↻ ${tm('oracle_refresh')}</button>
    `;

    setHTML('sheet-body', finalHtml);

  } catch (e: any) {
    setHTML('sheet-body', `<div class="empty-msg">${tm('error')}: ${e.message}</div>`);
  }
}

export async function refreshLearning(): Promise<void> {
  toast(isEN() ? 'Updating...' : 'Обновляю...', 'info');
  try {
    const r = await oracleUpdateOutcomes();
    await oracleLearnPatterns();
    toast(
      `${isEN() ? 'Checked' : 'Проверено'} ${r.checked}, ${isEN() ? 'updated' : 'обновлено'} ${r.updated}`,
      'success'
    );
    openLearning();
  } catch (e: any) {
    toast(tm('error') + ': ' + e.message, 'error');
  }
}

// ═══ ОБЪЯСНЯЛКА ═══
export function openLearningHelp(): void {
  const html = `
    <div style="font-size:13px; color:var(--tx); line-height:1.6;">
      <div style="margin-bottom:16px;">
        <div style="font-weight:700; color:var(--mint); margin-bottom:4px;">📈 ${tm('learn_help_pf')}</div>
        <div>${tm('learn_help_pf_desc')}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-weight:700; color:var(--cyan); margin-bottom:4px;">🎯 ${tm('learn_help_cal')}</div>
        <div>${tm('learn_help_cal_desc')}</div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-weight:700; color:var(--violet); margin-bottom:4px;">🧩 ${tm('learn_help_pat')}</div>
        <div>${tm('learn_help_pat_desc')}</div>
      </div>
      <div style="margin-bottom:20px;">
        <div style="font-weight:700; color:var(--amber); margin-bottom:4px;">💡 ${tm('learn_help_ins')}</div>
        <div>${tm('learn_help_ins_desc')}</div>
      </div>
      <button class="btn-primary" onclick="document.getElementById('sheet-overlay').classList.remove('open');document.getElementById('sheet').classList.remove('open');" style="margin-top:10px;">
        OK
      </button>
    </div>
  `;
  openSheet(tm('learn_help_title'), html);
}

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openLearning,
    refreshLearning,
    switchLearnTab,
    openLearningHelp
  });
}