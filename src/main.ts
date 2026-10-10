// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MAIN
// Точка входа. Гарантированная загрузка всех модулей.
// ═══════════════════════════════════════════════════════════════

// ─── Engine (side-effect: регистрируют функции/данные) ───
import { Capacitor } from '@capacitor/core';
import { CapacitorHttp } from '@capacitor/core';

// В APK патчим fetch на нативный HTTP — обходит CORS
import './utils';
import './i18n';
import './crypto';
import './worker';
import './chart';
import './indicators';
import './patterns';
import './ai';
import './oracle';
import './market';
import './trading';

// ─── Sources ───
import './sources/candles';
import './sources/orderbook';
import './sources/funding';
import './sources/dash';
import './sources/whale-futures';
import './sources/mexc';

// ─── UI (side-effect: регистрируют функции в window) ───
import './ui/splash';
import './ui/terms';
import './ui/tooltip';
import './ui/screens';
import './ui/scanner';
import './ui/whale';
import './ui/oracle';
import './ui/market';
import './ui/learning';
import './ui/dash';
import './ui/diagnostics';

// ─── Init (запускает приложение) ───
import { initApp } from './ui/init';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}