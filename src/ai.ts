// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · AI
// Groq AI Mentor + Trade Intent Parser
// ═══════════════════════════════════════════════════════════════

import { loadGroqKey } from './crypto'; // <--- ИЗМЕНЕНО ЗДЕСЬ
import { getWhaleFuturesMetrics } from './sources/whale-futures';
import { matchPatterns } from './patterns';
import { esc } from './utils';

// ═══════════════════════════════════════════════════════════════
// СИСТЕМНЫЙ ПРОМПТ
// ═══════════════════════════════════════════════════════════════

export const ORACLE_AI_SYSTEM_PROMPT = `Ты — NEBULA Oracle, старший крипто-аналитик и наставник в терминале NEBULA.

ТВОЯ БАЗА ЗНАНИЙ (используй как справочник для логики, терминов и аналогий):
— Bitcoin Whitepaper (Satoshi Nakamoto, 2008): философия дефицита, halving-циклы, P2P-природа, почему рынок реагирует на панику и жадность именно так
— Binance Academy: теханализ, свечные паттерны, уровни Фибоначчи, риск-менеджмент, управление капиталом
— Orderflow / Market Profile (Dalton "Mind Over Markets"): чтение стакана, поглощения, iceberg-ордера, POC и Value Area, кульминационные объёмы, поведение маркет-мейкеров
— On-chain метрики: Open Interest, Funding Rate, Long/Short Ratio, Taker Buy/Sell, движение китов, спящие адреса
— Классические паттерны: Wyckoff (accumulation/distribution), шорт-сквиз, лонг-сквиз, капитуляция, дивергенции RSI/MACD, ложные пробои, ретест уровней, spring/upthrust
— Поведенческая экономика: страх/жадность, эффект толпы, ловушка асимметрии информации

ТВОЯ ЗАДАЧА: дать трейдеру ТРИ ЧЕСТНЫХ СЦЕНАРИЯ, а не один усреднённый. Он читает тебя, чтобы принять решение, а не получить «может быть».

ФОРМАТ ОТВЕТА — СТРОГО 4 БЛОКА С МАРКЕРАМИ:

### BASE
🧠 КАК Я ДУМАЮ
[120-150 слов. Разбор логики: что вижу по всем данным (техника, киты, стакан, funding, контекст рынка), как метрики связаны между собой, что первично, что вторично. Простым языком, как трейдер трейдеру.]

### BULL (XX%)
🚀 ОПТИМИСТИЧНЫЙ СЦЕНАРИЙ
[80-100 слов. Что должно сработать, какие триггеры, целевые уровни. ОБЯЗАТЕЛЬНО укажи риск этого сценария — что может его сломать (перегрев funding, LSR, стена продавца, отсутствие объёма).]

### BEAR (YY%)
⚠️ СКЕПТИЧЕСКИЙ СЦЕНАРИЙ
[80-100 слов. Что может пойти не так, зоны стопа, что должно сломаться. ОБЯЗАТЕЛЬНО укажи шанс на отскок — что может спасти (шорт-сквиз, поддержка, дивергенция, киты в стакане).]

### VERDICT
[Одна строка в формате: База: X · Бычий: Y (риск: ...) · Медвежий: Z (шанс: ...)]

ЖЁСТКИЕ ПРАВИЛА:
1. X + Y + Z = 100%. BASE — самый вероятный сценарий на текущих данных, BULL и BEAR — альтернативы. Не делай BASE = 90%, должно быть честное распределение.
2. В BULL и BEAR — вероятность в процентах в самом заголовке блока, например «### BULL (45%)».
3. НИКОГДА не выдумывай ссылки, цитаты, номера страниц, конкретные даты из источников. Если не знаешь точно — говори общими словами ("по классике orderflow", "как учит Wyckoff-подход").
4. Если паттерн неясен — пиши "похоже на X, но подтверждения нет" вместо выдумки.
5. Пиши как трейдер для трейдера. Никаких "DYOR", "это не финансовый совет", "обратитесь к специалисту".
6. Цифры — всегда конкретные: доллары, проценты, R:R, ценовые уровни.
7. Если данных мало — так и скажи, не строй теорий на пустом месте.
8. Не повторяйся между блоками. BASE — логика. BULL — бычий сценарий с рисками. BEAR — медвежий с шансами.

Отвечай сразу блоками, без вступлений и пояснений.`;

// ═══════════════════════════════════════════════════════════════
// AI MENTOR
// ═══════════════════════════════════════════════════════════════

export interface AiMentorResult {
  status: 'success' | 'error';
  base?: string;
  bull?: string;
  bear?: string;
  verdictLine?: string;
  bullProb?: number;
  bearProb?: number;
  raw?: string;
  advice?: string; // legacy — склеенный текст
  message?: string;
}

function parseScenarios(text: string): {
  base: string; bull: string; bear: string; verdictLine: string;
  bullProb?: number; bearProb?: number;
} {
  const result = {
    base: '', bull: '', bear: '', verdictLine: '',
    bullProb: undefined as number | undefined,
    bearProb: undefined as number | undefined,
  };

  const idxBase = text.indexOf('### BASE');
  const idxBull = text.indexOf('### BULL');
  const idxBear = text.indexOf('### BEAR');
  const idxVerdict = text.indexOf('### VERDICT');

  if (idxBase === -1 && idxBull === -1 && idxBear === -1) {
    result.base = text.trim();
    return result;
  }

  const extract = (start: number, end: number): string => {
    if (start === -1) return '';
    const seg = text.slice(start, end === -1 ? text.length : end);
    return seg.replace(/^###\s+\w+(?:\s*\(\d+%\))?\s*\n?/m, '').trim();
  };

  result.base = extract(idxBase, idxBull !== -1 ? idxBull : idxBear !== -1 ? idxBear : idxVerdict);
  result.bull = extract(idxBull, idxBear !== -1 ? idxBear : idxVerdict);
  result.bear = extract(idxBear, idxVerdict);
  result.verdictLine = extract(idxVerdict, -1);

  const bullMatch = text.match(/###\s+BULL\s*\((\d+)%\)/);
  const bearMatch = text.match(/###\s+BEAR\s*\((\d+)%\)/);
  if (bullMatch) result.bullProb = parseInt(bullMatch[1], 10);
  if (bearMatch) result.bearProb = parseInt(bearMatch[1], 10);

  return result;
}

export async function getAiMentor(
  ticker: string,
  marketData: any,
  verdict: string,
  reasons: string[],
  warnings: string[],
  riskProfile: any,
  advanced?: any,
  marketCtx?: any,
  onStream?: (text: string) => void // <-- ДОБАВЛЕНО
): Promise<AiMentorResult> {
  const apiKey = await loadGroqKey();
  if (!apiKey) return { status: 'error', message: 'no_key' };

  const price = Number(marketData?.current_price ?? 0);
  const rsi = Number(marketData?.rsi ?? 50);
  const rebound = Number(marketData?.rebound_pct ?? 0);
  const drop = Number(marketData?.drop_pct ?? 0);
  const whaleActive = !!marketData?.whale_active;
  const whaleTrend = marketData?.whale_trend || '';
  const funding = Number(marketData?.funding_rate ?? 0);
  const bidsPct = Number(marketData?.bids_pct ?? 50);
  const profileLevel = riskProfile?.level || 'balanced';

  const adv = advanced || {};
  const macdLine = adv?.macd?.crossover || 'neutral';
  const bbState = adv?.bollinger?.state || 'normal';
  const adxVal = Number(adv?.adx?.value ?? 25);
  const adxStrength = adv?.adx?.trend_strength || 'weak';
  const stochState = adv?.stoch_rsi?.state || 'neutral';
  const stochVal = Number(adv?.stoch_rsi?.value ?? 50);
  const div = adv?.divergence || {};
  const divType = div?.type || 'нет';
  const divStrength = div?.strength || 0;
  const sr = adv?.support_resistance || {};
  const nearestS = sr?.nearest_s || 0;
  const nearestR = sr?.nearest_r || 0;
  const atrPct = Number(adv?.atr?.percent ?? 0);
  const vp = adv?.volume_profile || {};
  const poc = vp?.poc || 0;

  const regime = marketCtx?.regime || 'neutral';
  const regimeDesc = marketCtx?.regime_desc || '';
  const fng = marketCtx?.fear_greed ?? '?';
  const fngText = marketCtx?.fear_greed_text || '';

  let wf: any = {};
  try { wf = (await getWhaleFuturesMetrics(ticker)) || {}; } catch { /* silent */ }
  const oiChange = wf.oi_change_24h_pct;
  const oiTrend = wf.oi_trend || 'flat';
  const lsrTop = wf.lsr_top_positions || wf.lsr_top_accounts;
  const lsrGlobal = wf.lsr_global;
  const taker = wf.taker_ratio;

  const reasonsText = reasons?.length ? reasons.join('; ') : 'нет';
  const warningsText = warnings?.length ? warnings.join('; ') : 'нет';

  let matched: any[] = [];
  try { matched = matchPatterns(marketData, adv, wf); } catch { /* silent */ }

  const patternsText = matched.length > 0
    ? matched.map(m =>
        `▸ ${m.name} (совпадение ${m.confidence}%)\n   Описание: ${m.desc}\n   Рекомендуемое действие: ${m.action}`
      ).join('\n')
    : 'нет чётких совпадений с базой паттернов';

  const divStr = divStrength ? ` (${divStrength}%)` : '';
  const oiStr = oiChange != null ? `${oiChange >= 0 ? '+' : ''}${oiChange.toFixed(1)}% (${oiTrend})` : 'нет данных';
  const lsrTopStr = lsrTop || 'н/д';
  const lsrGlobalStr = lsrGlobal || 'н/д';
  const takerStr = taker || 'н/д';

  const fundingSign = funding >= 0 ? '+' : '';
  const bidsPctRounded = bidsPct.toFixed(0);

  const userPrompt = `Монета: ${ticker}
Итоговый вердикт нашего скоринга: ${verdict}

ТЕХНИЧЕСКИЕ ДАННЫЕ:
- Цена: $${price.toFixed(6)}
- RSI: ${rsi.toFixed(1)}
- Отскок от 120d-минимума: +${rebound.toFixed(1)}%
- Падение от 120d-максимума: -${drop.toFixed(1)}%
- MACD: ${macdLine}
- Bollinger: ${bbState}
- ADX: ${adxVal.toFixed(1)} (${adxStrength})
- Stoch RSI: ${stochVal.toFixed(1)} (${stochState})
- Дивергенция: ${divType}${divStr}
- ATR: ${atrPct.toFixed(2)}% от цены
- Ближайшая поддержка: $${Number(nearestS).toFixed(6)}
- Ближайшее сопротивление: $${Number(nearestR).toFixed(6)}
- Volume Profile POC: $${Number(poc).toFixed(6)}

ДЕРИВАТИВЫ И КИТЫ:
- Киты активны: ${whaleActive ? 'да' : 'нет'}
- Тренд OBV: ${whaleTrend}
- Funding rate: ${fundingSign}${funding.toFixed(4)}%
- Покупки в стакане (bids): ${bidsPctRounded}%
- Open Interest 24h: ${oiStr}
- LSR (топ-трейдеры): ${lsrTopStr}
- LSR (толпа): ${lsrGlobalStr}
- Taker Buy/Sell: ${takerStr}

КОНТЕКСТ РЫНКА:
- Режим: ${regime} — ${regimeDesc}
- Fear & Greed: ${fng} (${fngText})

РИСК-ПРОФИЛЬ: ${profileLevel}

ПРИЧИНЫ В ПОЛЬЗУ СИГНАЛА: ${reasonsText}
ПРЕДУПРЕЖДЕНИЯ: ${warningsText}

СОВПАДЕНИЯ С БАЗОЙ ПАТТЕРНОВ:
${patternsText}

---

Задача: дай разбор строго по 4 блокам из системного промпта:

### BASE
🧠 КАК Я ДУМАЮ — 120-150 слов разбора логики

### BULL (XX%)
🚀 ОПТИМИСТИЧНЫЙ — 80-100 слов, с рисками в конце

### BEAR (YY%)
⚠️ СКЕПТИЧЕСКИЙ — 80-100 слов, с шансом на отскок в конце

### VERDICT
Одна строка: База: X · Бычий: Y (риск: ...) · Медвежий: Z (шанс: ...)

Требования:
- X + Y + Z = 100%.
- Вероятности в заголовках BULL и BEAR — обязательно.
- Конкретные цифры: цены, проценты, R:R, уровни.
- В BULL — что должно сработать + что это сломает.
- В BEAR — что должно сломаться + что даёт шанс на отскок.
- Без "DYOR", "не финансовый совет".
- Пиши как трейдер для трейдера.

Отвечай сразу блоками, без вступлений.`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: ORACLE_AI_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.55,
        max_tokens: 2500,
        stream: !!onStream, // Включаем стриминг, если есть коллбэк
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (r.status !== 200) {
      let err = r.statusText;
      try { const e = await r.json(); err = e?.error?.message || err; } catch { /* silent */ }
      return { status: 'error', message: err };
    }

    // ─── РЕЖИМ СТРИМИНГА ───
    if (onStream && r.body) {
      const reader = r.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Оставляем недописанную строку в буфере

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices[0]?.delta?.content || '';
              if (delta) {
                fullText += delta;
                onStream(esc(fullText)); // Отдаем ЭКРАНИРОВАННЫЙ текст в UI
              }
            } catch { /* Игнорируем неполные JSON чанки */ }
          }
        }
      }

      const advice = esc(fullText);
      const parsed = parseScenarios(advice);
      return {
        status: 'success',
        base: parsed.base,
        bull: parsed.bull,
        bear: parsed.bear,
        verdictLine: parsed.verdictLine,
        bullProb: parsed.bullProb,
        bearProb: parsed.bearProb,
        raw: advice,
        advice,
      };
    } 
    
    // ─── ОБЫЧНЫЙ РЕЖИМ (если стриминг не запрошен) ───
    const data = await r.json();
    let advice = data.choices?.[0]?.message?.content || '';
    advice = esc(advice);

    const parsed = parseScenarios(advice);
    return {
      status: 'success',
      base: parsed.base,
      bull: parsed.bull,
      bear: parsed.bear,
      verdictLine: parsed.verdictLine,
      bullProb: parsed.bullProb,
      bearProb: parsed.bearProb,
      raw: advice,
      advice,
    };
  } catch (e: any) {
    return { status: 'error', message: String(e?.message || e) };
  }
}

// ═══════════════════════════════════════════════════════════════
// TRADE INTENT PARSER · AI-Агент (Tool Calling)
// ═══════════════════════════════════════════════════════════════

export const TRADE_INTENT_SYSTEM_PROMPT = `Ты — парсер торговых команд для крипто-терминала.
Отвечай ТОЛЬКО валидным JSON-объектом. Без markdown-обёрток, без комментариев, без пояснений.

СХЕМА ОТВЕТА:
{
  "action": "grid" | "market_buy" | "market_sell" | "cancel_all",
  "symbol": "BTC/USDT",
  "side": "buy" | "sell",
  "capital_pct": 10,
  "price_low": 60000,
  "price_high": 65000,
  "steps": 5
}

ПРАВИЛА:
- symbol — всегда в формате BASE/USDT (например BTC/USDT, DASH/USDT, ETH/USDT)
- capital_pct — целое или дробное число от 1 до 100 (% от депозита)
- side — обязателен только для action="grid" (buy или sell)
- price_low, price_high, steps — обязательны только для action="grid"
- steps — целое от 2 до 50
- Если команда непонятна — верни ровно {"error": "краткая причина"} и ничего больше

ПРИМЕРЫ:
"купи DASH на 10% депо" ->
{"action":"market_buy","symbol":"DASH/USDT","capital_pct":10}

"продай половину ETH" ->
{"action":"market_sell","symbol":"ETH/USDT","capital_pct":50}

"поставь сетку на BTC от 60000 до 65000 на 5 шагов, 20% депо на покупку" ->
{"action":"grid","symbol":"BTC/USDT","side":"buy","capital_pct":20,"price_low":60000,"price_high":65000,"steps":5}

"отмени все ордера по ETH" ->
{"action":"cancel_all","symbol":"ETH/USDT"}
`;

export interface TradeIntent {
  action: 'grid' | 'market_buy' | 'market_sell' | 'cancel_all';
  symbol: string;
  side?: 'buy' | 'sell';
  capital_pct?: number;
  price_low?: number;
  price_high?: number;
  steps?: number;
}

export async function parseTradeIntent(userPrompt: string): Promise<TradeIntent> {
  const apiKey = await loadGroqKey();
  if (!apiKey) throw new Error('Groq API-ключ не найден. Добавь его в настройках.');

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: TRADE_INTENT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 400,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (r.status !== 200) {
    throw new Error(`Groq API вернул ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }

  let raw = (await r.json()).choices?.[0]?.message?.content?.trim() || '';

  if (raw.startsWith('```')) {
    const firstNl = raw.indexOf('\n');
    if (firstNl !== -1) raw = raw.slice(firstNl + 1);
    if (raw.endsWith('```')) raw = raw.slice(0, -3);
    raw = raw.trim();
  }

  let data: any;
  try { data = JSON.parse(raw); }
  catch (e: any) { throw new Error(`AI вернул не-JSON: ${e.message}. Ответ: ${raw.slice(0, 200)}`); }

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`AI не понял команду: ${data.error}`);
  }

  return validateTradeIntent(data);
}

export function validateTradeIntent(data: any): TradeIntent {
  if (!data || typeof data !== 'object') throw new Error('Интент должен быть JSON-объектом');

  const action = data.action;
  if (!['grid', 'market_buy', 'market_sell', 'cancel_all'].includes(action)) {
    throw new Error(`Неизвестное действие: ${action}`);
  }

  const symbol = data.symbol;
  if (typeof symbol !== 'string' || !symbol) throw new Error("Поле 'symbol' обязательно");

  const symNorm = symbol.replace('_', '/').toUpperCase().trim();
  if (!symNorm.includes('/')) throw new Error(`symbol должен быть в формате BASE/USDT`);
  data.symbol = symNorm;

  if (action !== 'cancel_all') {
    let cpt = Number(data.capital_pct ?? 10);
    if (!(cpt > 0 && cpt <= 100)) throw new Error('capital_pct должен быть в (0, 100]');
    data.capital_pct = cpt;
  }

  if (action === 'grid') {
    for (const f of ['price_low', 'price_high', 'steps', 'side']) {
      if (!(f in data)) throw new Error(`Для action='grid' обязательно поле '${f}'`);
    }
    data.price_low = Number(data.price_low);
    data.price_high = Number(data.price_high);
    data.steps = parseInt(data.steps, 10);

    if (data.price_low <= 0 || data.price_high <= 0) throw new Error('Цены должны быть > 0');
    if (data.price_low >= data.price_high) throw new Error('price_low должен быть меньше price_high');
    if (!(data.steps >= 2 && data.steps <= 50)) throw new Error('steps должен быть от 2 до 50');

    const side = String(data.side).toLowerCase();
    if (!['buy', 'sell'].includes(side)) throw new Error("side должен быть 'buy' или 'sell'");
    data.side = side;
  }

  return data as TradeIntent;
}