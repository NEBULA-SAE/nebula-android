// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · BTC OUTLOOK ENGINE
// ATH-циклы, пробой, календарь «этот день в истории», аналоги
// ═══════════════════════════════════════════════════════════════

import type { Candle } from '../sources/candles';

export const HISTORICAL_ATHS = [
  { date: '2011-06-08', price: 31,    label: '2011 rally' },
  { date: '2013-12-04', price: 1147,  label: '2013 bubble' },
  { date: '2017-12-17', price: 19783, label: '2017 mania' },
  { date: '2021-04-14', price: 64804, label: '2021 first' },
  { date: '2021-11-10', price: 68789, label: '2021 second' },
  { date: '2024-03-14', price: 73750, label: 'ETF rally' },
  { date: '2024-11-13', price: 93265, label: 'Post-election' },
];

export interface AthCycleInfo {
  ath_price: number; ath_date: string; label: string;
  days_since_prev: number; gain_from_prev_pct: number;
}

export function analyzeCycles(): AthCycleInfo[] {
  const out: AthCycleInfo[] = [];
  for (let i = 1; i < HISTORICAL_ATHS.length; i++) {
    const cur = HISTORICAL_ATHS[i];
    const prev = HISTORICAL_ATHS[i - 1];
    const days = Math.round((new Date(cur.date).getTime() - new Date(prev.date).getTime()) / 86400000);
    const gain = ((cur.price - prev.price) / prev.price) * 100;
    out.push({
      ath_price: cur.price, ath_date: cur.date, label: cur.label,
      days_since_prev: days,
      gain_from_prev_pct: Math.round(gain * 10) / 10,
    });
  }
  return out;
}

export interface BreakoutStats {
  avg_days_between: number; median_days_between: number;
  avg_gain_pct: number; cycle_count: number;
  current_ath: number; current_ath_date: string;
  pct_to_ath: number; days_since_ath: number;
}

export function computeBreakoutStats(currentPrice: number, currentAth: number, currentAthDate: string): BreakoutStats {
  const cycles = analyzeCycles();
  const days = cycles.map(c => c.days_since_prev).sort((a, b) => a - b);
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  const median = days[Math.floor(days.length / 2)];
  const avgGain = cycles.reduce((s, c) => s + c.gain_from_prev_pct, 0) / cycles.length;
  const lastAthDate = currentAthDate || HISTORICAL_ATHS[HISTORICAL_ATHS.length - 1].date;
  const athTs = new Date(lastAthDate).getTime();
  return {
    avg_days_between: Math.round(avg),
    median_days_between: median,
    avg_gain_pct: Math.round(avgGain * 10) / 10,
    cycle_count: cycles.length,
    current_ath: currentAth,
    current_ath_date: lastAthDate,
    pct_to_ath: ((currentAth - currentPrice) / currentPrice) * 100,
    days_since_ath: Math.round((Date.now() - athTs) / 86400000),
  };
}

// ─── Пробой ATH: kNN по историческим неделям ───

export interface AnalogForBreakout {
  date: string; price: number; ath_at_that_time: number;
  pct_below_ath: number;
  broke_within_7d: boolean; broke_within_30d: boolean;
  broke_within_90d: boolean; broke_within_365d: boolean;
}

export interface BreakoutProbability {
  samples: number;
  p_7d: number; p_30d: number; p_90d: number; p_365d: number;
  analogs: AnalogForBreakout[];
}

export function computeBreakoutProbability(candles: Candle[], currentDrawdown: number): BreakoutProbability {
  const empty: BreakoutProbability = { samples: 0, p_7d: 0, p_30d: 0, p_90d: 0, p_365d: 0, analogs: [] };
  if (candles.length < 200) return empty;

  // ATH на каждый момент времени
  const athAt = new Map<number, number>();
  let runningMax = 0;
  for (const c of candles) {
    if (c.close > runningMax) runningMax = c.close;
    athAt.set(c.time, runningMax);
  }

  // Аналоги: drawdown в пределах ±5% от текущего
  const analogs: AnalogForBreakout[] = [];
  for (let i = 60; i < candles.length - 52; i++) {
    const c = candles[i];
    const ath = athAt.get(c.time)!;
    if (ath <= 0) continue;
    const dd = ((ath - c.close) / ath) * 100;
    if (Math.abs(dd - currentDrawdown) > 5) continue;

    const check = (weeks: number): boolean => {
      const end = Math.min(i + weeks, candles.length - 1);
      for (let j = i + 1; j <= end; j++) {
        if (candles[j].close >= ath) return true;
      }
      return false;
    };

    analogs.push({
      date: new Date(c.time * 1000).toISOString().slice(0, 10),
      price: c.close, ath_at_that_time: ath,
      pct_below_ath: Math.round(dd * 10) / 10,
      broke_within_7d:  check(1),
      broke_within_30d: check(4),
      broke_within_90d: check(13),
      broke_within_365d: check(52),
    });
  }

  const n = analogs.length;
  if (n === 0) return empty;
  return {
    samples: n,
    p_7d:  Math.round(analogs.filter(a => a.broke_within_7d).length  / n * 100),
    p_30d: Math.round(analogs.filter(a => a.broke_within_30d).length / n * 100),
    p_90d: Math.round(analogs.filter(a => a.broke_within_90d).length / n * 100),
    p_365d:Math.round(analogs.filter(a => a.broke_within_365d).length/ n * 100),
    analogs: analogs.slice(-20),
  };
}

// ─── «Этот день в истории» ───

export interface CalendarEntry {
  year: number; date: string; price: number;
  pct_from_year_start: number;
  pct_from_prev_year: number;
  had_ath_nearby: boolean;
}

function dayOfYear(year: number, month: number, day: number): number {
  const d = new Date(year, month - 1, day);
  const s = new Date(year, 0, 1);
  return Math.floor((d.getTime() - s.getTime()) / 86400000);
}

export function computeCalendarComparison(candles: Candle[], month: number, day: number): CalendarEntry[] {
  if (!candles.length) return [];

  const byYear = new Map<number, Candle[]>();
  for (const c of candles) {
    const y = new Date(c.time * 1000).getFullYear();
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(c);
  }

  const out: CalendarEntry[] = [];
  for (const [year, yc] of byYear) {
    const targetDoy = dayOfYear(year, month, day);
    let closest: Candle | null = null, minDiff = Infinity;
    for (const c of yc) {
      const d = new Date(c.time * 1000);
      const diff = Math.abs(dayOfYear(year, d.getMonth() + 1, d.getDate()) - targetDoy);
      if (diff < minDiff) { minDiff = diff; closest = c; }
    }
    if (!closest) continue;

    const pctYear = ((closest.close - yc[0].close) / yc[0].close) * 100;

    let hadAth = false;
    for (const a of HISTORICAL_ATHS) {
      if (!a.date.startsWith(String(year))) continue;
      const aDoy = dayOfYear(year, +a.date.slice(5, 7), +a.date.slice(8, 10));
      if (Math.abs(aDoy - targetDoy) <= 14) { hadAth = true; break; }
    }

    out.push({
      year,
      date: new Date(closest.time * 1000).toISOString().slice(0, 10),
      price: closest.close,
      pct_from_year_start: Math.round(pctYear * 10) / 10,
      pct_from_prev_year: 0,
      had_ath_nearby: hadAth,
    });
  }

  out.sort((a, b) => a.year - b.year);
  for (let i = 1; i < out.length; i++) {
    out[i].pct_from_prev_year = Math.round(((out[i].price - out[i - 1].price) / out[i - 1].price) * 1000) / 10;
  }
  return out;
}