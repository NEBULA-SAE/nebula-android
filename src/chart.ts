// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CHART
// Фикс утечки памяти: убран двойной resize (autoSize + ResizeObserver)
// + updateCandles() для тихого автообновления без сброса зума
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

// ─── Размер контейнера ───
function getContainerSize(): { w: number; h: number } {
  const c = document.getElementById('chart-container');
  if (!c) return { w: 0, h: 0 };
  const rect = c.getBoundingClientRect();
  const w = Math.round(rect.width || c.clientWidth || c.offsetWidth || 0);
  const h = Math.round(rect.height || c.clientHeight || c.offsetHeight || 0);
  return { w, h };
}

// ─── Только autoScale цены. НЕ трогаем width/height — это ломает autoSize ───
function refreshAutoScale(): void {
  if (!state.chart) return;
  try {
    state.chart.priceScale('right').applyOptions({ autoScale: true });
  } catch { /* silent */ }
}

// ─── INIT CHART ───

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

  // Ждём, пока контейнер получит реальный размер (после применения desktop-CSS)
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
  console.log(`[chart] init with container size ${w}×${h}`);

  // autoSize: true — библиотека сама следит за размером контейнера.
  // НЕ добавляем свой ResizeObserver — это вызывает бесконечный цикл
  // (chart меняет canvas → observer реагирует → applyOptions → canvas меняется → ...).
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

  // Один отложенный проход — на случай, если CSS/шрифты применились позже.
  // Никаких [100, 300, 800, 1500, 3000] — это лишняя нагрузка.
  setTimeout(refreshAutoScale, 300);
}

// ─── CLEAR LINES ───

export function clearLines(): void {
  state.priceLines.forEach((l: any) => {
    try { state.candleSeries?.removePriceLine(l); } catch { /* silent */ }
  });
  state.priceLines = [];
  clearOrderbookLines();
}

export function clearOrderbookLines(): void {
  state.orderbookLines.forEach((l: any) => {
    try { state.candleSeries?.removePriceLine(l); } catch { /* silent */ }
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
  } catch (e) {
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
  } catch { /* silent */ }
}

// ─── ПОЛНОЕ ОБНОВЛЕНИЕ (новый тикер / смена tf) ───
// Сбрасывает зум на «показать всё», перерисовывает NOW.
// Вызывается из mobileAnalyze после clearLines().

export function setCandlesAndFit(candles: Candle[]): void {
  if (!state.candleSeries) return;
  try {
    state.candleSeries.setData(candles as any);
  } catch (e) {
    console.warn('[chart] setData failed:', e);
    return;
  }

  // Один проход сразу
  try { state.chart?.timeScale().fitContent(); } catch { /* silent */ }
  refreshAutoScale();

  // Один отложенный проход — на случай поздних CSS/размеров.
  // Раньше тут было 5 вызовов подряд — это и грузило WebView2.
  setTimeout(() => {
    try { state.chart?.timeScale().fitContent(); } catch { /* silent */ }
    refreshAutoScale();
  }, 400);
}

// ─── ТИХОЕ ОБНОВЛЕНИЕ (авто-refresh каждые N сек) ───
// НЕ трогает time-axis zoom — пользователь сохраняет свой масштаб.
// Обновляет данные + пересоздаёт единственную NOW-линию (без утечки),
// orderbook-стены остаются на месте.
// Вызывается из ui/timeframes.ts::refreshChartSilently().

export function updateCandles(candles: Candle[]): void {
  if (!state.candleSeries) return;
  if (!candles || candles.length === 0) return;

  try {
    state.candleSeries.setData(candles as any);
  } catch (e) {
    console.warn('[chart] updateCandles failed:', e);
    return;
  }

  // Убираем старую NOW-линию (только из priceLines, не трогаем orderbook)
  state.priceLines.forEach((l: any) => {
    try { state.candleSeries.removePriceLine(l); } catch { /* silent */ }
  });
  state.priceLines = [];

  // Ставим новую NOW по последней цене
  const price = candles[candles.length - 1].close;
  if (price > 0) drawNowLine(price);

  // Только price-axis autoScale, без fitContent — зум сохраняется
  refreshAutoScale();
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
  });
}