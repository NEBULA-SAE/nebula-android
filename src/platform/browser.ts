import { Browser } from '@capacitor/browser';
import { isTauri } from './index';

/**
 * Открывает URL во встроенном браузере (мобильные) или в системном (ПК).
 * С защитой от открытия недоверенных доменов.
 */
export async function openExternalService(url: string): Promise<void> {
  // 1. Защита: разрешаем только проверенные P2P-сервисы
  const allowedHosts = [
    'p2p.binance.com',
    'www.binance.com',
    'p2p.bybit.com',
    'www.bybit.com',
    'p2p.mexc.com',
    'www.mexc.com',
    'xgram.io',
  ];

  try {
    const host = new URL(url).hostname;
    const isAllowed = allowedHosts.some(
      allowed => host === allowed || host.endsWith('.' + allowed)
    );
    if (!isAllowed) {
      console.warn('[security] Blocked untrusted URL:', url);
      return;
    }
  } catch {
    console.warn('[security] Invalid URL:', url);
    return;
  }

  // 2. Открытие в зависимости от платформы
  if (isTauri) {
    // Windows (Tauri) — открываем в системном браузере
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch (e) {
      console.warn('[browser] Tauri opener failed:', e);
      window.open(url, '_blank');
    }
  } else {
    // Android / iOS — встроенный браузер (Safari / Chrome Custom Tabs)
    try {
      await Browser.open({
        url,
        toolbarColor: '#050811',      // цвет под ваш дизайн (тёмный)
        presentationStyle: 'fullscreen', // iOS: на весь экран, как в Telegram
      });
    } catch (e) {
      console.warn('[browser] Capacitor Browser failed:', e);
      window.open(url, '_blank');
    }
  }
}