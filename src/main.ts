// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MAIN
// Точка входа. Загрузка модулей -> Сплэш -> Пароль -> UI.
// ═══════════════════════════════════════════════════════════════

// ─── 1. ПЛАТФОРМА (должно быть САМЫМ ПЕРВЫМ) ───
import { installFetchPatch } from './platform/http';
import { platform, isTauri } from './platform';
import { initAuth } from './auth';

installFetchPatch();

// ─── 2. Tauri: mini-режим, титульник, хоткеи, shutdown ───
if (isTauri) {
  document.documentElement.classList.add('tauri');

  const params = new URLSearchParams(location.search);
  const isMini = params.has('mini');

  if (isMini) {
    document.body.classList.add('mini-mode');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/styles/mini.css';
    document.head.appendChild(link);
  }

  if (!isMini) {
    (async () => {
      try {
        const { Window } = await import('@tauri-apps/api/window');
        const mainWin = await Window.getByLabel('main');
        if (mainWin) {
          setTimeout(async () => {
            try {
              await mainWin.show();
              await mainWin.setFocus();
            } catch (e) { /* silent */ }
          }, 100);
        }
      } catch (e) { /* silent */ }
    })();
  }

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
    } catch (e) { /* silent */ }
  })();

  window.addEventListener('beforeunload', async () => {
    try {
      const unreg = (window as any).__nebulaUnregisterHotkeys;
      if (typeof unreg === 'function') await unreg();

      const st = (window as any).state;
      if (st?.monitorWs) {
        try { st.monitorWs.close(); } catch { /* silent */ }
        st.monitorWs = null;
      }
      if (st?.monitorInterval) {
        clearInterval(st.monitorInterval);
        st.monitorInterval = null;
      }
    } catch (e) { /* silent */ }
  });
}

// ─── 3. Android: патч fetch через CapacitorHttp ───
// ⚠️ КЛЮЧЕВОЙ ФИКС: CapacitorHttp.request() НЕ поддерживает AbortSignal.
// Значит любой `AbortSignal.timeout(6000)` без дополнительной обработки
// просто игнорируется, и запрос висит до дефолтного таймаута (30–60 с).
// Ниже — обёртка через Promise.race, которая:
//   1) уважает переданный signal (мгновенный reject при abort/timeout),
//   2) НЕ делает fallback на origFetch при AbortError (иначе двойное ожидание),
//   3) аккуратно обрабатывает body (JSON / plain-text),
//   4) не матчит произвольный `ws...` — только реальные ws:// / wss://.
if (platform === 'android') {
  import('@capacitor/core').then(({ CapacitorHttp, Capacitor }) => {
    if (!Capacitor.isNativePlatform()) return;

    const origFetch = window.fetch.bind(window);

    window.fetch = async (input: any, init?: any): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.url;

      // Локальные и WS — WebView сам справится
      if (
        url.startsWith('/') ||
        url.startsWith('blob:') ||
        url.startsWith('data:') ||
        url.startsWith('http://localhost') ||
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('ws://') ||
        url.startsWith('wss://')
      ) {
        return origFetch(input, init);
      }

      const signal = init?.signal as AbortSignal | undefined;

      // Быстрый выход, если сигнал уже отменён
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

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

      let data: any = undefined;
      if (init?.body != null) {
        if (typeof init.body === 'string') {
          try { data = JSON.parse(init.body); }
          catch { data = init.body; } // plain text — CapacitorHttp отправит как есть
        } else {
          // FormData / Blob / URLSearchParams — нативно не поддерживаются,
          // пробрасываем через WebView-fetch
          return origFetch(input, init);
        }
      }

      const runNative = async (): Promise<Response> => {
        const response = await CapacitorHttp.request({
          url,
          method,
          headers,
          data,
          // Страховка от «висяков» без signal (например, опрос в фоне).
          // Реальный таймаут задаётся через signal сверху.
          connectTimeout: 15000,
          readTimeout: 30000,
        });

        return new Response(
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
          {
            status: response.status,
            statusText: String(response.status),
            headers: new Headers(response.headers as any),
          }
        );
      };

      // Сигнала нет — просто идём нативно (с fallback)
      if (!signal) {
        try {
          return await runNative();
        } catch {
          return origFetch(input, init);
        }
      }

      // Сигнал есть — гоним через race
      const abortPromise = new Promise<never>((_, reject) => {
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        signal.addEventListener('abort', onAbort, { once: true });
      });

      try {
        return await Promise.race([runNative(), abortPromise]);
      } catch (e: any) {
        // AbortError — не делаем fallback, иначе ждём ещё столько же
        if (e?.name === 'AbortError') throw e;
        // Прочие ошибки — пробуем WebView
        return origFetch(input, init);
      }
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// 4. ГЛАВНАЯ ЗАГРУЗКА
// ═══════════════════════════════════════════════════════════════

async function bootstrap() {
  // 1. Загружаем базовые модули и UI
  await import('./utils');
  await import('./i18n');
  await import('./crypto');
  await import('./worker');
  await import('./chart');
  await import('./indicators');
  await import('./patterns');
  await import('./ai');
  await import('./oracle');
  await import('./market');
  await import('./themes');

  // ─── Sources ───
  await import('./sources/candles');
  await import('./sources/orderbook');
  await import('./sources/funding');
  await import('./sources/dash');
  await import('./sources/whale-futures');
  await import('./sources/mexc');

  // ─── UI (запускает анимацию сплэша) ───
  await import('./ui/splash');
  await import('./ui/terms');
  await import('./ui/tooltip');
  await import('./ui/screens');
  await import('./ui/scanner');
  await import('./ui/whale');
  await import('./ui/oracle');
  await import('./ui/market');
  await import('./ui/learning');
  await import('./ui/dash');
  await import('./ui/diagnostics');
  await import('./ui/themes');
  await import('./ui/settings');

  // 2. Ждем немного, чтобы инициализировать модули
  await new Promise(r => setTimeout(r, 500));

  // 3. Сплэш скрывается САМ через splash.ts (через 10 секунд).
  // Окно пароля загрузится ПОД ним и появится, когда сплэш растворится.

  // 4. Ждем ввода пароля
  await initAuth();

  // 5. Загружаем торговый модуль (он возьмет пароль)
  await import('./trading');

  // 6. Запускаем интерфейс
  const { initApp } = await import('./ui/init');
  initApp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}