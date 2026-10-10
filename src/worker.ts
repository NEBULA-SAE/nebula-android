// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · WORKER
// Web Worker для тяжёлых вычислений (RSI, сканер монет)
//
// Использование:
//   import { wCall } from './worker';
//   const rsi = await wCall('rsi', { closes: [...] });
//   const results = await wCall('scan-batch', [{ ticker, closes, highs, lows, volumes }, ...]);
// ═══════════════════════════════════════════════════════════════

// ─── ТИПЫ ───

export type WCallType = 'rsi' | 'scan-batch';

/** Одна монета для батч-сканирования */
export interface ScanItem {
  ticker: string;
  closes: number[];
  highs: number[];
  lows: number[];
  volumes?: number[];
}

/** Результат сканирования по одной монете */
export interface ScanResult {
  ticker: string;
  /** Пропущена (RSI > 55 или отскок > 45%) */
  skip?: number;
  /** RSI на момент сканирования */
  rsi?: number;
  /** Отскок от 120d-минимума, % */
  rebound?: number;
  /** Падение от 120d-максимума, % */
  drop?: number;
  /** Признак активности китов (аномалия объёма) */
  isWhaleActive?: boolean;
  /** Ошибка при обработке — вместо тихих пропусков */
  error?: string;
}

/** Данные для одиночного RSI */
export interface RsiData {
  closes: number[];
}

// ─── INLINE WORKER CODE ───
// Строка с кодом, который исполнится в отдельном потоке.
// Отдельный файл не нужен — используем Blob URL.

const WORKER_CODE = `
'use strict';

self.onmessage = function (e) {
  const msg = e.data || {};
  const { id, type, data } = msg;

  try {
    if (type === 'rsi') {
      const closes = (data && data.closes) || [];
      const result = calcRSI(closes, 14);
      self.postMessage({ id, result });
      return;
    }

    if (type === 'scan-batch') {
      const items = Array.isArray(data) ? data : [];
      const out = [];

      for (let k = 0; k < items.length; k++) {
        const item = items[k];
        try {
          const closes = item.closes || [];
          const highs = item.highs || [];
          const lows = item.lows || [];

          const rsi = calcRSI(closes, 14);

          // Быстрые фильтры — если RSI перегрет или цена уже отскочила
          if (rsi > 55) { out.push({ ticker: item.ticker, skip: 1 }); continue; }

          const max120 = Math.max.apply(null, highs);
          const min120 = Math.min.apply(null, lows);
          const cp = closes[closes.length - 1];
          const rebound = ((cp - min120) / min120) * 100;

          if (rebound > 45) { out.push({ ticker: item.ticker, skip: 1 }); continue; }

          const drop = ((max120 - cp) / max120) * 100;

          // Проверка аномалии объёма — если объём последних 2 свечей
          // превышает средний за 30 дней более чем на 80%
          let isWhaleActive = false;
          const volumes = item.volumes || [];
          if (volumes.length >= 31) {
            let sumVol = 0;
            for (let i = volumes.length - 31; i < volumes.length - 1; i++) {
              sumVol += volumes[i];
            }
            const avgVol30d = sumVol / 30;
            if (avgVol30d > 0) {
              const maxRecent = Math.max(
                volumes[volumes.length - 1],
                volumes[volumes.length - 2]
              );
              const spikeRatio = (maxRecent / avgVol30d) * 100;
              isWhaleActive = spikeRatio > 180;
            }
          }

          out.push({ ticker: item.ticker, rsi, rebound, drop, isWhaleActive });
        } catch (err) {
          out.push({ ticker: item.ticker, error: String(err) });
        }
      }

      self.postMessage({ id, result: out });
      return;
    }

    // Неизвестный тип — сообщаем об ошибке
    self.postMessage({ id, error: 'unknown type: ' + type });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};

function calcRSI(c, p) {
  p = p || 14;
  if (!c || c.length < p + 1) return 50;

  let g = 0, l = 0;
  for (let i = 1; i <= p; i++) {
    const d = c[i] - c[i - 1];
    if (d >= 0) g += d;
    else l -= d;
  }

  let ag = g / p;
  let al = l / p;

  for (let i = p + 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    if (d >= 0) {
      ag = (ag * (p - 1) + d) / p;
      al = (al * (p - 1)) / p;
    } else {
      ag = (ag * (p - 1)) / p;
      al = (al * (p - 1) - d) / p;
    }
  }

  if (al === 0) return 100;
  return 100 - (100 / (1 + ag / al));
}
`;

// ─── СОЗДАНИЕ WORKER ───

const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);
const scanWorker = new Worker(workerUrl);

// ─── МОСТ PROMISE ↔ POSTMESSAGE ───

let nextId = 0;
const pending = new Map<number, (result: any) => void>();

scanWorker.onmessage = (e: MessageEvent) => {
  const { id, result, error } = e.data || {};
  const resolver = pending.get(id);
  if (!resolver) return;
  pending.delete(id);

  if (error) {
    console.warn('[worker] error for id', id, ':', error);
    resolver(null);
  } else {
    resolver(result);
  }
};

scanWorker.onerror = (e) => {
  console.error('[worker] fatal error:', e);
  // Резолвим все ожидающие Promise, чтобы не было утечек
  for (const [id, resolver] of pending) {
    resolver(null);
  }
  pending.clear();
};

// ─── ПУБЛИЧНОЕ API ───

/**
 * Вызов функции в Web Worker.
 *
 * @example
 *   const rsi = await wCall('rsi', { closes: [...] });
 *   const results = await wCall('scan-batch', [...]);
 */
export function wCall(type: 'rsi', data: RsiData): Promise<number>;
export function wCall(type: 'scan-batch', data: ScanItem[]): Promise<ScanResult[]>;
export function wCall(type: WCallType, data: any): Promise<any> {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    scanWorker.postMessage({ id, type, data });
  });
}

/**
 * Освободить ресурсы воркера (при закрытии приложения).
 */
export function destroyWorker(): void {
  pending.clear();
  try {
    scanWorker.terminate();
  } catch (e) {
    console.warn('[worker] terminate:', e);
  }
  try {
    URL.revokeObjectURL(workerUrl);
  } catch (e) {
    // silent
  }
}
// ─── Экспорт в window для диагностики ───
if (typeof window !== 'undefined') {
  (window as any).wCall = wCall;
}