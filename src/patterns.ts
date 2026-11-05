// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · PATTERNS
// Точный порт из python/patterns.py
// ═══════════════════════════════════════════════════════════════

import { tm } from './i18n';

export interface PatternRule {
  rsi_max?: number;
  rsi_min?: number;
  drop_pct_min?: number;
  rebound_pct_min?: number;
  funding_min?: number;
  funding_max?: number; // НОВОЕ
  bids_pct_min?: number;
  bids_pct_max?: number;
  oi_trend?: string[];
  whale_active?: boolean;
  whale_trend_contains?: string[];
  bb_oversold?: boolean;
  bb_bandwidth_max?: number;
  divergence?: string;
  lsr_top_gt_global_by?: number;
  macd_bull?: boolean; // НОВОЕ (для Золотого креста)
  breakout_high?: boolean; // НОВОЕ (для пробоя)
}

export interface PatternDef {
  id: string;
  name: string;
  desc: string;
  rules: PatternRule;
  action: string;
  bias: 'bullish' | 'bearish' | 'neutral';
}

export interface PatternMatch {
  id: string;
  name: string;
  desc: string;
  action: string;
  confidence: number;
}

export const PATTERNS_DB: PatternDef[] = [
  {
    id: 'capitulation_short_squeeze',
    name: 'Капитуляция → шорт-сквиз',
    desc: 'Розница паникует и продаёт, но Open Interest растёт при положительном funding — крупный игрок набирает в шорт-ловушку.',
    rules: { rsi_max: 32, drop_pct_min: 25, oi_trend: ['rising'], funding_min: 0.005 },
    action: 'Лонг на отскоке от поддержки. Стоп под локальный минимум. Цель +8–15%.',
    bias: 'bullish',
  },
  {
    id: 'wyckoff_spring',
    name: 'Wyckoff Spring (ложный пробой вниз)',
    desc: 'Цена пробивает поддержку, но быстро возвращается — крупный игрок собрал стопы и набирает позицию.',
    rules: { rsi_max: 40, bb_oversold: true, bids_pct_min: 55 },
    action: 'Лонг после возврата выше пробитого уровня. Стоп под минимумом ложного пробоя.',
    bias: 'bullish',
  },
  {
    id: 'long_squeeze',
    name: 'Long Squeeze (каскад ликвидаций лонгов)',
    desc: 'Перегрев лонгов, funding высокий, OI падает — начинается каскад ликвидаций.',
    rules: { rsi_min: 65, funding_min: 0.03, oi_trend: ['falling'] },
    action: 'Шорт или ожидание в стороне. Лонги в этой зоне — русская рулетка.',
    bias: 'bearish',
  },
  {
    id: 'bearish_divergence_top',
    name: 'Медвежья дивергенция на вершине',
    desc: 'Цена делает новый максимум, RSI — нет. Скрытый сигнал разворота.',
    rules: { divergence: 'bearish', rsi_min: 55, rebound_pct_min: 60 },
    action: 'Фиксировать прибыль. Шорт только после подтверждения (пробой поддержки).',
    bias: 'bearish',
  },
  {
    id: 'bullish_divergence_bottom',
    name: 'Бычья дивергенция на дне',
    desc: 'Цена делает новый минимум, RSI — нет. Скрытый сигнал разворота вверх.',
    rules: { divergence: 'bullish', rsi_max: 40 },
    action: 'Искать лонг с подтверждением на объёме. Стоп под локальный минимум.',
    bias: 'bullish',
  },
  {
    id: 'whale_distribution',
    name: 'Распределение китов',
    desc: 'Цена падает, OBV падает, стакан слабый снизу — крупный игрок сбрасывает позицию.',
    rules: { whale_active: true, whale_trend_contains: ['ПАД', 'FALLING'], bids_pct_max: 45 },
    action: 'Не покупать. Ждать смены структуры рынка.',
    bias: 'bearish',
  },
  {
    id: 'lsr_top_long_crowd_short',
    name: 'LSR-дивергенция (топы в лонге, толпа в шорте)',
    desc: 'Топ-трейдеры набирают лонг, толпа шортит. Классический конфлюенс для отскока.',
    rules: { lsr_top_gt_global_by: 0.15, rsi_max: 45 },
    action: 'Лонг с усиленным бустом Whale Score. Цель — зона POC.',
    bias: 'bullish',
  },
  {
    id: 'bollinger_squeeze',
    name: 'Bollinger Squeeze',
    desc: 'Сжатие полос Боллинджера — волатильность на минимуме, скоро резкий выброс.',
    rules: { bb_bandwidth_max: 4.0 },
    action: 'Ждать пробоя в любую сторону, торговать по направлению пробоя.',
    bias: 'neutral',
  },
  // ─── НОВЫЕ ПАТТЕРНЫ НА ВХОД В ТРЕНД ───
  {
    id: 'golden_cross_momentum',
    name: 'Золотой крест (EMA 20 > EMA 50)',
    desc: 'Краткосрочная скользящая средняя пересекла долгосрочную вверх на фоне роста объема. Начало бычьего тренда.',
    rules: { macd_bull: true, rsi_max: 65, oi_trend: ['rising'] },
    action: 'Покупать на коррекции к EMA 20. Стоп под EMA 50. Цель — новый локальный максимум.',
    bias: 'bullish',
  },
  {
    id: 'breakout_volume_surge',
    name: 'Пробой максимума на объеме',
    desc: 'Цена пробила 120-дневный максимум с аномальным объемом. Крупный капитал толкает цену вверх.',
    rules: { breakout_high: true, whale_active: true, rsi_max: 75 },
    action: 'Вход по рынку или на ретесте пробитого уровня. Стоп под зоной пробоя.',
    bias: 'bullish',
  },
  {
    id: 'whale_accumulation_trend',
    name: 'Накопление китов в тренде',
    desc: 'Цена растет, но фандинг нейтральный (толпа не верит), при этом OBV китов и открытый интерес растут. Умные деньги набирают позицию.',
    rules: { whale_active: true, oi_trend: ['rising'], funding_min: -0.01, funding_max: 0.02 },
    action: 'Искать лонг на откатах. Цель — продолжение тренда.',
    bias: 'bullish',
  },
];

export function matchPatterns(
  marketData: any,
  advanced: any = {},
  whaleData: any = {}
): PatternMatch[] {
  if (!marketData || typeof marketData !== 'object') return [];

  const adv = advanced || {};
  const wh = whaleData || {};

  const rsi = Number(marketData.rsi ?? 50);
  const dropPct = Number(marketData.drop_pct ?? 0);
  const reboundPct = Number(marketData.rebound_pct ?? 0);
  const funding = Number(marketData.funding_rate ?? 0);
  const bidsPct = Number(marketData.bids_pct ?? 50);
  const whaleActive = !!marketData.whale_active;
  const whaleTrend = String(marketData.whale_trend || '').toUpperCase();

  const oiTrend = String(wh.oi_trend || '').toLowerCase();
  const lsrTop = wh.lsr_top_accounts ?? wh.lsr_top_positions;
  const lsrGlobal = wh.lsr_global;

  const bb = adv.bollinger || {};
  const bbState = bb.state || 'normal';
  const bbBandwidth = Number(bb.bandwidth ?? 10);
  const div = adv.divergence || {};
  const divType = div.type;

  const matches: PatternMatch[] = [];

  for (const p of PATTERNS_DB) {
    const rules = p.rules;
    const total = Object.keys(rules).length;
    if (total === 0) continue;
    let ok = true;

    if (rules.rsi_max != null && !(rsi <= rules.rsi_max)) ok = false;
    if (rules.rsi_min != null && !(rsi >= rules.rsi_min)) ok = false;
    if (rules.drop_pct_min != null && !(dropPct >= rules.drop_pct_min)) ok = false;
    if (rules.rebound_pct_min != null && !(reboundPct >= rules.rebound_pct_min)) ok = false;
    if (rules.funding_min != null && !(funding >= rules.funding_min)) ok = false;
    if (rules.funding_max != null && !(funding <= rules.funding_max)) ok = false;
    if (rules.bids_pct_min != null && !(bidsPct >= rules.bids_pct_min)) ok = false;
    if (rules.bids_pct_max != null && !(bidsPct <= rules.bids_pct_max)) ok = false;
    if (rules.oi_trend && !rules.oi_trend.includes(oiTrend)) ok = false;
    if (rules.whale_active != null && whaleActive !== rules.whale_active) ok = false;
    if (rules.whale_trend_contains) {
      if (!rules.whale_trend_contains.some(x => whaleTrend.includes(x.toUpperCase()))) ok = false;
    }
    if (rules.bb_oversold != null) {
      if ((bbState === 'oversold') !== rules.bb_oversold) ok = false;
    }
    if (rules.bb_bandwidth_max != null && !(bbBandwidth <= rules.bb_bandwidth_max)) ok = false;
    if (rules.divergence && divType !== rules.divergence) ok = false;
    if (rules.lsr_top_gt_global_by != null) {
      if (!(lsrTop && lsrGlobal && (lsrTop - lsrGlobal) >= rules.lsr_top_gt_global_by)) ok = false;
    }
    // НОВЫЕ ПРОВЕРКИ
    if (rules.macd_bull != null) {
      const isMacdBull = adv.macd?.crossover === 'bullish';
      if (isMacdBull !== rules.macd_bull) ok = false;
    }
    if (rules.breakout_high != null) {
      const max120 = Number(marketData.max_120 ?? 0);
      const price = Number(marketData.current_price ?? 0);
      const isBreakout = max120 > 0 && price >= max120 * 0.98;
      if (isBreakout !== rules.breakout_high) ok = false;
    }

    if (ok) {
      matches.push({
        id: p.id,
        name: p.name,
        desc: p.desc,
        action: p.action,
        confidence: 100,
      });
    }
  }

  return matches.slice(0, 3);
}

// ─── Humanize pattern key (для UI обучения) ───

const HUMANIZE_MAP: Record<string, string> = {
  bull_btc: 'pat_bull_btc', altseason: 'pat_altseason', bearish: 'pat_bearish',
  bull_mild: 'pat_bull_mild', bear_mild: 'pat_bear_mild', neutral: 'pat_neutral',
  rsi_oversold: 'pat_rsi_oversold', rsi_low: 'pat_rsi_low', rsi_mid: 'pat_rsi_mid',
  rsi_high: 'pat_rsi_high', rsi_overbought: 'pat_rsi_overbought',
  whale_buying: 'pat_whale_buying', whale_selling: 'pat_whale_selling',
  whale_active_unknown: 'pat_whale_active_unknown', no_whale: 'pat_no_whale',
  fund_neg: 'pat_fund_neg', fund_overlong: 'pat_fund_overlong',
  fund_pos: 'pat_fund_pos', fund_neutral: 'pat_fund_neutral',
  ob_bull: 'pat_ob_bull', ob_bear: 'pat_ob_bear', ob_neutral: 'pat_ob_neutral',
};

export function humanizePattern(k: string): string {
  return k.split('|').map(p => tm(HUMANIZE_MAP[p] || p)).join(' · ');
}