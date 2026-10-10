// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · PATTERNS
// Точный порт из python/patterns.py
// ═══════════════════════════════════════════════════════════════

export interface PatternRule {
  rsi_max?: number;
  rsi_min?: number;
  drop_pct_min?: number;
  rebound_pct_min?: number;
  funding_min?: number;
  bids_pct_min?: number;
  bids_pct_max?: number;
  oi_trend?: string[];
  whale_active?: boolean;
  whale_trend_contains?: string[];
  bb_oversold?: boolean;
  bb_bandwidth_max?: number;
  divergence?: string;
  lsr_top_gt_global_by?: number;
}

export interface PatternDef {
  id: string;
  name: string;
  desc: string;
  rules: PatternRule;
  action: string;
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
  },
  {
    id: 'wyckoff_spring',
    name: 'Wyckoff Spring (ложный пробой вниз)',
    desc: 'Цена пробивает поддержку, но быстро возвращается — крупный игрок собрал стопы и набирает позицию.',
    rules: { rsi_max: 40, bb_oversold: true, bids_pct_min: 55 },
    action: 'Лонг после возврата выше пробитого уровня. Стоп под минимумом ложного пробоя.',
  },
  {
    id: 'long_squeeze',
    name: 'Long Squeeze (каскад ликвидаций лонгов)',
    desc: 'Перегрев лонгов, funding высокий, OI падает — начинается каскад ликвидаций.',
    rules: { rsi_min: 65, funding_min: 0.03, oi_trend: ['falling'] },
    action: 'Шорт или ожидание в стороне. Лонги в этой зоне — русская рулетка.',
  },
  {
    id: 'bearish_divergence_top',
    name: 'Медвежья дивергенция на вершине',
    desc: 'Цена делает новый максимум, RSI — нет. Скрытый сигнал разворота.',
    rules: { divergence: 'bearish', rsi_min: 55, rebound_pct_min: 60 },
    action: 'Фиксировать прибыль. Шорт только после подтверждения (пробой поддержки).',
  },
  {
    id: 'bullish_divergence_bottom',
    name: 'Бычья дивергенция на дне',
    desc: 'Цена делает новый минимум, RSI — нет. Скрытый сигнал разворота вверх.',
    rules: { divergence: 'bullish', rsi_max: 40 },
    action: 'Искать лонг с подтверждением на объёме. Стоп под локальный минимум.',
  },
  {
    id: 'whale_distribution',
    name: 'Распределение китов',
    desc: 'Цена падает, OBV падает, стакан слабый снизу — крупный игрок сбрасывает позицию.',
    rules: { whale_active: true, whale_trend_contains: ['ПАД', 'FALLING'], bids_pct_max: 45 },
    action: 'Не покупать. Ждать смены структуры рынка.',
  },
  {
    id: 'lsr_top_long_crowd_short',
    name: 'LSR-дивергенция (топы в лонге, толпа в шорте)',
    desc: 'Топ-трейдеры набирают лонг, толпа шортит. Классический конфлюенс для отскока.',
    rules: { lsr_top_gt_global_by: 0.15, rsi_max: 45 },
    action: 'Лонг с усиленным бустом Whale Score. Цель — зона POC.',
  },
  {
    id: 'bollinger_squeeze',
    name: 'Bollinger Squeeze',
    desc: 'Сжатие полос Боллинджера — волатильность на минимуме, скоро резкий выброс.',
    rules: { bb_bandwidth_max: 4.0 },
    action: 'Ждать пробоя в любую сторону, торговать по направлению пробоя.',
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
  bull_btc: 'Бычий BTC', altseason: 'Альтсезон', bearish: 'Медвежий рынок',
  bull_mild: 'Умеренный рост', bear_mild: 'Умеренное падение', neutral: 'Консолидация',
  rsi_oversold: 'RSI перепродан', rsi_low: 'RSI низкий', rsi_mid: 'RSI средний',
  rsi_high: 'RSI высокий', rsi_overbought: 'RSI перекуплен',
  whale_buying: 'киты покупают', whale_selling: 'киты продают',
  whale_active_unknown: 'аномалия объёма', no_whale: 'без китов',
  fund_neg: 'шорты доминируют', fund_overlong: 'перегрев лонгов',
  fund_pos: 'лонги преобладают', fund_neutral: 'нейтральный funding',
  ob_bull: 'стакан бычий', ob_bear: 'стакан медвежий', ob_neutral: 'стакан нейтральный',
};

export function humanizePattern(k: string): string {
  return k.split('|').map(p => HUMANIZE_MAP[p] || p).join(' · ');
}