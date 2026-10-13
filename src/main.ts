// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MAIN
// Точка входа. Гарантированная загрузка всех модулей.
// ═══════════════════════════════════════════════════════════════

// ─── 1. ПЛАТФОРМА (должно быть САМЫМ ПЕРВЫМ) ───
import { installFetchPatch } from './platform/http';
import { platform, isTauri } from './platform';

installFetchPatch();

// ─── 2. Tauri: mini-режим, титульник, хоткеи, shutdown ───
if (isTauri) {
  document.documentElement.classList.add('tauri');

  const params = new URLSearchParams(location.search);
  const isMini = params.has('mini');

  // ─── Mini-режим ───
  if (isMini) {
    document.body.classList.add('mini-mode');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/styles/mini.css';
    document.head.appendChild(link);
  }

  // ─── Показать главное окно после того как HTML отрисован ───
  // (окно стартует с visible: false в tauri.conf.json)
  if (!isMini) {
    (async () => {
      try {
        const { Window } = await import('@tauri-apps/api/window');
        const mainWin = await Window.getByLabel('main');
        if (mainWin) {
          // Небольшая задержка чтобы WebView успел нарисовать сплэш
          setTimeout(async () => {
            try {
              await mainWin.show();
              await mainWin.setFocus();
              console.log('[tauri] main window shown');
            } catch (e) {
              console.warn('[tauri] show failed:', e);
            }
          }, 100);
        }
      } catch (e) {
        console.warn('[tauri] window show failed:', e);
      }
    })();
  }

  // ─── Custom Title Bar ───
  (async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      const btnMin = document.getElementById('tb-min');
      const btnMax = document.getElementById('tb-max');
      const btnClose = document.getElementById('tb-close');
      const dragArea = document.querySelector('.tauri-titlebar-left');

      if (btnMin) btnMin.addEventListener('click', () => win.minimize());

      if (btnMax) btnMax.addEventListener('click', async () => {
        const isMax = await win.isMaximized();
        if (isMax) await win.unmaximize();
        else await win.maximize();
      });

      if (btnClose) btnClose.addEventListener('click', () => win.close());

      if (dragArea) {
        dragArea.addEventListener('dblclick', async () => {
          const isMax = await win.isMaximized();
          if (isMax) await win.unmaximize();
          else await win.maximize();
        });
      }

      console.log('[tauri] custom title bar wired');
    } catch (e) {
      console.warn('[tauri] title bar failed:', e);
    }
  })();

  // ─── Graceful shutdown ───
  window.addEventListener('beforeunload', async () => {
    try {
      // 1. Снимаем хоткеи
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const unreg = (window as any).__nebulaUnregisterHotkeys;
      if (typeof unreg === 'function') {
        await unreg();
      }

      // 2. Закрываем WebSocket мониторинга
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = (window as any).state;
      if (st?.monitorWs) {
        try { st.monitorWs.close(); } catch { /* silent */ }
        st.monitorWs = null;
      }
      if (st?.monitorInterval) {
        clearInterval(st.monitorInterval);
        st.monitorInterval = null;
      }

      console.log('[tauri] graceful shutdown complete');
    } catch (e) {
      console.warn('[tauri] shutdown error:', e);
    }
  });
}

// ─── 3. Android: патч fetch через CapacitorHttp ───
if (platform === 'android') {
  import('@capacitor/core').then(({ CapacitorHttp, Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return;

    const origFetch = window.fetch.bind(window);
    window.fetch = async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input.url;

      if (
        url.startsWith('/') ||
        url.startsWith('blob:') ||
        url.startsWith('data:') ||
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1')
      ) {
        return origFetch(input, init);
      }

      if (url.startsWith('ws://') || url.startsWith('wss://')) {
        return origFetch(input, init);
      }

      try {
        const method = (init?.method || 'GET').toUpperCase();
        const headers: Record<string, string> = {};
        if (init?.headers) {
          if (init.headers instanceof Headers) {
            init.headers.forEach((v: string, k: string) => { headers[k] = v; });
          } else if (Array.isArray(init.headers)) {
            init.headers.forEach(([k, v]: [string, string]) => { headers[k] = v; });
          } else {
            Object.assign(headers, init.headers as Record<string, string>);
          }
        }

        const response = await CapacitorHttp.request({
          url,
          method,
          headers,
          data: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        return new Response(
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
          {
            status: response.status,
            statusText: String(response.status),
            headers: new Headers(response.headers as any),
          }
        );
      } catch (e) {
        console.warn('[android-http] fallback to orig fetch:', e);
        return origFetch(input, init);
      }
    };
    console.log('[platform] Android CapacitorHttp fetch patch installed');
  });
}

// ─── 4. Дальше — как было ───
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
import './themes';

// ─── Sources ───
import './sources/candles';
import './sources/orderbook';
import './sources/funding';
import './sources/dash';
import './sources/whale-futures';
import './sources/mexc';

// ─── UI ───
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
import './ui/themes';

// ─── Init ───
import { initApp } from './ui/init';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}