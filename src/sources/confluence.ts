// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MULTI-TF CONFLUENCE
// Сводит сигналы 1h + 1d + 1w в один вердикт
// ═══════════════════════════════════════════════════════════════

import { fetchCandlesWithSource } from './candles';
import type { Timeframe } from './candles';
import { calcRsi, calcMacd, calcStochRsi } from '../indicators';

export type ConfluenceTF = '1h' | '1d' | '1w';

export interface TFSignal {
  tf: ConfluenceTF;
  rsi: number;
  macdBullish: boolean;
  macdHist: number;
  stoch: number;
  score: number;
  verdict: 'buy' | 'hold' | 'avoid';
  ok: boolean;
}

export interface ConfluenceResult {
  status: 'success' | 'error';
  ticker: string;
  signals: TFSignal[];
  buyCount: number;
  avoidCount: number;
  totalCount: number;
  overall: 'strong_buy' | 'buy' | 'hold' | 'avoid' | 'no_data';
  confidence: number;
  message?: string;
}

const TFS: ConfluenceTF[] = ['1h', '1d', '1w'];

async function analyzeTF(ticker: string, tf: ConfluenceTF): Promise<TFSignal> {
  const empty: TFSignal = {
    tf, rsi: 50, macdBullish: false, macdHist: 0, stoch: 50,
    score: 0, verdict: 'hold', ok: false,
  };

  try {
    const { data } = await fetchCandlesWithSource(ticker, tf as Timeframe);
    if (!data || data.length < 30) return empty;

    const closes = data.map(c => c.close);
    const rsi = calcRsi(closes);
    const macd = calcMacd(closes);
    const stoch = calcStochRsi(closes);

    let score = 0;

    // RSI: 0..100
    if (rsi < 30) score += 25;
    else if (rsi < 45) score += 10;
    else if (rsi > 70) score -= 25;
    else if (rsi > 60) score -= 10;

    // MACD: гистограмма
    if (macd.hist > 0) score += 15;
    else score -= 15;

    // Stoch RSI: 0..100
    if (stoch < 20) score += 10;
    else if (stoch > 80) score -= 10;

    let verdict: 'buy' | 'hold' | 'avoid' = 'hold';
    if (score >= 20) verdict = 'buy';
    else if (score <= -20) verdict = 'avoid';

    return {
      tf,
      rsi,
      macdBullish: macd.hist > 0,
      macdHist: macd.hist,
      stoch,
      score,
      verdict,
      ok: true,
    };
  } catch {
    return empty;
  }
}

export async function getConfluence(ticker: string): Promise<ConfluenceResult> {
  const upper = ticker.toUpperCase();

  try {
    const signals = await Promise.all(TFS.map(tf => analyzeTF(upper, tf)));
    const okSignals = signals.filter(s => s.ok);

    if (okSignals.length < 2) {
      return {
        status: 'error', ticker: upper, signals,
        buyCount: 0, avoidCount: 0, totalCount: okSignals.length,
        overall: 'no_data', confidence: 0,
        message: 'Not enough timeframes available',
      };
    }

    const buyCount = okSignals.filter(s => s.verdict === 'buy').length;
    const avoidCount = okSignals.filter(s => s.verdict === 'avoid').length;
    const totalCount = okSignals.length;

    let overall: ConfluenceResult['overall'] = 'hold';
    let confidence = 50;

    if (buyCount === totalCount) {
      overall = 'strong_buy';
      confidence = 85 + totalCount * 4; // 3/3 → 97
    } else if (buyCount >= 2 && avoidCount === 0) {
      overall = 'buy';
      confidence = 65 + buyCount * 5; // 2/3 → 75
    } else if (avoidCount === totalCount) {
      overall = 'avoid';
      confidence = 80 + totalCount * 4; // 3/3 → 92
    } else if (avoidCount >= 2) {
      overall = 'avoid';
      confidence = 60 + avoidCount * 5;
    } else {
      overall = 'hold';
      confidence = 40 + (buyCount + avoidCount) * 5;
    }

    confidence = Math.min(99, confidence);

    return {
      status: 'success',
      ticker: upper,
      signals,
      buyCount,
      avoidCount,
      totalCount,
      overall,
      confidence,
    };
  } catch (e: any) {
    return {
      status: 'error', ticker: upper, signals: [],
      buyCount: 0, avoidCount: 0, totalCount: 0,
      overall: 'no_data', confidence: 0,
      message: String(e?.message || e),
    };
  }
}