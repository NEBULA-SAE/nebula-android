// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CHART
// + updateLastCandle() для WebSocket real-time
// ═══════════════════════════════════════════════════════════════

import { LineStyle } from 'lightweight-charts';
import { state } from './utils';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface WallsData {
  bestBidWall: { price: number; total: number };
  bestAskWall: { price: number; total: number };
  sourceCount?: number;
  sourcesFailed?: string[];
}

function getContainerSize(): { w: number; h: number } {
  const c = document.getElementById('chart-container');
  if (!c) return { w: 0, h: 0 };
  const rect = c.getBoundingClientRect();
  const w = Math.round(rect.width || c.clientWidth || c.offsetWidth || 0);
  const h = Math.round(rect.height || c.clientHeight || c.offsetHeight || 0);
  return { w, h };
}

function refreshAutoScale(): void {
  if (!state.chart) return;
  try {
    state.chart.priceScale('right').applyOptions({ autoScale: true });
  }
  catch { /* silent */ }
}

export function initChart(): void {
  const c = document.getElementById('chart-container');
  if (!c) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const LW = (window as any).LightweightCharts;
  if (!LW) {
    console.warn('[chart] LightweightCharts not loaded');
    return;
  }

  if (state.chart) {
    refreshAutoScale();
    return;
  }

  let tries = 0;
  const waitAndInit = () => {
    const { w, h } = getContainerSize();
    if ((w < 50 || h < 50) && tries < 40) {
      tries++;
      requestAnimationFrame(waitAndInit);
      return;
    }
    createChartNow(LW, c, w, h);
  };
  waitAndInit();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createChartNow(LW: any, c: HTMLElement, w: number, h: number): void {
  console.log(`[chart] init with container size ${w}x${h}`);

  state.chart = LW.createChart(c, {
    autoSize: true,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: '#6b7a94',
      fontFamily: "'JetBrains Mono', monospace",
    },
    grid: {
      vertLines: { color: 'rgba(140,170,220,0.04)' },
      horzLines: { color: 'rgba(140,170,220,0.04)' },
    },
    rightPriceScale: {
      borderColor: 'rgba(140,170,220,0.12)',
      autoScale: true,
    },
    timeScale: {
      borderColor: 'rgba(140,170,220,0.12)',
      timeVisible: false,
      barSpacing: 8,
      minBarSpacing: 3,
      rightOffset: 5,
    },
    crosshair: { mode: 0 },
    handleScale: { axisPressedMouseMove: false, mouseWheel: true, pinch: true },
  });

  state.candleSeries = state.chart.addCandlestickSeries({
    upColor: '#45e0a8',
    downColor: '#ff6584',
    borderUpColor: '#45e0a8',
    borderDownColor: '#ff6584',
    wickUpColor: '#45e0a8',
    wickDownColor: '#ff6584',
    borderVisible: false,
  });

  setTimeout(refreshAutoScale, 300);
}

export function clearLines(): void {
  state.priceLines.forEach((l: any) => {
    try { state.candleSeries?.removePriceLine(l); }
    catch { /* silent */ }
  });
  state.priceLines = [];
  clearOrderbookLines();
}

export function clearOrderbookLines(): void {
  state.orderbookLines.forEach((l: any) => {
    try { state.candleSeries?.removePriceLine(l); }
    catch { /* silent */ }
  });
  state.orderbookLines = [];
}

export function mapCandleArray(x: string[]): Candle {
  return {
    time: parseInt(x[0], 10),
    volume: parseFloat(x[1]),
    close: parseFloat(x[2]),
    high: parseFloat(x[3]),
    low: parseFloat(x[4]),
    open: parseFloat(x[5]),
  };
}

export async function fetchCandles(t: string): Promise<Candle[]> {
  const r = await fetch(
    `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${t}_USDT&interval=1d&limit=120`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!r.ok) throw new Error('Not found');
  const d = await r.json();
  if (!d || !d.length) throw new Error('Not found');
  return d.map(mapCandleArray);
}

export function drawOrderbookWalls(wallsData: WallsData | null): void {
  clearOrderbookLines();
  if (!wallsData || !wallsData.bestBidWall || !wallsData.bestAskWall) return;
  if (!state.candleSeries) return;
  try {
    const ls = LineStyle.LargeDashed;
    const bidLine = state.candleSeries.createPriceLine({
      price: wallsData.bestBidWall.price,
      color: 'rgba(69, 224, 168, 0.8)',
      lineWidth: 2,
      lineStyle: ls,
      axisLabelVisible: true,
      title: '🛡️ BUY',
    });
    const askLine = state.candleSeries.createPriceLine({
      price: wallsData.bestAskWall.price,
      color: 'rgba(255, 101, 132, 0.8)',
      lineWidth: 2,
      lineStyle: ls,
      axisLabelVisible: true,
      title: '🧱 SELL',
    });
    state.orderbookLines.push(bidLine, askLine);
  }
  catch (e) {
    console.warn('drawOrderbookWalls failed', e);
  }
}

export function drawNowLine(price: number): void {
  if (!state.candleSeries) return;
  try {
    const line = state.candleSeries.createPriceLine({
      price,
      color: 'rgba(94,203,255,0.7)',
      lineWidth: 2,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: 'NOW',
    });
    state.priceLines.push(line);
  }
  catch { /* silent */ }
}

export function setCandlesAndFit(candles: Candle[]): void {
  if (!state.candleSeries) return;
  try {
    state.candleSeries.setData(candles as any);
  }
  catch (e) {
    console.warn('[chart] setData failed:', e);
    return;
  }

  try { state.chart?.timeScale().fitContent(); }
  catch { /* silent */ }
  refreshAutoScale();

  setTimeout(() => {
    try { state.chart?.timeScale().fitContent(); }
    catch { /* silent */ }
    refreshAutoScale();
  }, 400);
}

export function updateCandles(candles: Candle[]): void {
  if (!state.candleSeries) return;
  if (!candles || candles.length === 0) return;

  try {
    state.candleSeries.setData(candles as any);
  }
  catch (e) {
    console.warn('[chart] updateCandles failed:', e);
    return;
  }

  // Remove old NOW line (only from priceLines, keep orderbook)
  state.priceLines.forEach((l: any) => {
    try { state.candleSeries.removePriceLine(l); }
    catch { /* silent */ }
  });
  state.priceLines = [];

  const price = candles[candles.length - 1].close;
  if (price > 0) drawNowLine(price);

  refreshAutoScale();
}

// ═══════════════════════════════════════════════════════════════
// REAL-TIME: update single last bar (WebSocket)
// <1ms, uses lightweight-charts update() which only touches last bar
// ═══════════════════════════════════════════════════════════════

export function updateLastCandle(candle: Candle): void {
  if (!state.candleSeries) return;
  if (!candle || !candle.time || candle.close <= 0) return;
  try {
    state.candleSeries.update(candle as any);
  }
  catch (e) {
    console.warn('[chart] updateLastCandle failed:', e);
  }
}

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.assign(window as any, {
    initChart,
    clearLines,
    clearOrderbookLines,
    fetchCandles,
    mapCandleArray,
    drawOrderbookWalls,
    drawNowLine,
    setCandlesAndFit,
    updateCandles,
    updateLastCandle,
  });
}