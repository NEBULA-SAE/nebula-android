// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · DASH NETWORK (SOURCES)
// Публичный Allnodes RPC + DashCentral + Blockchair + Bybit
// ═══════════════════════════════════════════════════════════════

const IS_DEV = (import.meta as any).env?.DEV;

// Используем публичный бесплатный узел, чтобы не хранить ключи в коде
const PUBLIC_RPC = 'https://dash-rpc.publicnode.com';

const DASHCENTRAL = IS_DEV ? '/proxy/dashcentral' : 'https://www.dashcentral.org';
const BLOCKCHAIR  = IS_DEV ? '/proxy/blockchair'  : 'https://api.blockchair.com';

export interface DashNetworkStats {
  status: 'success' | 'error';
  masternodes: {
    enabled: number;
    total: number;
    source: string;
    weighted?: number;
  } | null;
  mining: {
    hashrate_ph: number;
    difficulty: number;
    source: string;
  } | null;
  derivatives: {
    funding_rate_pct: number;
    open_interest_usd: number;
    last_price: number;
  } | null;
}

// ─── JSON-RPC ───

async function publicRpc(method: string, params: any[] = []): Promise<any> {
  try {
    const r = await fetch(PUBLIC_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 'nebula' }),
      signal: AbortSignal.timeout(8000),
    });

    const raw = await r.text();
    if (raw.trim().startsWith('<')) throw new Error('HTML response');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const data = JSON.parse(raw);
    if (data.error) throw new Error(data.error.message || 'rpc error');
    return data.result;
  } catch (e: any) {
    throw new Error(`RPC failed: ${e.message}`);
  }
}

// ─── Мастерноды ───

async function getMasternodes() {
  try {
    const result = await publicRpc('masternode', ['count']);
    const enabled = parseInt(result?.enabled ?? 0);
    const total = parseInt(result?.total ?? 0);
    if (total > 0) return { enabled, total, source: 'allnodes' };
  } catch (e: any) {
    console.warn('[dash] allnodes MN:', e.message);
  }
  try {
    const r = await fetch(`${DASHCENTRAL}/api/v1/public`, { signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const data = await r.json();
      const g = data.general || {};
      const enabled = parseInt(g.consensus_masternodes ?? 0);
      const weighted = parseInt(g.consensus_masternodes_weighted ?? 0);
      const registered = parseInt(g.registered_masternodes ?? 0);
      if (enabled > 0) {
        const total = registered > 0 ? enabled + registered : enabled;
        return { enabled, total, weighted, source: 'dashcentral' };
      }
    }
  } catch (e: any) {
    console.warn('[dash] dashcentral MN:', e.message);
  }
  return null;
}

// ─── Майнинг ───

async function getMining() {
  try {
    const result = await publicRpc('getmininginfo');
    const hashrate = parseFloat(result?.networkhashps ?? 0);
    const difficulty = parseFloat(result?.difficulty ?? 0);
    if (hashrate > 0) {
      return {
        hashrate_ph: Math.round(hashrate / 1e15 * 100) / 100,
        difficulty: Math.round(difficulty),
        source: 'allnodes',
      };
    }
  } catch (e: any) {
    console.warn('[dash] allnodes mining:', e.message);
  }
  try {
    const r = await fetch(`${BLOCKCHAIR}/dash/stats`, { signal: AbortSignal.timeout(6000) });
    if (r.ok) {
      const j = await r.json();
      const d = j.data || {};
      const hashrate = parseFloat(d.hashrate_24h || d.hashrate_1h || 0);
      return {
        hashrate_ph: Math.round(hashrate / 1e15 * 100) / 100,
        difficulty: Math.round(parseFloat(d.difficulty ?? 0)),
        source: 'blockchair',
      };
    }
  } catch (e: any) {
    console.warn('[dash] blockchair mining:', e.message);
  }
  return null;
}

// ─── Деривативы (Bybit) ───

async function getDerivatives() {
  try {
    const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=DASHUSDT',
      { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`bybit HTTP ${r.status}`);
    const j = await r.json();
    if (j.retCode !== 0) throw new Error(`bybit ${j.retMsg}`);
    const d = j.result?.list?.[0];
    if (!d) throw new Error('bybit empty');
    return {
      funding_rate_pct: Math.round(parseFloat(d.fundingRate ?? 0) * 100 * 10000) / 10000,
      open_interest_usd: Math.round(parseFloat(d.openInterestValue ?? 0)),
      last_price: parseFloat(d.lastPrice ?? 0),
    };
  } catch (e: any) {
    console.warn('[dash] derivatives:', e.message);
    return null;
  }
}

// ─── Публичный API ───

export async function getDashNetworkStats(): Promise<DashNetworkStats> {
  const [masternodes, mining, derivatives] = await Promise.all([
    getMasternodes(),
    getMining(),
    getDerivatives(),
  ]);
  return {
    status: masternodes || mining || derivatives ? 'success' : 'error',
    masternodes,
    mining,
    derivatives,
  };
}