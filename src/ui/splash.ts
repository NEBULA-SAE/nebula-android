// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SPLASH SCREEN
// Точный порт из js/splash.js
// ═══════════════════════════════════════════════════════════════

(function nebulaSplash(): void {
  'use strict';

  const LOGO_SRC = 'ic_launcher-playstore.png';

  const SPLASH_HTML = `
    <div class="splash" id="nebula-splash">
      <div class="splash-nebula"></div>
      <div class="splash-stars" id="nebula-splash-stars"></div>
      <div class="splash-content">
        <img src="${LOGO_SRC}" alt="NEBULA" class="splash-logo">
        <div class="splash-brand">NEBULA</div>
        <div class="splash-sub">ORACLE · TRADING TERMINAL</div>
        <div class="splash-loader"><div class="splash-loader-bar" id="nebula-splash-bar"></div></div>
        <div class="splash-status" id="nebula-splash-status">INITIALIZING...</div>
      </div>
    </div>
  `;

  const STAGES: { p: number; t: number; s: string }[] = [
    { p: 15,  t: 300,  s: 'LOADING CORE...' },
    { p: 40,  t: 900,  s: 'CONNECTING EXCHANGES...' },
    { p: 65,  t: 1600, s: 'FETCHING MARKET DATA...' },
    { p: 88,  t: 2400, s: 'CALIBRATING ORACLE...' },
    { p: 100, t: 3200, s: 'READY' },
  ];

  const TOTAL_MS    = 3400;
  const FADE_MS     = 900;
  const STARS_COUNT = 70;

  function mount(): void {
    if (document.getElementById('nebula-splash')) return;
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
      return;
    }
    document.body.insertAdjacentHTML('afterbegin', SPLASH_HTML);
    startAnimations();
  }

  function startAnimations(): void {
    const stars  = document.getElementById('nebula-splash-stars');
    const bar    = document.getElementById('nebula-splash-bar');
    const stat   = document.getElementById('nebula-splash-status');
    const splash = document.getElementById('nebula-splash');
    if (!splash) return;

    // Звёзды
    if (stars) {
      let html = '';
      for (let i = 0; i < STARS_COUNT; i++) {
        const x = (Math.random() * 100).toFixed(2);
        const y = (Math.random() * 100).toFixed(2);
        const size = (Math.random() * 1.8 + 0.4).toFixed(2);
        html += `<span style="left:${x}%;top:${y}%;width:${size}px;height:${size}px;"></span>`;
      }
      stars.innerHTML = html;
    }

    // Этапы загрузки
    STAGES.forEach(st => {
      setTimeout(() => {
        if (bar)  bar.style.width = st.p + '%';
        if (stat) stat.textContent = st.s;
      }, st.t);
    });

    // Авто-скрытие
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), FADE_MS);
    }, TOTAL_MS);
  }

  // ─── Публичный API ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).NebulaSplash = {
    hide(delay = 0): void {
      setTimeout(() => {
        const s = document.getElementById('nebula-splash');
        if (!s) return;
        s.classList.add('hide');
        setTimeout(() => s.remove(), FADE_MS);
      }, delay);
    },
    setStatus(text: string): void {
      const el = document.getElementById('nebula-splash-status');
      if (el) el.textContent = text;
    },
    setProgress(pct: number): void {
      const el = document.getElementById('nebula-splash-bar');
      if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();