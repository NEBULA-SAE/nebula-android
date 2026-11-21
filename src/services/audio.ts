// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · AUDIO SERVICE (Web Audio API, в стиле aggr.trade)
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'nebula_audio_alerts';

class AudioService {
  private ctx: AudioContext | null = null;
  private enabled: boolean = false;
  private unlocked: boolean = false;
  private lastPlayed: Map<string, number> = new Map();

  constructor() {
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      this.enabled = false;
    }

    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlocked = true;
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || !this.unlocked) return null;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? '1' : '0');
    } catch {}

    if (this.enabled) {
      this.ensureContext();
      this.playTone(660, 0.08, 'sine', 0.07, 0);
      this.playTone(880, 0.12, 'sine', 0.07, 0.07);
    }
    return this.enabled;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.09,
    delay: number = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    // Плавная огибающая без щелчков
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /**
   * Звук активности кита (с защитой от спама — по умолчанию кулдаун 60 сек на один тикер/направление)
   */
  public playWhaleAlert(
    pressure: 'buying' | 'selling' | 'absorption' | 'neutral',
    score: number,
    cooldownKey: string = 'whale',
    cooldownMs: number = 60000
  ): void {
    if (!this.enabled) return;

    const now = Date.now();
    const prev = this.lastPlayed.get(cooldownKey) || 0;
    if (now - prev < cooldownMs) return;
    this.lastPlayed.set(cooldownKey, now);

    // Громкость чуть выше при высоком Whale Score
    const vol = score >= 75 ? 0.13 : 0.085;

    if (pressure === 'buying') {
      // Восходящий чистый импульс (покупка кита)
      this.playTone(523.25, 0.12, 'triangle', vol, 0);      // C5
      this.playTone(659.25, 0.14, 'triangle', vol, 0.08);   // E5
      if (score >= 70) {
        this.playTone(783.99, 0.22, 'sine', vol, 0.16);     // G5
      }
    } else if (pressure === 'selling') {
      // Нисходящий плотный тон (сброс кита)
      this.playTone(392.0, 0.14, 'sawtooth', vol * 0.7, 0);    // G4
      this.playTone(293.66, 0.22, 'triangle', vol, 0.1);       // D4
    } else {
      // Поглощение / аномалия объёма — сонар-пинг кита
      this.playTone(740, 0.28, 'sine', vol, 0);
      this.playTone(1110, 0.2, 'sine', vol * 0.5, 0.12);
    }
  }

  /**
   * Задел под src/ui/oracle.ts (сигнал на strong_buy / avoid)
   */
  public playOracleAlert(verdict: string, cooldownKey: string = 'oracle'): void {
    if (!this.enabled) return;
    const now = Date.now();
    const prev = this.lastPlayed.get(cooldownKey) || 0;
    if (now - prev < 90000) return;
    this.lastPlayed.set(cooldownKey, now);

    if (verdict === 'strong_buy') {
      this.playTone(587.33, 0.1, 'sine', 0.1, 0);
      this.playTone(880.0, 0.12, 'sine', 0.1, 0.09);
      this.playTone(1174.66, 0.24, 'triangle', 0.11, 0.18);
    } else if (verdict === 'avoid') {
      this.playTone(260, 0.18, 'sawtooth', 0.07, 0);
      this.playTone(220, 0.26, 'sawtooth', 0.07, 0.14);
    }
  }
}

export const audioService = new AudioService();