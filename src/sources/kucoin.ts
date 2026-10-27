// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · KUCOIN API
// Подписанные запросы (HMAC-SHA256 + Base64 + Passphrase)
// ═══════════════════════════════════════════════════════════════

import { hmacSha256Hex } from '../crypto';

const KUCOIN_BASE = 'https://api.kucoin.com';

// ─── Типы ───

export interface KucoinKeys {
  api: string;
  secret: string;
  passphrase: string;
}

export interface OrderResponse {
  orderId?: string;
  symbol?: string;
  status?: string;
  code?: string;
  msg?: string;
}

// ─── Подпись и запросы ───

async function signKucoin(
  secret: string,
  passphrase: string,
  timestamp: string,
  method: string,
  endpoint: string,
  body: string = ''
): Promise<{ sign: string; passphraseSigned: string }> {
  const prehash = timestamp + method.toUpperCase() + endpoint + body;
  const signHex = await hmacSha256Hex(secret, prehash);
  const sign = btoa(signHex);

  const passphraseHex = await hmacSha256Hex(secret, passphrase);
  const passphraseSigned = btoa(passphraseHex);

  return { sign, passphraseSigned };
}

async function kucoinRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  keys: KucoinKeys,
  params: Record<string, string | number> = {}
): Promise<any> {
  const timestamp = Date.now().toString();
  const query = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();

  const endpoint = query ? `${path}?${query}` : path;
  const body = method === 'GET' ? '' : JSON.stringify(params);

  const { sign, passphraseSigned } = await signKucoin(
    keys.secret,
    keys.passphrase,
    timestamp,
    method,
    endpoint,
    body
  );

  const headers: Record<string, string> = {
    'KC-API-KEY': keys.api,
    'KC-API-SIGN': sign,
    'KC-API-TIMESTAMP': timestamp,
    'KC-API-PASSPHRASE': passphraseSigned,
    'KC-API-KEY-VERSION': '3', // Для API-ключей версии 3 (актуально)
    'Content-Type': 'application/json',
  };

  const url = `${KUCOIN_BASE}${endpoint}`;
  const r = await fetch(url, {
    method,
    headers,
    body: method === 'GET' ? undefined : body,
    signal: AbortSignal.timeout(15000),
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`KuCoin HTTP ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// ─── Публичный запрос цены (без подписи) ───

export async function getCurrentPrice(base: string): Promise<number> {
  try {
    const r = await fetch(
      `${KUCOIN_BASE}/api/v1/market/orderbook/level1?symbol=${base}-USDT`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return 0;
    const d = await r.json();
    return parseFloat(d.data?.price) || 0;
  } catch {
    return 0;
  }
}

// ─── Ордера ───

export interface PlanStep {
  step: number;
  price: number;
  amount: number;
  percent?: number;
  profit_usdt?: number;
}

export async function executeKucoinOrders(
  keys: KucoinKeys,
  symbol: string,
  plan: PlanStep[]
): Promise<{ status: 'success' | 'error'; orders?: any[]; message?: string }> {
  try {
    const base = symbol.split('/')[0].toUpperCase();

    // Проверяем баланс (используем классический аккаунт)
    const account = await kucoinRequest('GET', '/api/v1/accounts', keys, { type: 'trade' });
    const balances: Record<string, number> = {};
    for (const b of account.data || []) {
      balances[b.currency] = parseFloat(b.available);
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
        clientOid: `${Date.now()}-${s.step}`,
        side: 'sell',
        symbol: `${base}-USDT`,
        type: 'limit',
        price: s.price.toFixed(8).replace(/\.?0+$/, ''),
        size: s.amount.toFixed(8).replace(/\.?0+$/, ''),
      };
      const res = await kucoinRequest('POST', '/api/v1/orders', keys, params);
      if (res.data?.orderId) {
        results.push({ step: s.step, id: res.data.orderId, price: s.price });
      } else {
        results.push({ step: s.step, error: res.msg || 'unknown' });
      }
    }
    return { status: 'success', orders: results };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function getKucoinOpenOrders(
  keys: KucoinKeys,
  symbol: string
): Promise<{ status: 'success' | 'error'; orders?: any[]; message?: string }> {
  try {
    const base = symbol.split('/')[0].toUpperCase();
    const res = await kucoinRequest('GET', '/api/v1/orders', keys, {
      symbol: `${base}-USDT`,
      status: 'active',
    });
    if (res.code !== '200000') {
      return { status: 'error', message: res.msg || 'API error' };
    }
    const sells = (res.data?.items || []).filter((o: any) => o.side === 'sell');
    sells.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));
    return {
      status: 'success',
      orders: sells.map((o: any, i: number) => ({
        step: i + 1,
        id: o.id,
        price: parseFloat(o.price),
        amount: parseFloat(o.size),
      })),
    };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function cancelKucoinOrders(
  keys: KucoinKeys,
  base: string
): Promise<{ status: 'success' | 'error'; message?: string; raw?: any }> {
  try {
    // Отменяем все активные ордера по символу
    const res = await kucoinRequest('DELETE', '/api/v1/orders', keys, {
      symbol: `${base}-USDT`,
    });
    return { status: 'success', raw: res };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function placeKucoinMarketOrder(
  keys: KucoinKeys,
  base: string,
  side: 'BUY' | 'SELL',
  qty: number
): Promise<{ status: 'success' | 'error'; orderId?: string; message?: string; raw?: any }> {
  try {
    const params = {
      clientOid: `${Date.now()}`,
      side: side.toLowerCase(),
      symbol: `${base}-USDT`,
      type: 'market',
      size: qty.toFixed(8).replace(/\.?0+$/, ''),
    };
    const res = await kucoinRequest('POST', '/api/v1/orders', keys, params);
    if (res.data?.orderId) return { status: 'success', orderId: res.data.orderId, raw: res };
    return { status: 'error', message: res.msg || 'unknown', raw: res };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

export async function placeKucoinLimitOrder(
  keys: KucoinKeys,
  base: string,
  side: 'BUY' | 'SELL',
  qty: number,
  price: number
): Promise<{ status: 'success' | 'error'; orderId?: string; message?: string; raw?: any }> {
  try {
    const params = {
      clientOid: `${Date.now()}`,
      side: side.toLowerCase(),
      symbol: `${base}-USDT`,
      type: 'limit',
      price: price.toFixed(8).replace(/\.?0+$/, ''),
      size: qty.toFixed(8).replace(/\.?0+$/, ''),
    };
    const res = await kucoinRequest('POST', '/api/v1/orders', keys, params);
    if (res.data?.orderId) return { status: 'success', orderId: res.data.orderId, raw: res };
    return { status: 'error', message: res.msg || 'unknown', raw: res };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}

// ─── Портфель (классический аккаунт) ───

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

export async function getKucoinPortfolio(keys: KucoinKeys): Promise<PortfolioData> {
  try {
    const rate = 95; // TODO: подтягивать из market.ts, как в mexc.ts
    const account = await kucoinRequest('GET', '/api/v1/accounts', keys, { type: 'trade' });

    const balances: Record<string, number> = {};
    for (const b of account.data || []) {
      const total = parseFloat(b.balance);
      if (total > 0) balances[b.currency] = total;
    }

    const assets: Asset[] = [];
    let total_usd = 0;
    let total_pnl = 0;
    const free_usdt = balances['USDT'] || 0;

    // Заглушка: в реальности нужно подтягивать цены через API KuCoin
    for (const [coin, amt] of Object.entries(balances)) {
      if (coin === 'USDT') {
        assets.push({ coin, amount: amt, price: 1, pnl: 0, total_usd: amt, total_rub: amt * rate });
        total_usd += amt;
        continue;
      }
      // TODO: fetch price
      const price = 0;
      const ausd = amt * price;
      if (ausd <= 1) continue;
      assets.push({
        coin,
        amount: amt,
        price,
        pnl: 0,
        total_usd: ausd,
        total_rub: ausd * rate,
      });
      total_usd += ausd;
    }

    assets.sort((a, b) => b.total_usd - a.total_usd);
    const inv = total_usd - free_usdt;
    const pnl_pct = inv > 0 ? (total_pnl / inv) * 100 : 0;

    return {
      status: 'success',
      total_usd,
      total_rub: total_usd * rate,
      free_usdt,
      free_rub: free_usdt * rate,
      pnl_percent: pnl_pct,
      usdt_rub_rate: rate,
      rate_updated: Math.floor(Date.now() / 1000),
      assets,
    };
  } catch (e: any) {
    return { status: 'error', message: e.message };
  }
}