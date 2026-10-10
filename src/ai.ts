// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · AI
// Точный порт из python/ai.py
// Groq AI Mentor + Trade Intent Parser
// ═══════════════════════════════════════════════════════════════

import { loadGroqKey } from './trading';
import { getWhaleFuturesMetrics } from './sources/whale-futures';
import { matchPatterns } from './patterns';

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

ТВОЯ ЗАДАЧА: дать глубокий разбор, а не поверхностный. Трейдер читает тебя, чтобы принять решение. Он платит вниманием — не трать его впустую, но и не оставляй недосказанности.

СТРУКТУРА ОТВЕТА (ровно 7 блоков с заголовками):

**📌 ЧТО ПРОИСХОДИТ**
Развёрнутое описание текущей картины: где цена, в каком диапазоне, что показывают ключевые метрики. 3-5 предложений. Опиши контекст, а не просто перечисли цифры.

**🎯 НА ЧТО ПОХОЖЕ**
Опирайся в первую очередь на блок «СОВПАДЕНИЯ С БАЗОЙ ПАТТЕРНОВ» из данных — там перечислены конкретные паттерны, которые ТОЧНО совпали по правилам. Назови 2-3 из них и объясни, почему каждый подходит. Если совпадений нет — так и скажи: «чётких паттернов нет, картина смешанная». Не выдумывай паттерны, которых нет в базе.

**🧠 ПОЧЕМУ ТАК**
Глубокий разбор причинно-следственных связей. Как метрики связаны между собой? Что первично, что вторично? 5-7 предложений. Здесь ты объясняешь ЛОГИКУ рынка, а не перечисляешь данные.

**⚖️ ЧТО ГОВОРЯТ ЗА И ПРОТИВ**
Два списка:
▪ За рост: 3-5 пунктов
▪ За падение: 3-5 пунктов
Это даст трейдеру увидеть оба сценария и самому взвесить.

**📈 ВЕРОЯТНЫЕ СЦЕНАРИИ**
Три сценария с примерными вероятностями:
▪ Бычий (X%): что должно произойти, куда идёт цена, целевые уровни
▪ Базовый (Y%): консолидация или умеренное движение
▪ Медвежий (Z%): что сломается, куда идём, зоны стопа
Сумма вероятностей = 100%.

**⚡ ЧТО ДЕЛАТЬ**
Конкретный план:
— Направление сделки
— Зона входа (диапазон цен)
— Стоп-лосс с обоснованием (привязан к ATR или уровню)
— Тейк-профит (можно лестницей из 2-3 целей)
— Размер позиции с учётом риск-профиля
— Соотношение риск/прибыль (R:R)
— Что должно произойти, чтобы отменить сделку (invalidation)

**📊 УВЕРЕННОСТЬ**
Оценка X/10 + развёрнутое обоснование: что усиливает уверенность, что её снижает. 3-4 предложения.

ЖЁСТКИЕ ПРАВИЛА:
1. НИКОГДА не выдумывай ссылки, цитаты, номера страниц, конкретные даты из источников. Если не знаешь точно — говори общими словами ("по классике orderflow", "как учит Wyckoff-подход").
2. Если паттерн неясен — пиши "похоже на X, но подтверждения нет" вместо выдумки.
3. Пиши как трейдер для трейдера. Уважай читателя. Никаких "DYOR", "это не финансовый совет", "обратитесь к специалисту", "инвестиции связаны с риском".
4. Цифры — всегда конкретные: доллары, проценты, R:R, ценовые уровни.
5. Если данных мало для глубокого вывода — так и скажи, не строй теорий на пустом месте.
6. Не повторяйся. Каждый блок несёт новую информацию.
7. Объём: стремись к 350-450 словам. Не растягивай искусственно, но и не сжимай в ущерб пониманию.`;

// ═══════════════════════════════════════════════════════════════
// AI MENTOR
// ═══════════════════════════════════════════════════════════════

export interface AiMentorResult {
  status: 'success' | 'error';
  advice?: string;
  message?: string;
}

export async function getAiMentor(
  ticker: string,
  marketData: any,
  verdict: string,
  reasons: string[],
  warnings: string[],
  riskProfile: any,
  advanced?: any,
  marketCtx?: any
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

  // Whale futures
  let wf: any = {};
  try { wf = (await getWhaleFuturesMetrics(ticker)) || {}; } catch { /* silent */ }
  const oiChange = wf.oi_change_24h_pct;
  const oiTrend = wf.oi_trend || 'flat';
  const lsrTop = wf.lsr_top_positions || wf.lsr_top_accounts;
  const lsrGlobal = wf.lsr_global;
  const taker = wf.taker_ratio;

  const reasonsText = reasons?.length ? reasons.join('; ') : 'нет';
  const warningsText = warnings?.length ? warnings.join('; ') : 'нет';

  // Match patterns
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

Задача: дай РАЗВЁРНУТЫЙ анализ строго по 7 блокам из системного промпта:

1. **📌 ЧТО ПРОИСХОДИТ** — развёрнутое описание картины (3-5 предложений)
2. **🎯 НА ЧТО ПОХОЖЕ** — 2-3 паттерна из базы знаний с объяснением
3. **🧠 ПОЧЕМУ ТАК** — причинно-следственные связи, логика рынка (5-7 предложений)
4. **⚖️ ЧТО ГОВОРЯТ ЗА И ПРОТИВ** — два списка (за рост / за падение), по 3-5 пунктов
5. **📈 ВЕРОЯТНЫЕ СЦЕНАРИИ** — три сценария с процентами (бычий/базовый/медвежий), сумма = 100%
6. **⚡ ЧТО ДЕЛАТЬ** — направление, зона входа, стоп, тейк-профит (лестницей), размер позиции, R:R, invalidation
7. **📊 УВЕРЕННОСТЬ** — X/10 с развёрнутым обоснованием (3-4 предложения)

Требования:
- Объём 350-450 слов. Глубина вместо воды, но без обрывов.
- В блоке «Вероятные сценарии» — конкретные целевые уровни для каждого сценария.
- В блоке «Что делать» — конкретные цифры: цены входа/стопа/целей, R:R, % депозита.
- В блоке «Уверенность» — что усиливает и что снижает уверенность.
- Пиши так, чтобы трейдер закрыл терминал и понял, что делать прямо сейчас.

Отвечай сразу разбором, без вступлений типа "Конечно, вот анализ...".`;

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
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (r.status === 200) {
      const data = await r.json();
      const advice = data.choices?.[0]?.message?.content || '';
      return { status: 'success', advice };
    } else {
      let err = r.statusText;
      try { const e = await r.json(); err = e?.error?.message || err; } catch { /* silent */ }
      return { status: 'error', message: err };
    }
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