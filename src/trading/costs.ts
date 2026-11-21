// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · TRADING COSTS MODEL
// Реалистичное моделирование комиссий, спреда и проскальзывания
// ═══════════════════════════════════════════════════════════════

export interface CostsConfig {
  takerFeeRate: number;   // напр. 0.001 = 0.10% (рыночный ордер / стоп)
  makerFeeRate: number;   // напр. 0.0002 = 0.02% (лимитный тейк)
  halfSpreadBps: number;  // половина спреда в б.п. (3 bps = 0.03%)
  impactBpsPer10k: number;// проскальзывание в б.п. на каждые $10 000 объёма
}

export const DEFAULT_COSTS: CostsConfig = {
  takerFeeRate: 0.001,
  makerFeeRate: 0.0002,
  halfSpreadBps: 3,
  impactBpsPer10k: 5,
};

export interface EntryFill {
  fillPrice: number;
  feeUsdt: number;
  slippagePct: number;
  netUsdt: number;
  coinQty: number;
}

export interface ExitFill {
  fillPrice: number;
  grossUsdt: number;
  feeUsdt: number;
  netUsdt: number;
  slippagePct: number;
}

export class TradingCosts {
  private cfg: CostsConfig;

  constructor(config: Partial<CostsConfig> = {}) {
    this.cfg = { ...DEFAULT_COSTS, ...config };
  }

  /**
   * Проскальзывание (доля, напр. 0.0005 = 0.05%) = половина спреда + impact от объёма
   */
  public calcSlippage(notionalUsdt: number, orderType: 'market' | 'limit'): number {
    if (orderType === 'limit' || notionalUsdt <= 0) return 0;
    const spread = this.cfg.halfSpreadBps / 10000;
    const impact = (Math.sqrt(notionalUsdt / 10000) * this.cfg.impactBpsPer10k) / 10000;
    return Math.min(0.02, spread + impact); // ограничиваем разумным потолком 2%
  }

  /**
   * Расчёт покупки (вход в позицию)
   */
  public calcBuy(
    marketPrice: number,
    capitalUsdt: number,
    orderType: 'market' | 'limit' = 'market'
  ): EntryFill {
    const feeRate = orderType === 'market' ? this.cfg.takerFeeRate : this.cfg.makerFeeRate;
    const slippage = this.calcSlippage(capitalUsdt, orderType);
    const fillPrice = marketPrice * (1 + slippage);
    const feeUsdt = capitalUsdt * feeRate;
    const netUsdt = Math.max(0, capitalUsdt - feeUsdt);
    const coinQty = fillPrice > 0 ? netUsdt / fillPrice : 0;

    return {
      fillPrice,
      feeUsdt,
      slippagePct: slippage * 100,
      netUsdt,
      coinQty,
    };
  }

  /**
   * Расчёт продажи (выход по тейку, стопу или вручную)
   */
  public calcSell(
    marketPrice: number,
    coinQty: number,
    orderType: 'market' | 'limit' = 'market'
  ): ExitFill {
    const estNotional = marketPrice * coinQty;
    const feeRate = orderType === 'market' ? this.cfg.takerFeeRate : this.cfg.makerFeeRate;
    const slippage = this.calcSlippage(estNotional, orderType);
    const fillPrice = marketPrice * (1 - slippage);
    const grossUsdt = coinQty * fillPrice;
    const feeUsdt = grossUsdt * feeRate;
    const netUsdt = Math.max(0, grossUsdt - feeUsdt);

    return {
      fillPrice,
      grossUsdt,
      feeUsdt,
      netUsdt,
      slippagePct: slippage * 100,
    };
  }
}

export const tradingCosts = new TradingCosts();