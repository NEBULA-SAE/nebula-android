// ============================================================
// NEBULA v2 - PRICE STREAM (WebSocket)
// Binance + KuCoin real-time candles.
// ============================================================

import type { Candle, Timeframe } from './candles';

const BINANCE_INTERVAL: Record<Timeframe, string> = {
  '1m': '1m', '15m': '15m', '1h': '1h', '1d': '1d', '1w': '1w', '1M': '1M', 'max': '',
};

const KUCOIN_INTERVAL: Record<Timeframe, string> = {
  '1m': '1min', '15m': '15min', '1h': '1hour', '1d': '1day', '1w': '1week', '1M': '1month', 'max': '',
};

const HEARTBEAT_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const MAX_ATTEMPTS = 10;

export interface PriceStreamOptions {
  ticker: string;
  timeframe: Timeframe;
  exchange?: 'binance' | 'kucoin';
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
  private exchange: 'binance' | 'kucoin';

  constructor(opts: PriceStreamOptions) {
    this.opts = opts;
    this.exchange = opts.exchange || 'binance';
    this.connect();
  }

  private connect(): void {
    if (this.destroyed) return;

    if (this.exchange === 'kucoin') {
      this.connectKucoin();
    } else {
      this.connectBinance();
    }
  }

  private connectBinance(): void {
    const interval = BINANCE_INTERVAL[this.opts.timeframe];
    if (!interval) {
      this.opts.onError?.('no-stream-for-tf');
      return;
    }

      const raw = this.opts.ticker.replace('/', '').toUpperCase();
    const symbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
    const url = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.opts.onError?.('ws-constructor-failed');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (this.destroyed) { try { this.ws?.close(); } catch {} return; }
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.opts.onOpen?.();
      console.log(`[stream] Binance open ${symbol} ${interval}`);
    };

    this.ws.onmessage = (ev) => {
      if (this.destroyed) return;
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
          if (candle.time > 0 && candle.close > 0) this.opts.onCandle(candle);
        }
      } catch { /* silent */ }
    };

    this.ws.onerror = () => this.opts.onError?.('ws-error');

    this.ws.onclose = (ev) => {
      if (this.destroyed) return;
      this.stopHeartbeat();
      this.opts.onClose?.();
      console.log(`[stream] Binance close code=${ev.code}`);
      if (ev.code !== 1000) this.scheduleReconnect();
    };
  }

  private connectKucoin(): void {
    const interval = KUCOIN_INTERVAL[this.opts.timeframe];
    if (!interval) {
      this.opts.onError?.('no-stream-for-tf');
      return;
    }

      const raw = this.opts.ticker.replace('/', '-').toUpperCase();
    const symbol = raw.endsWith('-USDT') ? raw : `${raw}-USDT`;
    const url = `wss://x-push-spot.kucoin.com`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.opts.onError?.('ws-constructor-failed');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      if (this.destroyed) { try { this.ws?.close(); } catch {} return; }
      this.reconnectAttempts = 0;
      const subMsg = {
        id: String(Date.now()),
        action: 'SUBSCRIBE',
        channel: 'kline',
        tradeType: 'SPOT',
        symbol,
        interval,
      };
      try { this.ws?.send(JSON.stringify(subMsg)); } catch {}
      this.startHeartbeat();
      this.opts.onOpen?.();
      console.log(`[stream] KuCoin open ${symbol} ${interval}`);
    };

    this.ws.onmessage = (ev) => {
      if (this.destroyed) return;
      try {
        const msg = JSON.parse(ev.data);
        if (msg.T === 'kline.SPOT' && msg.d) {
          const d = msg.d;
          const candle: Candle = {
            time: parseInt(d.O, 10) || Math.floor(Date.now() / 1000),
            open: parseFloat(d.o),
            high: parseFloat(d.h),
            low: parseFloat(d.l),
            close: parseFloat(d.c),
            volume: parseFloat(d.v),
          };
          if (candle.close > 0) this.opts.onCandle(candle);
        }
      } catch { /* silent */ }
    };

    this.ws.onerror = () => this.opts.onError?.('ws-error');

    this.ws.onclose = (ev) => {
      if (this.destroyed) return;
      this.stopHeartbeat();
      this.opts.onClose?.();
      console.log(`[stream] KuCoin close code=${ev.code}`);
      if (ev.code !== 1000) this.scheduleReconnect();
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
        } catch { /* silent */ }
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
      // Снимаем колбэки до close(), чтобы не получить «последний вздох»
      try { this.ws.onmessage = null; } catch { /* silent */ }
      try { this.ws.onerror = null; } catch { /* silent */ }
      try { this.ws.onclose = null; } catch { /* silent */ }
      try { this.ws.close(1000, 'destroy'); } catch { /* silent */ }
      this.ws = null;
    }
  }
}