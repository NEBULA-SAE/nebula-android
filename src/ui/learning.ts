// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · LEARNING (UI)
// Порт openLearning из js/ui.js
//
// TODO: oracle_get_stats пока не перенесён — заглушка.
// Когда перенесём python/oracle.py → заменить стаб на реальные данные.
// ═══════════════════════════════════════════════════════════════

import { setHTML, toast } from '../utils';
import { tm, isEN } from '../i18n';
import { openSheet } from './screens';

// ─── Заглушка вместо eel.oracle_get_stats ───

interface LearningStats {
  completed_analyses: number;
  days_learning: number;
  pending_outcomes: number;
  total_analyses: number;
  win_rate: number;
  wins: number;
  losses: number;
  profit_factor: number;
  patterns_count: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  top_patterns: any[];
  worst_patterns: any[];
}

async function getLearningStats(): Promise<LearningStats> {
  // TODO: заменить на реальный источник, когда перенесём oracle.py
  return {
    completed_analyses: 0,
    days_learning: 0,
    pending_outcomes: 0,
    total_analyses: 0,
    win_rate: 0,
    wins: 0,
    losses: 0,
    profit_factor: 0,
    patterns_count: 0,
    avg_win_pct: 0,
    avg_loss_pct: 0,
    top_patterns: [],
    worst_patterns: [],
  };
}

export async function openLearning(): Promise<void> {
  openSheet(tm('learning'), `<div class="loader">${tm('loading')}</div>`);

  try {
    const st = await getLearningStats();
    const progress = Math.min(1, st.completed_analyses / Math.max(10, st.completed_analyses * 0.5 + 10));
    const circumference = 2 * Math.PI * 46;
    const offset = circumference * (1 - progress);

    let html = `
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
      <div class="learn-grid">
        <div class="learn-stat"><div class="learn-lbl">${tm('learn_total')}</div><div class="learn-val">${st.total_analyses}</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('win_rate')}</div><div class="learn-val" style="color:var(--mint)">${st.win_rate}%</div><div class="learn-sub">${st.wins}W / ${st.losses}L</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('profit_factor')}</div><div class="learn-val" style="color:var(--cyan)">${st.profit_factor.toFixed(2)}</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('patterns')}</div><div class="learn-val">${st.patterns_count}</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('learn_avg_win')}</div><div class="learn-val" style="color:var(--mint);font-size:15px">+${st.avg_win_pct.toFixed(1)}%</div></div>
        <div class="learn-stat"><div class="learn-lbl">${tm('learn_avg_loss')}</div><div class="learn-val" style="color:var(--coral);font-size:15px">${st.avg_loss_pct.toFixed(1)}%</div></div>
      </div>
      <div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--mint);margin:12px 0 8px">🏆 ${tm('learn_best')}</div>`;

    if (st.top_patterns?.length > 0) {
      html += st.top_patterns.map((p: any) => `
        <div class="pattern-card">
          <div class="pattern-header"><div class="pattern-name">${p.name}</div><div class="pattern-rate">${p.win_rate}%</div></div>
          <div class="pattern-stats"><span>📊 ${p.count}</span><span>✅ ${p.wins}W</span><span>❌ ${p.losses}L</span><span>📈 ${p.avg_outcome_pct >= 0 ? '+' : ''}${p.avg_outcome_pct}%</span></div>
        </div>`).join('');
    } else {
      html += `<div class="empty-msg">${tm('learn_not_enough')}</div>`;
    }

    html += `<div style="font-family:'Space Grotesk';font-size:12px;font-weight:700;color:var(--coral);margin:14px 0 8px">⚠️ ${tm('learn_worst')}</div>`;

    if (st.worst_patterns?.length > 0) {
      html += st.worst_patterns.map((p: any) => `
        <div class="pattern-card bad">
          <div class="pattern-header"><div class="pattern-name">${p.name}</div><div class="pattern-rate">${p.win_rate}%</div></div>
          <div class="pattern-stats"><span>📊 ${p.count}</span><span>✅ ${p.wins}W</span><span>❌ ${p.losses}L</span><span>📉 ${p.avg_outcome_pct >= 0 ? '+' : ''}${p.avg_outcome_pct}%</span></div>
        </div>`).join('');
    } else {
      html += `<div class="empty-msg">${tm('learn_not_enough')}</div>`;
    }

    html += `<button class="btn-primary btn-mint" onclick="refreshLearning()" style="margin-top:12px">↻ ${tm('oracle_refresh')}</button>`;

    setHTML('sheet-body', html);
  } catch (e: any) {
    setHTML('sheet-body', `<div class="empty-msg">${tm('error')}: ${e.message}</div>`);
  }
}

export async function refreshLearning(): Promise<void> {
  toast(isEN() ? 'Updating...' : 'Обновляю...', 'info');
  try {
    // TODO: заменить на реальные oracle_update_outcomes / oracle_learn_patterns
    // когда перенесём oracle.py
    toast(isEN() ? 'Checked 0, updated 0' : 'Проверено 0, обновлено 0', 'success');
    openLearning();
  } catch (e: any) {
    toast(tm('error') + ': ' + e.message, 'error');
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    openLearning,
    refreshLearning,
  });
}