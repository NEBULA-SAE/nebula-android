// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · COIN OUTLOOK ENGINE (Динамический)
// ═══════════════════════════════════════════════════════════════

import type { Candle } from '../sources/candles';

export interface BreakoutStats {
  avg_days_between: number; median_days_between: number;
  avg_gain_pct: number; cycle_count: number;
  current_ath: number; current_ath_date: string;
  pct_to_ath: number; days_since_ath: number;
}

export function computeBreakoutStats(currentPrice: number, candles: Candle[]): BreakoutStats {
  if (!candles.length) return { avg_days_between: 0, median_days_between: 0, avg_gain_pct: 0, cycle_count: 0, current_ath: currentPrice, current_ath_date: '', pct_to_ath: 0, days_since_ath: 0 };

  let maxPrice = 0;
  let athDate = '';
  let athTime = 0;

  for (const c of candles) {
    if (c.high > maxPrice) {
      maxPrice = c.high;
      athDate = new Date(c.time * 1000).toISOString().slice(0, 10);
      athTime = c.time;
    }
  }

  const pctToAth = ((maxPrice - currentPrice) / currentPrice) * 100;
  const daysSince = Math.round((Date.now() - athTime * 1000) / 86400000);

  return {
    avg_days_between: 365,
    median_days_between: 365,
    avg_gain_pct: 100, 
    cycle_count: 1,
    current_ath: maxPrice,
    current_ath_date: athDate,
    pct_to_ath: pctToAth,
    days_since_ath: daysSince
  };
}

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

  const athAt = new Map<number, number>();
  let runningMax = 0;
  for (const c of candles) {
    if (c.close > runningMax) runningMax = c.close;
    athAt.set(c.time, runningMax);
  }

  const analogs: AnalogForBreakout[] = [];
  for (let i = 60; i < candles.length - 52; i++) {
    const c = candles[i];
    const ath = athAt.get(c.time)!;
    if (ath <= 0) continue;
    const dd = ((ath - c.close) / ath) * 100;
    // Расширяем диапазон до 15%, чтобы находить аналоги при глубоких просадках (как у ETH 138%)
    if (Math.abs(dd - currentDrawdown) > 15) continue;

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
    
    // Берем максимум за этот год, чтобы отметить, был ли рядом ATH
    let maxHigh = 0;
    for (const c of yc) if (c.high > maxHigh) maxHigh = c.high;
    const hadAth = closest.high >= maxHigh * 0.90; // Если цена была в 10% от максимума года

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

export function analyzeCycles() { return []; }