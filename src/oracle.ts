// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · ORACLE ENGINE
// Точный порт из python/oracle.py — память, обучение, риск, analyze
// НЕ ПУТАТЬ с src/ui/oracle.ts (там UI-логика)
// ═══════════════════════════════════════════════════════════════

import { getAdvancedAnalytics } from './market';
import { getMarketContext } from './market';
import { humanizePattern } from './patterns';

// ═══════════════════════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════════════════════

const MEMORY_KEY = 'nebulaMemory';
const PATTERNS_KEY = 'nebulaLearnedPatterns';
const PROFILE_KEY = 'nebulaRiskProfile';

// ═══════════════════════════════════════════════════════════════
// RISK PROFILE
// ═══════════════════════════════════════════════════════════════

export interface RiskProfile {
  level: 'conservative' | 'balanced' | 'aggressive';
  max_risk_per_trade: number;
  max_position_size: number;
  description: string;
}

export function saveRiskProfile(profile: RiskProfile): boolean {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch { return false; }
}

export function loadRiskProfile(): RiskProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function computeRiskProfile(answers: Record<string, string>): RiskProfile {
  let score = 0;
  score += { newbie: 0, mid: 1, pro: 2 }[answers.experience] ?? 0;
  score += { small: 0, mid: 1, large: 2 }[answers.capital] ?? 0;
  score += { low: 0, med: 1, high: 2 }[answers.drawdown] ?? 0;

  if (score <= 2) {
    return {
      level: 'conservative',
      max_risk_per_trade: 0.5,
      max_position_size: 5,
      description: 'Консервативный профиль. Оракул будет предлагать только сильнейшие сигналы и маленькие позиции.',
    };
  } else if (score <= 4) {
    return {
      level: 'balanced',
      max_risk_per_trade: 1.5,
      max_position_size: 15,
      description: 'Сбалансированный профиль. Оракул будет искать баланс между риском и доходностью.',
    };
  } else {
    return {
      level: 'aggressive',
      max_risk_per_trade: 3.0,
      max_position_size: 30,
      description: 'Агрессивный профиль. Оракул готов к более высоким рискам.',
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// ПАМЯТЬ
// ═══════════════════════════════════════════════════════════════

interface MemoryRecord {
  id: string;
  timestamp: number;
  datetime: string;
  ticker: string;
  is_favorite: boolean;
  market_regime: string;
  price_at_analysis: number;
  rsi: number;
  rebound_pct: number;
  drop_pct: number;
  whale_active: boolean;
  whale_trend: string;
  funding_rate: number;
  bids_pct: number;
  min_120: number;
  max_120: number;
  verdict: string;
  score: number;
  confidence: number;
  outcome: string | null;
  mfe_pct: number | null;
  mae_pct: number | null;
  outcome_price: number | null;
  outcome_pct: number | null;
  outcome_checked_at: number | null;
}

interface Memory {
  analyses: MemoryRecord[];
  stats: Record<string, any>;
  version: number;
  created: number;
}

function loadMemory(): Memory {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* silent */ }
  return { analyses: [], stats: {}, version: 2, created: Math.floor(Date.now() / 1000) };
}

export function saveMemory(mem: Memory): boolean {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(mem));
    return true;
  } catch { return false; }
}

function genRecordId(ticker: string): string {
  return `${ticker}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 40);
}

export function oracleSaveAnalysis(
  ticker: string,
  marketData: any,
  verdict: string,
  score: number,
  confidence: number,
  isFavorite = false,
  marketRegime = 'neutral'
): string {
  const mem = loadMemory();
  const recordId = genRecordId(ticker);
  mem.analyses.push({
    id: recordId,
    timestamp: Math.floor(Date.now() / 1000),
    datetime: new Date().toISOString(),
    ticker,
    is_favorite: isFavorite,
    market_regime: marketRegime,
    price_at_analysis: Number(marketData.current_price ?? 0),
    rsi: Number(marketData.rsi ?? 50),
    rebound_pct: Number(marketData.rebound_pct ?? 0),
    drop_pct: Number(marketData.drop_pct ?? 0),
    whale_active: !!marketData.whale_active,
    whale_trend: String(marketData.whale_trend || ''),
    funding_rate: Number(marketData.funding_rate ?? 0),
    bids_pct: Number(marketData.bids_pct ?? 50),
    min_120: Number(marketData.min_120 ?? 0),
    max_120: Number(marketData.max_120 ?? 0),
    verdict,
    score: Number(score),
    confidence: Number(confidence),
    outcome: null,
    mfe_pct: null,
    mae_pct: null,
    outcome_price: null,
    outcome_pct: null,
    outcome_checked_at: null,
  });
  if (mem.analyses.length > 10000) mem.analyses = mem.analyses.slice(-10000);
  mem.stats.total_analyses = (mem.stats.total_analyses ?? 0) + 1;
  mem.stats.last_analysis_at = Math.floor(Date.now() / 1000);
  saveMemory(mem);
  return recordId;
}

// ─── Update outcomes ───

export async function oracleUpdateOutcomes(): Promise<{ updated: number; checked: number }> {
  const mem = loadMemory();
  const now = Date.now() / 1000;
  let updated = 0;
  let checked = 0;

  const pending = mem.analyses.filter(r =>
    r.outcome === null && (now - r.timestamp) / 3600 >= 12
  ).sort((a, b) => a.timestamp - b.timestamp).slice(0, 15);

  for (const rec of pending) {
    checked++;
    try {
      const r = await fetch(
        `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${rec.ticker}_USDT&interval=1h&limit=72`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!r.ok) continue;
      const data: any[] = await r.json();
      const ip = rec.price_at_analysis;
      if (ip <= 0) continue;

      let maxH = ip, minL = ip;
      const cp = parseFloat(data[data.length - 1][2]);
      for (const d of data) {
        if (parseInt(d[0], 10) >= rec.timestamp) {
          const h = parseFloat(d[3]);
          const l = parseFloat(d[4]);
          if (h > maxH) maxH = h;
          if (l < minL) minL = l;
        }
      }

      const mfe = ((maxH - ip) / ip) * 100;
      const mae = ((minL - ip) / ip) * 100;
      rec.mfe_pct = Math.round(mfe * 100) / 100;
      rec.mae_pct = Math.round(mae * 100) / 100;
      rec.outcome_price = cp;
      rec.outcome_pct = Math.round(((cp - ip) / ip) * 100 * 100) / 100;
      rec.outcome_checked_at = Math.floor(now);

      if (mfe >= 10 && Math.abs(mae) < 5) rec.outcome = 'win_big';
      else if (mfe >= 4 && Math.abs(mae) < 4) rec.outcome = 'win';
      else if (mae <= -10) rec.outcome = 'loss_big';
      else if (mae <= -5 && mfe < 3) rec.outcome = 'loss';
      else rec.outcome = 'flat';

      updated++;
    } catch { /* silent */ }
  }

  if (updated > 0) saveMemory(mem);
  return { updated, checked };
}

// ─── Learn patterns ───

export async function oracleLearnPatterns(): Promise<any> {
  const mem = loadMemory();
  const analyses = mem.analyses.filter(a => a.outcome !== null);
  if (analyses.length < 10) {
    return {
      status: 'insufficient',
      message: `Нужно минимум 10 завершённых. Есть: ${analyses.length}`,
      count: analyses.length,
      needed: 10 - analyses.length,
    };
  }

  const keyFor = (rec: MemoryRecord): string => {
    const k: string[] = [rec.market_regime || 'neutral'];
    const r = rec.rsi;
    k.push(
      r < 30 ? 'rsi_oversold' : r < 45 ? 'rsi_low'
      : r < 60 ? 'rsi_mid' : r < 75 ? 'rsi_high' : 'rsi_overbought'
    );
    const wt = (rec.whale_trend || '').toUpperCase();
    if (rec.whale_active) {
      k.push(
        wt.includes('РАСТ') || wt.includes('RISING') ? 'whale_buying'
        : wt.includes('ПАД') || wt.includes('FALLING') ? 'whale_selling'
        : 'whale_active_unknown'
      );
    } else k.push('no_whale');
    const f = rec.funding_rate;
    k.push(f < -0.01 ? 'fund_neg' : f > 0.03 ? 'fund_overlong' : f > 0.01 ? 'fund_pos' : 'fund_neutral');
    const ob = rec.bids_pct;
    k.push(ob > 60 ? 'ob_bull' : ob < 40 ? 'ob_bear' : 'ob_neutral');
    return k.join('|');
  };

  const now = Date.now() / 1000;
  const stats: Record<string, any> = {};
  for (const rec of analyses) {
    const key = keyFor(rec);
    if (!stats[key]) stats[key] = {
      count: 0, weight_sum: 0, wins: 0, losses: 0,
      outcomes: [], mfe_list: [], mae_list: [], avg_score: [],
    };
    const s = stats[key];
    const decay = Math.max(0.2, 1.0 - ((now - rec.timestamp) / 86400 / 60));
    s.count++;
    s.weight_sum += decay;
    s.outcomes.push((rec.outcome_pct ?? 0) * decay);
    s.avg_score.push(rec.score ?? 0);
    if (rec.mfe_pct != null) {
      s.mfe_list.push(rec.mfe_pct * decay);
      s.mae_list.push((rec.mae_pct ?? 0) * decay);
    }
    if (rec.outcome === 'win' || rec.outcome === 'win_big') s.wins += decay;
    else if (rec.outcome === 'loss' || rec.outcome === 'loss_big') s.losses += decay;
  }

  const learned: Record<string, any> = {};
  for (const [k, s] of Object.entries(stats)) {
    if (s.count < 3) continue;
    const wr = (s.wins / s.weight_sum) * 100;
    const avg = s.outcomes.reduce((a: number, b: number) => a + b, 0) / s.weight_sum;
    const asc = s.avg_score.reduce((a: number, b: number) => a + b, 0) / s.avg_score.length;
    const amfe = s.mfe_list.length ? s.mfe_list.reduce((a: number, b: number) => a + b, 0) / s.weight_sum : 0;
    const amae = s.mae_list.length ? s.mae_list.reduce((a: number, b: number) => a + b, 0) / s.weight_sum : 0;
    const w = Math.max(-15, Math.min(15, (wr - 50) * 0.3 + amfe * 0.5 + amae * 0.5));
    learned[k] = {
      count: s.count,
      win_rate: Math.round(wr * 10) / 10,
      avg_outcome_pct: Math.round(avg * 100) / 100,
      avg_score_at_analysis: Math.round(asc * 10) / 10,
      avg_mfe: Math.round(amfe * 100) / 100,
      avg_mae: Math.round(amae * 100) / 100,
      weight: Math.round(w * 10) / 10,
      human_name: humanizePattern(k),
      is_reliable: s.count >= 5,
    };
  }

  try {
    localStorage.setItem(PATTERNS_KEY, JSON.stringify({
      updated_at: Math.floor(now),
      total_completed: analyses.length,
      patterns: learned,
    }));
  } catch { /* silent */ }

  return {
    status: 'success',
    total_completed: analyses.length,
    patterns_count: Object.keys(learned).length,
    patterns: learned,
    learned_at: Math.floor(now),
  };
}

// ═══════════════════════════════════════════════════════════════
// HISTORICAL ANALOGIES (Зеркало истории)
// ═══════════════════════════════════════════════════════════════

export function oracleGetAnalogies(current: any): any {
  const mem = loadMemory();
  // Берем только завершенные анализы, где мы знаем результат
  const completed = mem.analyses.filter(a => a.outcome !== null && a.outcome !== 'flat');

  if (completed.length < 5) {
    return { status: 'empty', message: 'Мало данных (нужно 5+)' };
  }

  let matches = 0;
  let wins = 0;
  let totalReturn = 0;
  const recentMatches: any[] = [];

  const rsi = Number(current.rsi ?? 50);
  const drop = Number(current.drop_pct ?? 0);

  for (const rec of completed) {
    const rsiDiff = Math.abs(rec.rsi - rsi);
    const dropDiff = Math.abs(rec.drop_pct - drop);

    // Ищем ситуации, где RSI был ±10, а падение ±15%
    if (rsiDiff <= 10 && dropDiff <= 15) {
      matches++;
      if (rec.outcome === 'win' || rec.outcome === 'win_big') wins++;
      totalReturn += rec.outcome_pct || 0;

      // Сохраняем первые 5 найденных аналогов для красивого списка
      if (recentMatches.length < 5) {
        recentMatches.push({
          ticker: rec.ticker,
          date: new Date(rec.timestamp * 1000).toLocaleDateString(),
          rsi: Math.round(rec.rsi),
          outcome_pct: rec.outcome_pct,
          is_win: rec.outcome === 'win' || rec.outcome === 'win_big',
        });
      }
    }
  }

  if (matches === 0) {
    return { status: 'empty', message: 'Схожих ситуаций не найдено' };
  }

  return {
    status: 'success',
    matches,
    winRate: Math.round((wins / matches) * 100),
    avgReturn: Math.round((totalReturn / matches) * 100) / 100,
    recentMatches,
  };
}

// ─── Stats ───

export function oracleGetStats(): any {
  const mem = loadMemory();
  const analyses = mem.analyses;
  const completed = analyses.filter(a => a.outcome !== null);
  const wins = completed.filter(a => a.outcome === 'win' || a.outcome === 'win_big');
  const losses = completed.filter(a => a.outcome === 'loss' || a.outcome === 'loss_big');
  const flats = completed.filter(a => a.outcome === 'flat');

  const aw = wins.length ? wins.reduce((s, a) => s + (a.outcome_pct ?? 0), 0) / wins.length : 0;
  const al = losses.length ? losses.reduce((s, a) => s + (a.outcome_pct ?? 0), 0) / losses.length : 0;
  const tp = wins.reduce((s, a) => s + Math.max(0, a.outcome_pct ?? 0), 0);
  const tl = Math.abs(losses.reduce((s, a) => s + Math.min(0, a.outcome_pct ?? 0), 0));
  const pf = tl > 0 ? Math.round(tp / tl * 100) / 100 : 0;

  let patterns: Record<string, any> = {};
  try {
    const raw = localStorage.getItem(PATTERNS_KEY);
    if (raw) patterns = JSON.parse(raw).patterns || {};
  } catch { /* silent */ }

  const reliable = Object.entries(patterns).filter(([, v]: any) => v.is_reliable);
  const top = reliable.sort((a: any, b: any) => b[1].win_rate - a[1].win_rate).slice(0, 5);
  const worst = reliable.sort((a: any, b: any) => a[1].win_rate - b[1].win_rate).slice(0, 5);

  const ms = (() => {
    try { return Math.round((localStorage.getItem(MEMORY_KEY)?.length || 0) / 1024 * 10) / 10; }
    catch { return 0; }
  })();

  const dl = mem.created ? Math.round((Date.now() / 1000 - mem.created) / 86400 * 10) / 10 : 0;

  return {
    status: 'success',
    total_analyses: analyses.length,
    completed_analyses: completed.length,
    pending_outcomes: analyses.length - completed.length,
    wins: wins.length,
    losses: losses.length,
    flats: flats.length,
    win_rate: completed.length ? Math.round(wins.length / completed.length * 1000) / 10 : 0,
    avg_win_pct: Math.round(aw * 100) / 100,
    avg_loss_pct: Math.round(al * 100) / 100,
    profit_factor: pf,
    patterns_count: Object.keys(patterns).length,
    top_patterns: top.map(([k, v]: any) => ({ key: k, name: v.human_name || k, ...v })),
    worst_patterns: worst.map(([k, v]: any) => ({ key: k, name: v.human_name || k, ...v })),
    memory_size_kb: ms,
    days_learning: dl,
    oracle_age_days: dl,
  };
}

export function oracleGetRecent(limit = 5): any[] {
  try {
    const mem = loadMemory();
    const recent = [...mem.analyses].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    // Возвращаем полную запись (со всеми метриками) для Дневника
    return recent.map(a => ({
      ...a,
      ticker: a.ticker || '?',
      score: a.score ?? 0,
      confidence: a.confidence ?? 0,
    }));
  } catch { return []; }
}

export function oracleGetLearnedWeight(marketData: any, marketRegime = 'neutral'): any {
  let patterns: Record<string, any> = {};
  try {
    const raw = localStorage.getItem(PATTERNS_KEY);
    if (raw) patterns = JSON.parse(raw).patterns || {};
  } catch { /* silent */ }

  const r = Number(marketData.rsi ?? 50);
  const rk = r < 30 ? 'rsi_oversold' : r < 45 ? 'rsi_low'
           : r < 60 ? 'rsi_mid' : r < 75 ? 'rsi_high' : 'rsi_overbought';
  const wt = String(marketData.whale_trend || '').toUpperCase();
  const wk = marketData.whale_active
    ? (wt.includes('РАСТ') || wt.includes('RISING') ? 'whale_buying'
       : wt.includes('ПАД') || wt.includes('FALLING') ? 'whale_selling'
       : 'whale_active_unknown')
    : 'no_whale';
  const f = Number(marketData.funding_rate ?? 0);
  const fk = f < -0.01 ? 'fund_neg' : f > 0.03 ? 'fund_overlong' : f > 0.01 ? 'fund_pos' : 'fund_neutral';
  const ob = Number(marketData.bids_pct ?? 50);
  const ok = ob > 60 ? 'ob_bull' : ob < 40 ? 'ob_bear' : 'ob_neutral';

  const cur = [marketRegime, rk, wk, fk, ok].join('|');
  const fb = ['neutral', rk, wk, fk, ok].join('|');

  for (const mk of [cur, fb]) {
    if (patterns[mk] && patterns[mk].is_reliable) {
      const p = patterns[mk];
      return {
        correction: p.weight ?? 0,
        matched_pattern: mk,
        human_name: p.human_name || mk,
        confidence_boost: p.weight ?? 0,
        win_rate: p.win_rate ?? 0,
        sample_size: p.count ?? 0,
        avg_mfe: p.avg_mfe ?? 10,
        avg_mae: p.avg_mae ?? -5,
        exact_match: true,
      };
    }
  }
  return { correction: 0, matched_pattern: null, confidence_boost: 0, avg_mfe: 10, avg_mae: -5 };
}

// ═══════════════════════════════════════════════════════════════
// ORACLE ANALYZE (полная логика скоринга)
// ═══════════════════════════════════════════════════════════════

export interface OracleAnalyzeResult {
  status: 'success' | 'error';
  verdict?: string;
  verdict_text?: string;
  confidence?: number;
  score?: number;
  position_suggestion?: number;
  reasons?: string[];
  warnings?: string[];
  steps?: any[];
  final_reasoning?: string;
  learned_correction?: number;
  learned_pattern?: string;
  market_context?: any;
  advanced?: any;
  dynamic_plan?: { entry: number; take_profit: number; stop_loss: number };
  scenarios?: {
    base: { verdict: string; prob: number };
    bull: { verdict: string; prob: number };
    bear: { verdict: string; prob: number };
  };
  message?: string;
}

function verdictFromScore(s: number): string {
  if (s >= 50) return 'strong_buy';
  if (s >= 25) return 'buy';
  if (s >= -10) return 'hold';
  return 'avoid';
}

export async function oracleAnalyze(
  ticker: string,
  marketData: any,
  onchainData: any,
  riskProfile: RiskProfile | null
): Promise<OracleAnalyzeResult> {
  try {
    const steps: any[] = [];
    const reasons: string[] = [];
    const warnings: string[] = [];

    const price = Number(marketData.current_price ?? 0);
    const rsi = Number(marketData.rsi ?? 50);
    const rebound = Number(marketData.rebound_pct ?? 0);
    const drop = Number(marketData.drop_pct ?? 0);
    const whaleActive = !!marketData.whale_active;
    const whaleTrend = String(marketData.whale_trend || '');
    const funding = Number(marketData.funding_rate ?? 0);
    const bidsPct = Number(marketData.bids_pct ?? 50);
    const profileLevel = riskProfile?.level || 'balanced';
    const maxRisk = riskProfile?.max_risk_per_trade ?? 1.5;

    const adv = await getAdvancedAnalytics(ticker);
    const hasAdv = adv.status === 'success';

    steps.push({
      step: 1, title: 'Технический анализ', icon: '📊',
      thinking: `Проверяю цену ${price.toFixed(4)}...`,
      result: `RSI: ${rsi.toFixed(1)} | Отскок: +${rebound.toFixed(1)}% | Падение: -${drop.toFixed(1)}%`,
    });

    let tech = 0;
    if (rsi < 35) tech += 30;
    else if (rsi < 45) tech += 20;
    else if (rsi < 55) tech += 10;
    else if (rsi > 70) tech -= 30;
    else if (rsi > 60) tech -= 15;

    if (rebound < 15) tech += 20;
    else if (rebound < 30) tech += 10;
    else if (rebound > 70) tech -= 25;

    if (drop > 50) tech += 15;
    else if (drop > 35) tech += 8;

    if (hasAdv) {
      const m = adv.macd;
      if (m.crossover === 'bullish') { tech += 10; reasons.push('MACD бычий'); }
      else if (m.crossover === 'bearish') { tech -= 10; warnings.push('MACD медвежий'); }
      steps.push({
        step: steps.length + 1, title: 'MACD', icon: '📈',
        thinking: 'Анализирую EMA...',
        result: `MACD: ${m.line.toFixed(4)} | Hist: ${m.histogram >= 0 ? '+' : ''}${m.histogram.toFixed(4)} (${m.crossover})`,
      });

      const b = adv.bollinger;
      if (b.state === 'oversold') { tech += 12; reasons.push('Bollinger: цена внизу'); }
      else if (b.state === 'overbought') { tech -= 12; warnings.push('Bollinger: цена вверху'); }
      steps.push({
        step: steps.length + 1, title: 'Bollinger', icon: '📉',
        thinking: 'Канал волатильности...',
        result: `%B: ${(b.percent_b ?? 50).toFixed(1)}% (${b.state})`,
      });

      const a = adv.adx;
      if (a.trend_strength === 'very_strong' && adv.macd.crossover === 'bullish') {
        tech += 8;
        reasons.push(`ADX ${a.value}: сильный тренд вверх`);
      }
      steps.push({
        step: steps.length + 1, title: 'ADX', icon: '⚡',
        thinking: 'Сила тренда...',
        result: `ADX: ${a.value} (${a.trend_strength})`,
      });

      const s = adv.stoch_rsi;
      if (s.state === 'oversold') { tech += 15; reasons.push('Stoch RSI перепродан'); }
      else if (s.state === 'overbought') { tech -= 15; warnings.push('Stoch RSI перекуплен'); }
      steps.push({
        step: steps.length + 1, title: 'Stoch RSI', icon: '🎯',
        thinking: 'Точность...',
        result: `${s.value} (${s.state})`,
      });

      const d = adv.divergence;
      if (d.type === 'bullish') { tech += Math.round(d.strength * 0.3); reasons.push(`🐂 БЫЧЬЯ ДИВЕРГЕНЦИЯ (${d.strength}%)`); }
      else if (d.type === 'bearish') { tech -= Math.round(d.strength * 0.3); warnings.push(`🐻 МЕДВЕЖЬЯ ДИВЕРГЕНЦИЯ (${d.strength}%)`); }
      if (d.type) {
        steps.push({
          step: steps.length + 1, title: 'Дивергенция', icon: '🔀',
          thinking: 'Сравниваю...',
          result: `${String(d.type).toUpperCase()} (${d.strength}%)`,
        });
      }

      const sr = adv.support_resistance;
      if ((sr.nearest_s ?? 0) > 0 && price > 0) {
        const distS = ((price - (sr.nearest_s ?? 0)) / price) * 100;
        if (distS < 3) { tech += 8; reasons.push(`Близко к поддержке (${distS.toFixed(1)}%)`); }
      }
      steps.push({
        step: steps.length + 1, title: 'S/R', icon: '🎚️',
        thinking: 'Уровни...',
        result: `S: ${(sr.nearest_s ?? 0).toFixed(4)} | R: ${(sr.nearest_r ?? 0).toFixed(4)}`,
      });
    }

    steps.push({
      step: steps.length + 1, title: 'Киты', icon: '🐋',
      thinking: 'OBV...',
      result: `Аномалия: ${whaleActive ? 'ДА' : 'нет'} | OBV: ${whaleTrend}`,
    });

    let ws = 0;
    if (whaleActive && whaleTrend.toUpperCase().includes('РАСТ')) { ws = 25; reasons.push('Киты скупают'); }
    else if (whaleActive && whaleTrend.toUpperCase().includes('ПАД')) { ws = -20; warnings.push('Возможно распределение'); }
    else if (whaleTrend.toUpperCase().includes('РАСТ')) { ws = 12; }

    steps.push({
      step: steps.length + 1, title: 'Стакан', icon: '⚖️',
      thinking: 'Bids/Asks + funding...',
      result: `Покупки: ${bidsPct.toFixed(0)}% | Funding: ${funding >= 0 ? '+' : ''}${funding.toFixed(4)}%`,
    });

    let obs = 0;
    if (bidsPct > 60) { obs += 15; reasons.push('Стакан защищён'); }
    else if (bidsPct < 40) { obs -= 20; warnings.push('Давят сверху'); }

    let fs = 0;
    if (funding < -0.01) { fs = 10; reasons.push('Short squeeze потенциал'); }
    else if (funding > 0.03) { fs = -10; warnings.push('Эйфория'); }

    let man = 0;
    if (drop > 5 || rsi < 50) {
      if (whaleActive && whaleTrend.toUpperCase().includes('РАСТ') && bidsPct >= 55) {
        man = 25; reasons.push('Искусственный сброс');
      } else if (whaleActive && whaleTrend.toUpperCase().includes('ПАД') && bidsPct <= 45) {
        man = -30; warnings.push('Реальное распределение');
      }
    }

    let oc = 0;
    if (onchainData && onchainData.status === 'success') {
      const pools = onchainData.pools || [];
      if (pools.length) {
        const liq = pools[0].liquidity ?? 0;
        const vol = pools[0].volume_24h ?? 0;
        const ratio = liq > 0 ? vol / liq : 0;
        if (ratio > 0.5) { oc = 15; reasons.push('Активная торговля'); }
        else if (ratio < 0.05) { oc = -10; warnings.push('Низкая активность'); }
      }
    }

    let aggr = 0;
    let regime = 'neutral';
    let mctx: any = {};
    try {
      mctx = await getMarketContext();
      regime = mctx.regime || 'neutral';
      aggr = mctx.status === 'success' ? (mctx.aggression_modifier ?? 0) : 0;
    } catch { /* silent */ }

    const learned = oracleGetLearnedWeight(marketData, regime);
    const lc = learned.confidence_boost ?? 0;
    const emfe = learned.avg_mfe ?? 10;
    const emae = learned.avg_mae ?? -5;

    const total = tech + ws + obs + fs + oc + lc + man + Math.round(aggr * 15);
    const conf = Math.min(95, Math.max(20, 50 + total));

    let verdict: string;
    if (total >= 50) verdict = 'strong_buy';
    else if (total >= 25) verdict = 'buy';
    else if (total >= -10) verdict = 'hold';
    else verdict = 'avoid';

    let pos = 0;
    if (verdict === 'buy' || verdict === 'strong_buy') {
      pos = Math.min(
        { conservative: 5, balanced: 15, aggressive: 25 }[profileLevel] ?? 15,
        maxRisk * 5
      );
      if (conf < 55) pos *= 0.4;
      pos = Math.round(pos * 10) / 10;
    }

    const vt = {
      strong_buy: '🟢 СИЛЬНЫЙ СИГНАЛ',
      buy: '🟢 УМЕРЕННЫЙ СИГНАЛ',
      hold: '⚖️ ЖДАТЬ',
      avoid: '🔴 ИЗБЕГАТЬ',
    }[verdict];

    const se = price * (1 + (emae * 0.5) / 100);
    const stp = price * (1 + (emfe * 0.7) / 100);
    const sst = price * (1 + (emae * 1.5) / 100);

      let fr = `Скор: ${total}/100. `;
    if (lc !== 0) fr += `Память: ${lc >= 0 ? '+' : ''}${lc.toFixed(1)}. `;
    if (aggr !== 0) fr += `Контекст: ${Math.round(aggr * 15) >= 0 ? '+' : ''}${Math.round(aggr * 15)}. `;
    if (verdict === 'buy' || verdict === 'strong_buy') fr += `Войти на ${pos}% депозита.`;
    else if (verdict === 'hold') fr += 'Сигнал смешанный.';
    else fr += 'Риск превышает потенциал.';

    // ─── Трёхсценарный вердикт ───
    const bullVerdict = verdictFromScore(total + 20);
    const bearVerdict = verdictFromScore(total - 20);

    const cf = Math.max(0, Math.min(1, (conf - 50) / 45));
    let bullProb = 30;
    let bearProb = 30;
    if (total >= 25) {
      bullProb = 45 + Math.round(cf * 20);
      bearProb = 15;
    } else if (total >= 0) {
      bullProb = 30 + Math.round(cf * 15);
      bearProb = 25;
    } else if (total >= -10) {
      bullProb = 25;
      bearProb = 30 + Math.round(cf * 15);
    } else {
      bullProb = 15;
      bearProb = 45 + Math.round(cf * 20);
    }
    const baseProb = Math.max(10, 100 - bullProb - bearProb);

    try { oracleSaveAnalysis(ticker, marketData, verdict, total, conf, false, regime); } catch { /* silent */ }

    return {
      status: 'success',
      verdict,
      verdict_text: vt,
      confidence: conf,
      score: total,
      position_suggestion: pos,
      reasons,
      warnings,
      steps,
      final_reasoning: fr,
      learned_correction: lc,
      learned_pattern: learned.human_name,
      market_context: {
        regime,
        desc: mctx.regime_desc || '',
        fear_greed: mctx.fear_greed ?? '?',
      },
      advanced: hasAdv ? adv : undefined,
      dynamic_plan: { entry: se, take_profit: stp, stop_loss: sst },
      scenarios: {
        base: { verdict, prob: baseProb },
        bull: { verdict: bullVerdict, prob: bullProb },
        bear: { verdict: bearVerdict, prob: bearProb },
      },
    };
  } catch (e: any) {
    return { status: 'error', message: String(e?.message || e) };
  }
}

// ═══════════════════════════════════════════════════════════════
// Экспорт в window (для inline-обработчиков)
// ═══════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  Object.assign(window as any, {
    oracleGetStats,
    oracleGetRecent,
    oracleUpdateOutcomes,
    oracleLearnPatterns,
    oracleGetAnalogies,
  });
}