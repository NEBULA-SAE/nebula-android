// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MEXC API
// Подписанные запросы через HMAC-SHA256 (Web Crypto)
// ═══════════════════════════════════════════════════════════════

import { hmacSha256Hex } from '../crypto';

const MEXC_BASE = 'https://api.mexc.com';

// ─── Типы ───

export interface MexcKeys {
  api: string;
  secret: string;
}

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  quantity: string;
  price?: string;
}

export interface OrderResponse {
  orderId?: string;
  symbol?: string;
  status?: string;
  code?: number;
  msg?: string;
}

export interface Asset {
  coin: string;
  amount: number;
  price: number;
  pnl: number;
  total_usd: number;
  total_rub: number;
}

export interface PortfolioData {
  status: 'success' | 'error';
  total_usd?: number;
  total_rub?: number;
  free_usdt?: number;
  free_rub?: number;
  pnl_percent?: number;
  usdt_rub_rate?: number;
  rate_updated?: number;
  assets?: Asset[];
  message?: string;
}

// ─── Подпись и запросы ───

async function signMexc(secret: string, queryString: string): Promise<string> {
  return hmacSha256Hex(secret, queryString);
}

async function mexcRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string | number> = {}
): Promise<any> {
  const fullParams: Record<string, string | number> = {
    ...params,
    timestamp: Date.now(),
    recvWindow: 5000,
  };
  const query = new URLSearchParams(
    Object.entries(fullParams).map(([k, v]) => [k, String(v)])
  ).toString();
  const signature = await signMexc(apiSecret, query);
  const url = `${MEXC_BASE}${path}?${query}&signature=${signature}`;

  const r = await fetch(url, {
    method,
    headers: { 'X-MEXC-APIKEY': apiKey },
    signal: AbortSignal.timeout(15000),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`MEXC HTTP ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// ─── Публичный запрос цены (без подписи) ───

export async function getCurrentPrice(base: string): Promise<number> {
  try {
    const r = await fetch(
      `${MEXC_BASE}/api/v3/ticker/price?symbol=${base}USDT`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return 0;
    const d = await r.json();
    return parseFloat(d.price) || 0;
  } catch {
    return 0;
  }
}

// ─── Курс USDT/RUB (делегируем в market.ts) ───

import { getCurrentRate } from '../market';

// ─── Ордера ───

export interface PlanStep {
  step: number;
  price: number;
  amount: number;
  percent?: number;
  profit_usdt?: number;
}

export async function executeExchangeOrders(
  keys: MexcKeys,
  symbol: string,
  plan: PlanStep[]
): Promise<{ status: 'success' | 'error'; orders?: any[]; message?: string }> {
  try {
    const base = symbol.split('/')[0].toUpperCase();

    // Проверяем баланс
    const account = await mexcRequest('GET', '/api/v3/account', keys.api, keys.secret);
    const balances: Record<string, number> = {};
    for (const b of account.balances || []) {
      balances[b.asset] = parseFloat(b.free);
    }
    const free = balances[base] || 0;
    const needed = plan.reduce((s, p) => s + p.amount, 0);

    if (free < needed * 0.99) {
      return {
        status: 'error',
        message: `На балансе ${free} ${base}. Нужно ${needed.toFixed(4)}.`,
      };
    }

    const results: any[] = [];
    for (const s of plan) {
      const params = {
        symbol: `${base}USDT`,
        side: 'SELL',
        type: 'LIMIT',
        quantity: s.amount.toFixed(8).replace(/\.?0+$/, ''),
        price: s.price.toFixed(8).replace(/\.?0+$/, ''),
      };
      const res = await mexcRequest('POST', '/api/v3/order', keys.api, keys.secret, params);
      if (res.orderId) {
        results.push({ step: s.step, id: res.orderId, price: s.price });
      } else {
        results.push({ step: s.step, error: res.msg || 'unknown' });
      }
    }
    return { status: 'success', orders: results };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function getOpenOrders(
  keys: MexcKeys,
  symbol: string
): Promise<{ status: 'success' | 'error'; orders?: any[]; message?: string }> {
  try {
    const base = symbol.split('/')[0].toUpperCase();
    const res = await mexcRequest(
      'GET', '/api/v3/openOrders',
      keys.api, keys.secret,
      { symbol: `${base}USDT` }
    );
    if (!Array.isArray(res)) {
      return { status: 'error', message: res?.msg || 'API error' };
    }
    const sells = res.filter(o => o.side === 'SELL');
    sells.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    return {
      status: 'success',
      orders: sells.map((o, i) => ({
        step: i + 1,
        id: o.orderId,
        price: parseFloat(o.price),
        amount: parseFloat(o.origQty),
      })),
    };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function cancelAllOrders(
  keys: MexcKeys,
  base: string
): Promise<{ status: 'success' | 'error'; message?: string; raw?: any }> {
  try {
    const res = await mexcRequest(
      'DELETE', '/api/v3/openOrders',
      keys.api, keys.secret,
      { symbol: `${base}USDT` }
    );
    return { status: 'success', raw: res };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function placeMarketOrder(
  keys: MexcKeys,
  base: string,
  side: 'BUY' | 'SELL',
  qty: number
): Promise<{ status: 'success' | 'error'; orderId?: string; message?: string; raw?: any }> {
  try {
    const params = {
      symbol: `${base}USDT`,
      side,
      type: 'MARKET',
      quantity: qty.toFixed(8).replace(/\.?0+$/, ''),
    };
    const res = await mexcRequest('POST', '/api/v3/order', keys.api, keys.secret, params);
    if (res.orderId) return { status: 'success', orderId: res.orderId, raw: res };
    return { status: 'error', message: res.msg || 'unknown', raw: res };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function placeLimitOrder(
  keys: MexcKeys,
  base: string,
  side: 'BUY' | 'SELL',
  qty: number,
  price: number
): Promise<{ status: 'success' | 'error'; orderId?: string; message?: string; raw?: any }> {
  try {
    const params = {
      symbol: `${base}USDT`,
      side,
      type: 'LIMIT',
      quantity: qty.toFixed(8).replace(/\.?0+$/, ''),
      price: price.toFixed(8).replace(/\.?0+$/, ''),
    };
    const res = await mexcRequest('POST', '/api/v3/order', keys.api, keys.secret, params);
    if (res.orderId) return { status: 'success', orderId: res.orderId, raw: res };
    return { status: 'error', message: res.msg || 'unknown', raw: res };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

// ─── Портфель ───

export async function getPortfolio(keys: MexcKeys): Promise<PortfolioData> {
  try {
        const rate = await getCurrentRate();
    const account = await mexcRequest('GET', '/api/v3/account', keys.api, keys.secret);

    const balances: Record<string, number> = {};
    for (const b of account.balances || []) {
      const total = parseFloat(b.free) + parseFloat(b.locked || 0);
      if (total > 0) balances[b.asset] = total;
    }

    const assets: Asset[] = [];
    let total_usd = 0;
    let total_pnl = 0;
    const free_usdt = balances['USDT'] || 0;

    const entries = Object.entries(balances);
    // Параллельно подтягиваем цены
    const priceResults = await Promise.allSettled(
      entries.map(([coin]) => {
        if (coin === 'USDT') return Promise.resolve({ coin, price: 1, pnl: 0 });
        return fetch(`${MEXC_BASE}/api/v3/ticker/24hr?symbol=${coin}USDT`, {
          signal: AbortSignal.timeout(8000),
        })
          .then(r => r.json())
          .then(d => ({
            coin,
            price: parseFloat(d.lastPrice) || 0,
            pnl: parseFloat(d.priceChangePercent) || 0,
          }))
          .catch(() => ({ coin, price: 0, pnl: 0 }));
      })
    );

    for (let i = 0; i < entries.length; i++) {
      const [coin, amt] = entries[i];
      const r = priceResults[i];
      if (r.status !== 'fulfilled') continue;
      const { price, pnl } = r.value;
      const ausd = amt * price;
      if (ausd <= 1) continue;
      assets.push({
        coin,
        amount: Math.round(amt * 1e6) / 1e6,
        price,
        pnl,
        total_usd: ausd,
        total_rub: Math.round(ausd * rate * 100) / 100,
      });
      total_usd += ausd;
      if (coin !== 'USDT') total_pnl += ausd * (pnl / 100);
    }

    assets.sort((a, b) => b.total_usd - a.total_usd);
    const inv = total_usd - free_usdt;
    const pnl_pct = inv > 0 ? (total_pnl / inv) * 100 : 0;

    return {
      status: 'success',
      total_usd,
      total_rub: Math.round(total_usd * rate * 100) / 100,
      free_usdt,
      free_rub: Math.round(free_usdt * rate * 100) / 100,
      pnl_percent: pnl_pct,
      usdt_rub_rate: rate,
      rate_updated: Math.floor(Date.now() / 1000),
      assets,
    };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}