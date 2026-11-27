// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · HABITS & SEASONALITY ENGINE (3M / 6M + RECORDER .JSONL)
// Поиск повторяющихся временных окон и паттернов движения за 3 и 6 месяцев
// ═══════════════════════════════════════════════════════════════

import type { Candle } from './sources/candles';
import { fetchDeepCandles1h } from './sources/candles';
import { db } from './db';

export type HabitWindowMonths = 3 | 6;

export interface TimeSlotStat {
  key: number;            // 0..23 для часа, 0..6 для дня недели (0 = Вс)
  label: string;          // например "18:00–19:00" или "Ср"
  samples: number;        // сколько раз встречалось окно
  upCount: number;        // закрытий в плюс
  downCount: number;      // закрытий в минус
  upWinRate: number;      // % зелёных закрытий
  downWinRate: number;    // % красных закрытий
  avgMovePct: number;     // среднее изменение close-to-close в %
  avgRangePct: number;    // средний размах (high-low)/low в %
  bias: 'bull' | 'bear' | 'neutral';
  consistentWithOtherWindow: boolean; // подтверждено ли на втором горизонте (3м/6м)
}

export interface ImpulseFollowStat {
  id: string;
  title: string;
  description: string;
  samples: number;
  bounceWinRate4h: number; // % случаев с положительным исходом через 4ч
  avgReturn1h: number;
  avgReturn4h: number;
  avgReturn12h: number;
  maxDrawdown4h: number;
}

export interface RecorderPoint {
  ts: string;
  symbol?: string;
  price: number;
  stepPct?: number;
  high?: number;
  low?: number;
  spreadPct?: number;
  imbalance?: number;
  vol24hQuote?: number;
  note?: string;
}

export interface RecorderStatsSummary {
  pointsCount: number;
  symbols: string[];
  lastImportedAt: number;
  moveCount: number;
  avgSpreadPct: number;
  avgImbalance: number;
  bullImbalanceFollowPct: number; // доля move вверх при imbalance > 0.1
}

export interface HabitsReport {
  ticker: string;
  months: HabitWindowMonths;
  candlesCount: number;
  periodStartIso: string;
  periodEndIso: string;
  currentHour: number;
  currentHourStat: TimeSlotStat | null;
  topBullHours: TimeSlotStat[];
  topBearHours: TimeSlotStat[];
  topDays: TimeSlotStat[];
  impulses: ImpulseFollowStat[];
  recorderSummary: RecorderStatsSummary | null;
}

const RECORDER_DB_KEY = 'nebula_recorder_jsonl_v1';
const DAY_NAMES_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function sliceByMonths(candles: Candle[], months: HabitWindowMonths): Candle[] {
  if (!candles.length) return [];
  const days = months === 6 ? 180 : 90;
  const maxBars = Math.min(candles.length, days * 24);
  return candles.slice(-maxBars);
}

function formatHourRange(hour: number): string {
  const h1 = String(hour).padStart(2, '0');
  const h2 = String((hour + 1) % 24).padStart(2, '0');
  return `${h1}:00–${h2}:00`;
}

function buildHourlyStats(candles: Candle[], otherMap?: Map<number, TimeSlotStat>): TimeSlotStat[] {
  const buckets = Array.from({ length: 24 }, () => ({
    samples: 0,
    upCount: 0,
    downCount: 0,
    sumRet: 0,
    sumRange: 0,
  }));

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    if (!prev.close || prev.close <= 0) continue;

    const d = new Date(cur.time * 1000);
    const h = d.getHours();
    const retPct = ((cur.close - prev.close) / prev.close) * 100;
    const rangePct = cur.low > 0 ? ((cur.high - cur.low) / cur.low) * 100 : 0;

    const b = buckets[h];
    b.samples++;
    if (retPct > 0.02) b.upCount++;
    else if (retPct < -0.02) b.downCount++;
    b.sumRet += retPct;
    b.sumRange += rangePct;
  }

  return buckets.map((b, hour) => {
    const upWinRate = b.samples > 0 ? Math.round((b.upCount / b.samples) * 1000) / 10 : 0;
    const downWinRate = b.samples > 0 ? Math.round((b.downCount / b.samples) * 1000) / 10 : 0;
    const avgMovePct = b.samples > 0 ? Math.round((b.sumRet / b.samples) * 1000) / 1000 : 0;
    const avgRangePct = b.samples > 0 ? Math.round((b.sumRange / b.samples) * 100) / 100 : 0;

    let bias: 'bull' | 'bear' | 'neutral' = 'neutral';
    if (b.samples >= 10 && upWinRate >= 58 && avgMovePct > 0) bias = 'bull';
    else if (b.samples >= 10 && downWinRate >= 58 && avgMovePct < 0) bias = 'bear';

    const other = otherMap?.get(hour);
    const consistentWithOtherWindow = Boolean(
      other &&
      other.bias !== 'neutral' &&
      other.bias === bias &&
      Math.abs(other.upWinRate - upWinRate) <= 15
    );

    return {
      key: hour,
      label: formatHourRange(hour),
      samples: b.samples,
      upCount: b.upCount,
      downCount: b.downCount,
      upWinRate,
      downWinRate,
      avgMovePct,
      avgRangePct,
      bias,
      consistentWithOtherWindow,
    };
  });
}

function buildWeekdayStats(candles: Candle[], isEn: boolean): TimeSlotStat[] {
  const buckets = Array.from({ length: 7 }, () => ({
    samples: 0,
    upCount: 0,
    downCount: 0,
    sumRet: 0,
    sumRange: 0,
  }));

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    if (!prev.close || prev.close <= 0) continue;

    const wd = new Date(cur.time * 1000).getDay();
    const retPct = ((cur.close - prev.close) / prev.close) * 100;
    const rangePct = cur.low > 0 ? ((cur.high - cur.low) / cur.low) * 100 : 0;

    const b = buckets[wd];
    b.samples++;
    if (retPct > 0.02) b.upCount++;
    else if (retPct < -0.02) b.downCount++;
    b.sumRet += retPct;
    b.sumRange += rangePct;
  }

  const names = isEn ? DAY_NAMES_EN : DAY_NAMES_RU;
  return buckets
    .map((b, day) => {
      const upWinRate = b.samples > 0 ? Math.round((b.upCount / b.samples) * 1000) / 10 : 0;
      const downWinRate = b.samples > 0 ? Math.round((b.downCount / b.samples) * 1000) / 10 : 0;
      const avgMovePct = b.samples > 0 ? Math.round((b.sumRet / b.samples) * 1000) / 1000 : 0;
      const avgRangePct = b.samples > 0 ? Math.round((b.sumRange / b.samples) * 100) / 100 : 0;
      const bias: 'bull' | 'bear' | 'neutral' =
        b.samples >= 5 && upWinRate >= 56 ? 'bull' : b.samples >= 5 && downWinRate >= 56 ? 'bear' : 'neutral';

      return {
        key: day,
        label: names[day],
        samples: b.samples,
        upCount: b.upCount,
        downCount: b.downCount,
        upWinRate,
        downWinRate,
        avgMovePct,
        avgRangePct,
        bias,
        consistentWithOtherWindow: false,
      };
    })
    .filter(s => s.samples > 0)
    .sort((a, b) => Math.max(b.upWinRate, b.downWinRate) - Math.max(a.upWinRate, a.downWinRate));
}

function buildImpulseStats(candles: Candle[], isEn: boolean): ImpulseFollowStat[] {
  const out: ImpulseFollowStat[] = [];
  if (candles.length < 30) return out;

  const evalForward = (indices: number[], id: string, title: string, description: string): ImpulseFollowStat | null => {
    const valid = indices.filter(idx => idx >= 0 && idx + 12 < candles.length);
    if (valid.length < 4) return null;

    let ret1Sum = 0;
    let ret4Sum = 0;
    let ret12Sum = 0;
    let dd4Sum = 0;
    let win4 = 0;

    for (const idx of valid) {
      const baseP = candles[idx].close;
      if (!baseP || baseP <= 0) continue;

      const p1 = candles[idx + 1].close;
      const p4 = candles[idx + 4].close;
      const p12 = candles[idx + 12].close;

      let min4 = baseP;
      for (let k = idx + 1; k <= idx + 4; k++) {
        if (candles[k].low < min4) min4 = candles[k].low;
      }

      const r1 = ((p1 - baseP) / baseP) * 100;
      const r4 = ((p4 - baseP) / baseP) * 100;
      const r12 = ((p12 - baseP) / baseP) * 100;
      const dd4 = ((min4 - baseP) / baseP) * 100;

      ret1Sum += r1;
      ret4Sum += r4;
      ret12Sum += r12;
      dd4Sum += dd4;
      if (r4 > 0) win4++;
    }

    const n = valid.length;
    return {
      id,
      title,
      description,
      samples: n,
      bounceWinRate4h: Math.round((win4 / n) * 1000) / 10,
      avgReturn1h: Math.round((ret1Sum / n) * 100) / 100,
      avgReturn4h: Math.round((ret4Sum / n) * 100) / 100,
      avgReturn12h: Math.round((ret12Sum / n) * 100) / 100,
      maxDrawdown4h: Math.round((dd4Sum / n) * 100) / 100,
    };
  };

  const dropIndices: number[] = [];
  const surgeIndices: number[] = [];

  for (let i = 24; i < candles.length - 12; i++) {
    const pNow = candles[i].close;
    const p3hAgo = candles[i - 3].close;
    if (p3hAgo > 0) {
      const drop3h = ((pNow - p3hAgo) / p3hAgo) * 100;
      if (drop3h <= -2.5) dropIndices.push(i);
    }

    const avgVol20 = candles.slice(i - 20, i).reduce((s, c) => s + (c.volume || 0), 0) / 20;
    const curVol = candles[i].volume || 0;
    if (avgVol20 > 0 && curVol >= avgVol20 * 1.8 && candles[i].close >= candles[i].open) {
      surgeIndices.push(i);
    }
  }

  const dropStat = evalForward(
    dropIndices,
    'drop_3h_2_5',
    isEn ? 'After -2.5%+ 3h drop' : 'После пролива ≥ -2.5% за 3ч',
    isEn ? 'Rebound probability & forward return over 1h/4h/12h' : 'Шанс отскока и средний ход через 1ч / 4ч / 12ч'
  );
  if (dropStat) out.push(dropStat);

  const surgeStat = evalForward(
    surgeIndices,
    'vol_surge_1_8x',
    isEn ? 'After 1.8x+ green volume spike' : 'После всплеска объёма ≥ 1.8x (зелёная)',
    isEn ? 'Continuation vs pullback after volume anomaly' : 'Продолжение импульса или откат после всплеска'
  );
  if (surgeStat) out.push(surgeStat);

  return out;
}

// ─── ИМПОРТ И АНАЛИЗ .JSONL ОТ NEBULA RECORDER ───

export async function importRecorderJsonlText(rawText: string): Promise<RecorderStatsSummary> {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const parsed: RecorderPoint[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj.price === 'number' && Number.isFinite(obj.price)) {
        parsed.push({
          ts: String(obj.ts || ''),
          symbol: obj.symbol ? String(obj.symbol).toUpperCase() : undefined,
          price: Number(obj.price),
          stepPct: obj.stepPct != null ? Number(obj.stepPct) : undefined,
          high: obj.high != null ? Number(obj.high) : undefined,
          low: obj.low != null ? Number(obj.low) : undefined,
          spreadPct: obj.spreadPct != null ? Number(obj.spreadPct) : undefined,
          imbalance: obj.imbalance != null ? Number(obj.imbalance) : undefined,
          vol24hQuote: obj.vol24hQuote != null ? Number(obj.vol24hQuote) : undefined,
          note: obj.note ? String(obj.note) : undefined,
        });
      }
    } catch {
      // пропускаем битые строки
    }
  }

  const existing = (await db.get<RecorderPoint[]>(RECORDER_DB_KEY, 'meta')) || [];
  const merged = existing.concat(parsed).slice(-5000);
  await db.set(RECORDER_DB_KEY, merged, 'meta');

  return (
    summarizeRecorderPoints(merged) || {
      pointsCount: 0,
      symbols: [],
      lastImportedAt: Date.now(),
      moveCount: 0,
      avgSpreadPct: 0,
      avgImbalance: 0,
      bullImbalanceFollowPct: 0,
    }
  );
}

export function summarizeRecorderPoints(points: RecorderPoint[] | null): RecorderStatsSummary | null {
  if (!points || !points.length) return null;

  const symbols = Array.from(new Set(points.map(p => p.symbol).filter(Boolean) as string[]));
  const movePoints = points.filter(p => p.note === 'move');
  const spreads = points.map(p => p.spreadPct).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const imbalances = points.map(p => p.imbalance).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  let imbMoveTotal = 0;
  let imbMoveUp = 0;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (typeof prev.imbalance === 'number' && prev.imbalance > 0.1 && cur.price > 0 && prev.price > 0) {
      imbMoveTotal++;
      if (cur.price > prev.price) imbMoveUp++;
    }
  }

  return {
    pointsCount: points.length,
    symbols,
    lastImportedAt: Date.now(),
    moveCount: movePoints.length,
    avgSpreadPct: spreads.length ? Math.round((spreads.reduce((a, b) => a + b, 0) / spreads.length) * 10000) / 10000 : 0,
    avgImbalance: imbalances.length ? Math.round((imbalances.reduce((a, b) => a + b, 0) / imbalances.length) * 10000) / 10000 : 0,
    bullImbalanceFollowPct: imbMoveTotal > 0 ? Math.round((imbMoveUp / imbMoveTotal) * 1000) / 10 : 0,
  };
}

export async function getSavedRecorderSummary(): Promise<RecorderStatsSummary | null> {
  try {
    const pts = await db.get<RecorderPoint[]>(RECORDER_DB_KEY, 'meta');
    return summarizeRecorderPoints(pts);
  } catch {
    return null;
  }
}

export async function clearSavedRecorderData(): Promise<void> {
  await db.del(RECORDER_DB_KEY, 'meta');
}

export async function computeHabitsReport(
  ticker: string,
  months: HabitWindowMonths = 6,
  isEn = false
): Promise<HabitsReport> {
  const sym = (ticker || 'DASH').toUpperCase().trim();
  const full1h = await fetchDeepCandles1h(sym, 180);

  const primaryCandles = sliceByMonths(full1h, months);
  const secondaryMonths: HabitWindowMonths = months === 6 ? 3 : 6;
  const secondaryCandles = sliceByMonths(full1h, secondaryMonths);

  const secondaryHourly = buildHourlyStats(secondaryCandles);
  const secondaryMap = new Map<number, TimeSlotStat>(secondaryHourly.map(s => [s.key, s]));
  const hourly = buildHourlyStats(primaryCandles, secondaryMap);

  const bullHours = hourly
    .filter(h => h.samples >= 8 && h.avgMovePct > 0)
    .sort((a, b) => (b.upWinRate - a.upWinRate) || (b.avgMovePct - a.avgMovePct))
    .slice(0, 4);

  const bearHours = hourly
    .filter(h => h.samples >= 8 && h.avgMovePct < 0)
    .sort((a, b) => (b.downWinRate - a.downWinRate) || (a.avgMovePct - b.avgMovePct))
    .slice(0, 4);

  const topDays = buildWeekdayStats(primaryCandles, isEn).slice(0, 3);
  const impulses = buildImpulseStats(primaryCandles, isEn);
  const recorderSummary = await getSavedRecorderSummary();

  const currentHour = new Date().getHours();
  const currentHourStat = hourly.find(h => h.key === currentHour) || null;

  const firstSec = primaryCandles[0]?.time || Math.floor(Date.now() / 1000);
  const lastSec = primaryCandles[primaryCandles.length - 1]?.time || Math.floor(Date.now() / 1000);

  return {
    ticker: sym,
    months,
    candlesCount: primaryCandles.length,
    periodStartIso: new Date(firstSec * 1000).toISOString().slice(0, 10),
    periodEndIso: new Date(lastSec * 1000).toISOString().slice(0, 10),
    currentHour,
    currentHourStat,
    topBullHours: bullHours,
    topBearHours: bearHours,
    topDays,
    impulses,
    recorderSummary,
  };
}