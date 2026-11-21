// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · BACKTEST ENGINE
// Прогон стратегии по историческим свечам с учётом TradingCosts
// ═══════════════════════════════════════════════════════════════

import type { Candle } from '../sources/candles';
import { tradingCosts } from '../trading/costs';

export interface BacktestParams {
  initialCapital: number; // стартовый баланс, напр. 10000
  rsiPeriod: number;      // обычно 14
  rsiBuyBelow: number;    // вход в лонг при RSI < порога (напр. 35)
  takeProfitPct: number;  // тейк-профит в % (напр. 10)
  stopLossPct: number;    // стоп-лосс в % (напр. 5)
  positionPct: number;    // доля депозита на сделку (напр. 50%)
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnlUsdt: number;
  pnlPct: number;
  feesUsdt: number;
  reason: 'TP' | 'SL' | 'END';
}

export interface BacktestResult {
  trades: BacktestTrade[];
  equityCurve: number[];
  initialCapital: number;
  finalCapital: number;
  totalReturnPct: number;
  buyAndHoldPct: number;
  winRate: number;
  profitFactor: number;
  maxDrawdownPct: number;
  totalFeesUsdt: number;
  candlesCount: number;
}

export const DEFAULT_BACKTEST_PARAMS: BacktestParams = {
  initialCapital: 10000,
  rsiPeriod: 14,
  rsiBuyBelow: 35,
  takeProfitPct: 10,
  stopLossPct: 5,
  positionPct: 50,
};

/** Быстрый расчёт серии RSI (Wilder) за один проход O(N) */
function computeRsiSeries(closes: number[], period: number): number[] {
  const rsi = new Array<number>(closes.length).fill(50);
  if (closes.length <= period) return rsi;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gainSum += diff;
    else lossSum -= diff;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

export function runBacktest(
  candles: Candle[],
  partialParams: Partial<BacktestParams> = {}
): BacktestResult {
  const p: BacktestParams = { ...DEFAULT_BACKTEST_PARAMS, ...partialParams };

  if (!candles || candles.length < p.rsiPeriod + 5) {
    return {
      trades: [],
      equityCurve: [p.initialCapital],
      initialCapital: p.initialCapital,
      finalCapital: p.initialCapital,
      totalReturnPct: 0,
      buyAndHoldPct: 0,
      winRate: 0,
      profitFactor: 0,
      maxDrawdownPct: 0,
      totalFeesUsdt: 0,
      candlesCount: candles?.length || 0,
    };
  }

  const closes = candles.map(c => c.close);
  const rsiSeries = computeRsiSeries(closes, p.rsiPeriod);

  let cash = p.initialCapital;
  let totalFeesUsdt = 0;
  const trades: BacktestTrade[] = [];
  const equityCurve: number[] = [];

  let pos: {
    entryTime: number;
    entryPrice: number;
    capitalUsed: number;
    coinQty: number;
    entryFee: number;
    tpPrice: number;
    slPrice: number;
  } | null = null;

  let peakEquity = p.initialCapital;
  let maxDrawdownPct = 0;

  for (let i = p.rsiPeriod; i < candles.length; i++) {
    const c = candles[i];

    // 1. Проверяем открытую позицию (консервативно: сначала SL, потом TP)
    if (pos) {
      let exitReason: 'TP' | 'SL' | null = null;
      let rawExitPrice = c.close;

      if (c.low <= pos.slPrice) {
        exitReason = 'SL';
        rawExitPrice = pos.slPrice;
      } else if (c.high >= pos.tpPrice) {
        exitReason = 'TP';
        rawExitPrice = pos.tpPrice;
      }

      if (exitReason) {
        const exitFill = tradingCosts.calcSell(
          rawExitPrice,
          pos.coinQty,
          exitReason === 'TP' ? 'limit' : 'market'
        );
        cash += exitFill.netUsdt;
        const fees = pos.entryFee + exitFill.feeUsdt;
        totalFeesUsdt += fees;
        const pnlUsdt = exitFill.netUsdt - pos.capitalUsed;
        const pnlPct = pos.capitalUsed > 0 ? (pnlUsdt / pos.capitalUsed) * 100 : 0;

        trades.push({
          entryTime: pos.entryTime,
          exitTime: c.time,
          entryPrice: pos.entryPrice,
          exitPrice: exitFill.fillPrice,
          pnlUsdt,
          pnlPct,
          feesUsdt: fees,
          reason: exitReason,
        });
        pos = null;
      }
    }

    // 2. Ищем вход, если нет открытой позиции (RSI ниже порога + разворотная/не падающая ниже минимума свеча)
    if (!pos && i < candles.length - 1) {
      if (rsiSeries[i] <= p.rsiBuyBelow) {
        const capitalToUse = cash * (p.positionPct / 100);
        if (capitalToUse >= 10) {
          const entryFill = tradingCosts.calcBuy(c.close, capitalToUse, 'market');
          cash -= capitalToUse;
          pos = {
            entryTime: c.time,
            entryPrice: entryFill.fillPrice,
            capitalUsed: capitalToUse,
            coinQty: entryFill.coinQty,
            entryFee: entryFill.feeUsdt,
            tpPrice: entryFill.fillPrice * (1 + p.takeProfitPct / 100),
            slPrice: entryFill.fillPrice * (1 - p.stopLossPct / 100),
          };
        }
      }
    }

    // 3. Считаем текущее equity и просадку
    const equity = cash + (pos ? pos.coinQty * c.close : 0);
    equityCurve.push(equity);
    if (equity > peakEquity) peakEquity = equity;
    if (peakEquity > 0) {
      const dd = ((peakEquity - equity) / peakEquity) * 100;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }
  }

  // Закрываем незавершённую позицию по последней свече
  if (pos) {
    const last = candles[candles.length - 1];
    const exitFill = tradingCosts.calcSell(last.close, pos.coinQty, 'market');
    cash += exitFill.netUsdt;
    const fees = pos.entryFee + exitFill.feeUsdt;
    totalFeesUsdt += fees;
    const pnlUsdt = exitFill.netUsdt - pos.capitalUsed;
    const pnlPct = pos.capitalUsed > 0 ? (pnlUsdt / pos.capitalUsed) * 100 : 0;

    trades.push({
      entryTime: pos.entryTime,
      exitTime: last.time,
      entryPrice: pos.entryPrice,
      exitPrice: exitFill.fillPrice,
      pnlUsdt,
      pnlPct,
      feesUsdt: fees,
      reason: 'END',
    });
    equityCurve[equityCurve.length - 1] = cash;
  }

  const finalCapital = cash;
  const totalReturnPct = ((finalCapital - p.initialCapital) / p.initialCapital) * 100;

  const firstClose = candles[p.rsiPeriod].close;
  const lastClose = candles[candles.length - 1].close;
  const buyAndHoldPct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;

  const wins = trades.filter(t => t.pnlUsdt > 0);
  const losses = trades.filter(t => t.pnlUsdt <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const grossProfit = wins.reduce((s, t) => s + t.pnlUsdt, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsdt, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 0);

  return {
    trades,
    equityCurve,
    initialCapital: p.initialCapital,
    finalCapital,
    totalReturnPct,
    buyAndHoldPct,
    winRate,
    profitFactor,
    maxDrawdownPct,
    totalFeesUsdt,
    candlesCount: candles.length,
  };
}