// ═══════════════════════════════════════════════════════════════
// NEBULA · PLATFORM DETECTION
// Определяет среду: web / android (capacitor) / tauri (pc)
// ═══════════════════════════════════════════════════════════════

export type Platform = 'web' | 'android' | 'tauri';

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';

  // Tauri добавляет window.__TAURI_INTERNALS__
  if ((window as any).__TAURI_INTERNALS__) return 'tauri';

  // Capacitor добавляет window.Capacitor с методом isNativePlatform
  if ((window as any).Capacitor?.isNativePlatform?.()) return 'android';

  return 'web';
}

export const platform: Platform = detectPlatform();

export const isWeb = platform === 'web';
export const isAndroid = platform === 'android';
export const isTauri = platform === 'tauri';

export const isDesktop = isTauri;
export const isMobile = isAndroid;

console.log(`[platform] running on: ${platform}`);