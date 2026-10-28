// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SPLASH v2.1 — звёзды + параллакс + защита от лагов
// ═══════════════════════════════════════════════════════════════

(function nebulaSplash() {
  'use strict';

  // ─── CSS-АНИМАЦИЯ ДЛЯ ПУЛЬСА ───
  if (!document.getElementById('nebula-pulse-style')) {
    const style = document.createElement('style');
    style.id = 'nebula-pulse-style';
    style.textContent = `
      .nebula-pulse-line {
        stroke-dasharray: 40 300;
        stroke-dashoffset: 340;
        animation: nebula-hospital-pulse 2s linear infinite;
        filter: drop-shadow(0 0 6px rgba(94, 203, 255, 0.9));
      }
      @keyframes nebula-hospital-pulse {
        0% { stroke-dashoffset: 340; }
        100% { stroke-dashoffset: -300; }
      }
    `;
    document.head.appendChild(style);
  }

  const TOTAL_MS = 8000;
  const FADE_MS  = 800;
  const STAR_COUNT_BASE = 60;

  const STAGES: { p: number; t: number; s: string }[] = [
    { p: 15,  t: 500,  s: 'LOADING CORE...' },
    { p: 40,  t: 2000, s: 'CONNECTING EXCHANGES...' },
    { p: 65,  t: 3500, s: 'FETCHING MARKET DATA...' },
    { p: 88,  t: 5500, s: 'CALIBRATING ORACLE...' },
    { p: 100, t: 7000, s: 'READY' },
  ];

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let W = 0, H = 0;
  let stars: { x: number; y: number; z: number; r: number; a: number; phase: number; speed: number }[] = [];
  let rafId = 0;
  let startTime = 0;
  let isMobile = false;
  let parallaxX = 0;
  let parallaxY = 0;
  let targetParallaxX = 0;
  let targetParallaxY = 0;
  let lastFrameTime = 0;
  let frameDebt = 0;
  let canvasDisabled = false;

  function initStars(): void {
    if (!canvas) return;

    // ─── Проверка на слабое устройство ───
    const cores = (navigator as any).hardwareConcurrency || 4;
    isMobile = window.innerWidth < 800 || /Android|iPhone|iPad/i.test(navigator.userAgent);

    if (cores <= 2 && !isMobile) {
      console.log('[splash] low-end device — canvas disabled');
      canvasDisabled = true;
      canvas.style.display = 'none';
      return;
    }

    const maxDpr = isMobile ? 1.5 : 2;
    const dpr = Math.min(maxDpr, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';

    const c = canvas.getContext('2d');
    if (!c) return;
    c.scale(dpr, dpr);
    ctx = c;

    // Меньше звёзд на мобилке
  let count: number;
if (isMobile) {
  count = 40;
} else {
  count = Math.max(30, Math.round(STAR_COUNT_BASE * (W * H) / (1920 * 1080)));
}

    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: Math.random() * 0.7 + 0.3, // глубина (для параллакса)
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.5 + 0.3,
        phase: Math.random() * Math.PI * 2,
        speed: 0.6 + Math.random() * 1.2,
      });
    }

    console.log(`[splash] stars: ${count} (${W}×${H}, dpr=${dpr}, mobile=${isMobile})`);
  }

  function tick(now: number): void {
    if (!ctx) return;

    if (!startTime) {
      startTime = now;
      lastFrameTime = now;
    }

    const t = (now - startTime) / 1000;

    // ─── Пропуск кадров при лагах ───
    const dt = now - lastFrameTime;
    lastFrameTime = now;

    if (dt > 33) frameDebt += 1;
    else if (dt < 20) frameDebt = Math.max(0, frameDebt - 1);

    // Если система лагает >10 кадров подряд — сокращаем звёзды вдвое
    if (frameDebt > 10 && stars.length > 20) {
      const newLen = Math.floor(stars.length / 2);
      stars = stars.slice(0, newLen);
      frameDebt = 0;
      console.log(`[splash] FPS drop — reduced to ${newLen} stars`);
    }

    // ─── Сглаживание параллакса ───
    parallaxX += (targetParallaxX - parallaxX) * 0.08;
    parallaxY += (targetParallaxY - parallaxY) * 0.08;

    ctx.clearRect(0, 0, W, H);

    for (const s of stars) {
      const twinkle = 0.6 + Math.sin(t * s.speed + s.phase) * 0.4;
      const px = s.x + parallaxX * s.z * 20;
      const py = s.y + parallaxY * s.z * 20;

      ctx.fillStyle = `rgba(255, 255, 255, ${s.a * twinkle})`;
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (t * 1000 < TOTAL_MS + FADE_MS + 500) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (isMobile) return;
    // Диапазон -1..1
    targetParallaxX = (e.clientX / W - 0.5) * 2;
    targetParallaxY = (e.clientY / H - 0.5) * 2;
  }

  function init(): void {
    const splash = document.getElementById('nebula-splash');
    if (!splash) {
      console.warn('[splash] element not found');
      return;
    }

    canvas = document.getElementById('splash-stars-canvas') as HTMLCanvasElement | null;
    if (canvas) {
      initStars();
      if (!canvasDisabled) {
        rafId = requestAnimationFrame(tick);
        if (!isMobile) {
          window.addEventListener('mousemove', onMouseMove, { passive: true });
        }
      }
    }

      // Статус (текст). Ширину больше не меняем — теперь там SVG-пульс.
    const stat = document.getElementById('splash-status');

    STAGES.forEach(st => {
      setTimeout(() => {
        if (stat) stat.textContent = st.s;
      }, st.t);
    });

    // Автоскрытие
    setTimeout(() => {
      splash.classList.add('hide');
      setTimeout(() => {
        // ─── Чистим ───
        if (rafId) cancelAnimationFrame(rafId);
        if (!isMobile) window.removeEventListener('mousemove', onMouseMove);
        splash.remove();
        console.log('[splash] hidden & cleaned');
      }, FADE_MS);
    }, TOTAL_MS);
  }

  // Публичный API
  (window as any).NebulaSplash = {
    hide(delay = 0): void {
      setTimeout(() => {
        const s = document.getElementById('nebula-splash');
        if (!s) return;
        s.classList.add('hide');
        setTimeout(() => {
          if (rafId) cancelAnimationFrame(rafId);
          s.remove();
        }, FADE_MS);
      }, delay);
    },
    setStatus(text: string): void {
      const el = document.getElementById('splash-status');
      if (el) el.textContent = text;
    },
      setProgress(_pct: number): void {
      // Прогресс-бар заменен на анимированный SVG-пульс
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
export {};