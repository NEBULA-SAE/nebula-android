// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · LEARNING CORE
// Чистые функции: калибровка, инсайты, дрифт, сводка по данным
// ═══════════════════════════════════════════════════════════════

import { humanizePattern } from './patterns';

export interface Insight {
  id: string;
  type: 'new_pattern' | 'dead_pattern' | 'calibration_shift' | 'win_rate_change' | 'milestone' | 'data_gap';
  severity: 'info' | 'positive' | 'warning' | 'critical';
  created_at: number;
  title_ru: string;
  title_en: string;
  body_ru: string;
  body_en: string;
  meta?: Record<string, any>;
}

export interface CalibrationBucket {
  range: string;
  predicted: number;
  actual: number;
  n: number;
}

export interface DriftSnapshot {
  week_iso: string;
  win_rate: number;
  profit_factor: number;
  patterns_count: number;
  calibration_error: number;
  completed_count: number;
}

// ─── КАЛИБРОВКА ───
// Группирует завершённые записи по бакетам уверенности (20-30, 30-40, ...)
// и сравнивает предсказанную уверенность с реальным win rate.

export function computeCalibration(mem: any): CalibrationBucket[] {
  const completed = (mem?.analyses || []).filter((a: any) => a.outcome !== null);
  if (completed.length === 0) return [];

  const buckets: Record<string, { sum_conf: number; wins: number; n: number }> = {};
  const ranges = ['20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '80-90', '90-100'];

  for (const rec of completed) {
    const conf = Number(rec.confidence ?? 50);
    const idx = Math.min(7, Math.max(0, Math.floor(conf / 10) - 2));
    const key = ranges[idx];
    if (!buckets[key]) buckets[key] = { sum_conf: 0, wins: 0, n: 0 };
    buckets[key].sum_conf += conf;
    buckets[key].n++;
    if (rec.outcome === 'win' || rec.outcome === 'win_big') {
      buckets[key].wins++;
    }
  }

  return ranges
    .map(range => {
      const b = buckets[range];
      if (!b || b.n === 0) return { range, predicted: 0, actual: 0, n: 0 };
      const predicted = b.sum_conf / b.n;
      const actual = (b.wins / b.n) * 100;
      return {
        range,
        predicted: Math.round(predicted * 10) / 10,
        actual: Math.round(actual * 10) / 10,
        n: b.n,
      };
    })
    .filter(b => b.n > 0);
}

// ─── ИНСАЙТЫ ───
// Ищет новые/мёртвые паттерны, сдвиги калибровки, milestone, data gap.

export function computeInsights(mem: any, learned: Record<string, any>): Insight[] {
  const insights: Insight[] = [];
  const now = Math.floor(Date.now() / 1000);
  const completed = (mem?.analyses || []).filter((a: any) => a.outcome !== null);
  const totalCompleted = completed.length;

  // 1. Milestone
  const milestones = [10, 50, 100, 500, 1000];
  let currentMilestone = 0;
  for (const m of milestones) {
    if (totalCompleted >= m) currentMilestone = m;
  }
  if (currentMilestone > 0 && currentMilestone > (mem.last_milestone || 0)) {
    const wins = completed.filter((a: any) => ['win', 'win_big'].includes(a.outcome)).length;
    const wr = Math.round((wins / currentMilestone) * 100);
    insights.push({
      id: `milestone_${currentMilestone}`,
      type: 'milestone',
      severity: 'positive',
      created_at: now,
      title_ru: `Оракул закрыл ${currentMilestone}-й прогноз`,
      title_en: `Oracle closed ${currentMilestone} predictions`,
      body_ru: `Оракул накопил ${currentMilestone} завершённых анализов. Процент побед: ${wr}%. Продолжаем учиться!`,
      body_en: `Oracle has accumulated ${currentMilestone} completed analyses. Win rate: ${wr}%. Keep learning!`,
      meta: { milestone: currentMilestone },
    });
  }

  // 2. Data gap (нет новых анализов > 7 дней)
  if (mem?.analyses?.length > 0) {
    const lastAnalysis = mem.analyses[mem.analyses.length - 1];
    const hoursSinceLast = (now - lastAnalysis.timestamp) / 3600;
    if (hoursSinceLast > 168) {
      const days = Math.floor(hoursSinceLast / 24);
      insights.push({
        id: `data_gap_${Math.floor(now / 86400)}`,
        type: 'data_gap',
        severity: 'warning',
        created_at: now,
        title_ru: `⏳ Нет новых анализов ${days} дней`,
        title_en: `⏳ No new analyses for ${days} days`,
        body_ru: `Последний анализ был ${days} дней назад. Статистика может устареть. Запусти анализ монеты, чтобы Оракул продолжил учиться.`,
        body_en: `Last analysis was ${days} days ago. Stats may be stale. Run a coin analysis to keep Oracle learning.`,
      });
    }
  }

  // 3. Dead patterns (перестали работать)
  for (const [key, p] of Object.entries(learned || {})) {
    if (p.count >= 5 && p.win_rate <= 40 && p.weight <= -3) {
      insights.push({
        id: `dead_pattern_${key}`,
        type: 'dead_pattern',
        severity: 'warning',
        created_at: now,
        title_ru: `Паттерн «${humanizePattern(key)}» перестал работать`,
        title_en: `Pattern "${humanizePattern(key)}" stopped working`,
        body_ru: `Процент побед упал до ${p.win_rate}% на ${p.count} сделках. Оракул снижает вес этого паттерна.`,
        body_en: `Win rate dropped to ${p.win_rate}% on ${p.count} trades. Oracle reduces the weight of this pattern.`,
        meta: { pattern_key: key, win_rate: p.win_rate, count: p.count },
      });
    }
  }

  // 4. New strong patterns (выучил)
  for (const [key, p] of Object.entries(learned || {})) {
    if (p.count >= 5 && p.win_rate >= 60 && p.weight >= 3) {
      const insightId = `new_pattern_${key}`;
      if (!insights.some(i => i.id === insightId)) {
        insights.push({
          id: insightId,
          type: 'new_pattern',
          severity: 'positive',
          created_at: now,
          title_ru: `Оракул выучил новый паттерн: «${humanizePattern(key)}»`,
          title_en: `Oracle learned a new pattern: "${humanizePattern(key)}"`,
          body_ru: `Процент побед ${p.win_rate}% на ${p.count} сделках. Средняя доходность +${p.avg_outcome_pct}%. Оракул добавляет этот паттерн в скоринг.`,
          body_en: `Win rate ${p.win_rate}% on ${p.count} trades. Average return +${p.avg_outcome_pct}%. Oracle adds this pattern to scoring.`,
        });
      }
    }
  }

  // 5. Calibration shift
  const cal = computeCalibration(mem);
  if (cal.length > 0) {
    const weightedErrors = cal.map(b => Math.abs(b.predicted - b.actual) * b.n);
    const totalN = cal.reduce((s, b) => s + b.n, 0);
    const mae = totalN > 0 ? weightedErrors.reduce((s, e) => s + e, 0) / totalN : 0;
    if (mae > 15 && totalN >= 10) {
      insights.push({
        id: `calibration_shift_${Math.floor(now / 86400)}`,
        type: 'calibration_shift',
        severity: 'warning',
        created_at: now,
        title_ru: `Калибровка уверенности: ошибка ${Math.round(mae)}%`,
        title_en: `Confidence calibration: ${Math.round(mae)}% error`,
        body_ru: `Оракул в среднем переоценивает или недооценивает уверенность на ${Math.round(mae)}%. Проверь график калибровки в разделе «Паттерны».`,
        body_en: `Oracle on average overestimates or underestimates confidence by ${Math.round(mae)}%. Check the calibration chart in the Patterns tab.`,
        meta: { mae: Math.round(mae) },
      });
    }
  }

  return insights.sort((a, b) => b.created_at - a.created_at);
}

// ─── СВОДКА ПО ДАННЫМ ───

export function computeDataSummary(mem: any): {
  symbols: { symbol: string; count: number; last_seen: number }[];
  freshness_hours: number;
} {
  const analyses = mem?.analyses || [];
  const map: Record<string, { count: number; last_seen: number }> = {};

  for (const r of analyses) {
    if (!map[r.ticker]) map[r.ticker] = { count: 0, last_seen: 0 };
    map[r.ticker].count++;
    if (r.timestamp > map[r.ticker].last_seen) map[r.ticker].last_seen = r.timestamp;
  }

  const symbols = Object.entries(map)
    .map(([symbol, d]) => ({ symbol, count: d.count, last_seen: d.last_seen }))
    .sort((a, b) => b.count - a.count);

  const now = Math.floor(Date.now() / 1000);
  const lastTs = analyses.length > 0 ? Math.max(...analyses.map((r: any) => r.timestamp)) : now;
  const freshness_hours = (now - lastTs) / 3600;

  return { symbols, freshness_hours };
}

// ─── ДРИФТ ───
// Создаёт недельный снимок метрик (для графика изменения win rate, PF и т.д.)

export function createDriftSnapshot(mem: any, learned: Record<string, any>): DriftSnapshot {
  const completed = (mem?.analyses || []).filter((a: any) => a.outcome !== null);
  const wins = completed.filter((a: any) => a.outcome === 'win' || a.outcome === 'win_big').length;
  const win_rate = completed.length > 0 ? (wins / completed.length) * 100 : 0;

  const tp = completed
    .filter((a: any) => ['win', 'win_big'].includes(a.outcome))
    .reduce((s: number, a: any) => s + Math.max(0, a.outcome_pct || 0), 0);
  const tl = Math.abs(
    completed
      .filter((a: any) => ['loss', 'loss_big'].includes(a.outcome))
      .reduce((s: number, a: any) => s + Math.min(0, a.outcome_pct || 0), 0)
  );
  const profit_factor = tl > 0 ? tp / tl : tp > 0 ? 99 : 0;

  const cal = computeCalibration(mem);
  const weightedErrors = cal.map(b => Math.abs(b.predicted - b.actual) * b.n);
  const totalN = cal.reduce((s, b) => s + b.n, 0);
  const calibration_error = totalN > 0 ? weightedErrors.reduce((s, e) => s + e, 0) / totalN : 0;

  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / 86400000);
  const week = Math.ceil((days + start.getDay() + 1) / 7);
  const week_iso = `${year}-W${String(week).padStart(2, '0')}`;

  return {
    week_iso,
    win_rate: Math.round(win_rate * 10) / 10,
    profit_factor: Math.round(profit_factor * 100) / 100,
    patterns_count: Object.keys(learned || {}).length,
    calibration_error: Math.round(calibration_error * 10) / 10,
    completed_count: completed.length,
  };
}