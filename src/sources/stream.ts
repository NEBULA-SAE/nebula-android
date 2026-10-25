// ============================================================
// NEBULA v2 - PRICE STREAM (WebSocket)
// Real-time candles from Binance WS.
// Auto-reconnect with exponential backoff + heartbeat.
// Fallback to REST handled by caller (timeframes.ts).
// ============================================================

import type { Candle, Timeframe } from './candles';

// Map our tf to Binance WS interval strings
const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1m':  '1m',
  '15m': '15m',
  '1h':  '1h',
  '1d':  '1d',
  '1w':  '1w',
  '1M':  '1M',
  'max': '',   // not supported - caller should use REST
};

const HEARTBEAT_MS = 30_000;    // keep connection alive through NAT
const MAX_BACKOFF_MS = 30_000;  // max delay between reconnects
const MAX_ATTEMPTS = 10;        // give up after 10 failed reconnects

export interface PriceStreamOptions {
  ticker: string;
  timeframe: Timeframe;
  onCandle: (candle: Candle) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: string) => void;
}

export class PriceStream {
  private ws: WebSocket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private destroyed = false;
  private opts: PriceStreamOptions;

  constructor(opts: PriceStreamOptions) {
    this.opts = opts;
    this.connect();
  }

  private connect(): void {
    if (this.destroyed) return;

    const interval = BINANCE_INTERVAL[this.opts.timeframe];
    if (!interval) {
      this.opts.onError?.('no-stream-for-tf');
      return;
    }

    const symbol = this.opts.ticker.replace('/', '').toUpperCase();
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;

    try {
      this.ws = new WebSocket(url);
    }
    catch {
      this.opts.onError?.('ws-constructor-failed');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (this.destroyed) {
        try { this.ws?.close(); } catch { /* silent */ }
        return;
      }
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.opts.onOpen?.();
      console.log(`[stream] open ${symbol} ${interval}`);
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.e === 'kline' && msg.k) {
          const k = msg.k;
          const candle: Candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          };
          if (candle.time > 0 && candle.close > 0) {
            this.opts.onCandle(candle);
          }
        }
      }
      catch { /* silent */ }
    };

    this.ws.onerror = () => {
      this.opts.onError?.('ws-error');
    };

    this.ws.onclose = (ev) => {
      if (this.destroyed) return;
      this.stopHeartbeat();
      this.opts.onClose?.();
      console.log(`[stream] close code=${ev.code}`);
      // 1000 = normal closure (do not reconnect)
      if (ev.code !== 1000) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_ATTEMPTS) {
      this.opts.onError?.('max-reconnect-attempts');
      return;
    }

    this.reconnectAttempts++;
    // 1s, 2s, 4s, 8s, 16s, 30s, 30s...
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), MAX_BACKOFF_MS);

    console.log(`[stream] reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ method: 'ping' }));
        }
        catch { /* silent */ }
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  destroy(): void {
    this.destroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(1000, 'destroy'); }
      catch { /* silent */ }
      this.ws = null;
    }
  }
}