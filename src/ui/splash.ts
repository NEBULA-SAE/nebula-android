// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · SPLASH SCREEN
// Улучшенный Canvas: параллакс (мышь + гироскоп), кометы, глубина
// ═══════════════════════════════════════════════════════════════

interface Star {
  x: number;
  y: number;
  z: number; // Глубина для параллакса
  size: number;
  baseOpacity: number;
  twinkleSpeed: number;
  twinklePhase: number;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
  life: number;
  maxLife: number;
}

(function nebulaSplash(): void {
  'use strict';

  const SPLASH_ID = 'nebula-splash';
  const CANVAS_ID = 'splash-stars-canvas';
  const STATUS_ID = 'splash-status';
  const HIDE_DELAY = 8000; // Сколько висит заставка (мс)

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let height = 0;
  let dpr = 1;

  let stars: Star[] = [];
  let shootingStars: ShootingStar[] = [];

  let mouseX = 0;
  let mouseY = 0;
  let tiltX = 0;
  let tiltY = 0;

  let currentOffsetX = 0;
  let currentOffsetY = 0;
  let targetOffsetX = 0;
  let targetOffsetY = 0;

  let animationFrameId = 0;
  let isRunning = false;
  let lastShootingStarTime = 0;

  function random(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  function initCanvas(): void {
    canvas = document.getElementById(CANVAS_ID) as HTMLCanvasElement;
    if (!canvas) return;

    ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    resize();
    window.addEventListener('resize', resize);

    // Мышь (ПК)
    window.addEventListener('mousemove', (e) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      updateTargetOffset();
    });

    // Гироскоп (Смартфоны)
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    // Тач (fallback для iOS)
    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        mouseX = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
        mouseY = (e.touches[0].clientY / window.innerHeight) * 2 - 1;
        updateTargetOffset();
      }
    }, { passive: true });

    createStars();
    startAnimation();
  }

  function handleOrientation(e: DeviceOrientationEvent): void {
    if (e.beta == null || e.gamma == null) return;

    // Нормализуем. Держим телефон обычно под углом ~45 градусов
    const b = Math.max(-90, Math.min(90, e.beta - 45));
    const g = Math.max(-90, Math.min(90, e.gamma));

    tiltX = g / 45; // -1 до 1
    tiltY = b / 45; // -1 до 1

    updateTargetOffset();
  }

  function updateTargetOffset(): void {
    const finalX = mouseX !== 0 ? mouseX : tiltX;
    const finalY = mouseY !== 0 ? mouseY : tiltY;
    const MAX_OFFSET = 40;
    targetOffsetX = finalX * MAX_OFFSET;
    targetOffsetY = finalY * MAX_OFFSET;
  }

  function resize(): void {
    if (!canvas) return;
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (ctx) ctx.scale(dpr, dpr);
    createStars();
  }

  function createStars(): void {
    stars = [];
    const count = Math.floor((width * height) / 12000);
    const maxStars = Math.min(count, 200);

    for (let i = 0; i < maxStars; i++) {
      stars.push({
        x: random(0, width),
        y: random(0, height),
        z: random(0.1, 1.0),
        size: random(0.5, 2),
        baseOpacity: random(0.3, 0.9),
        twinkleSpeed: random(0.01, 0.05),
        twinklePhase: random(0, Math.PI * 2),
      });
    }
  }

  function spawnShootingStar(): void {
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? random(0, width * 0.5) : random(width * 0.5, width);
    const startY = random(-100, height * 0.3);
    const angle = fromLeft ? random(Math.PI * 0.1, Math.PI * 0.3) : random(Math.PI * 0.7, Math.PI * 0.9);

    shootingStars.push({
      x: startX, y: startY,
      length: random(80, 200),
      speed: random(8, 15),
      angle: angle,
      opacity: 1,
      life: 0,
      maxLife: random(60, 120),
    });
  }

  function startAnimation(): void {
    if (isRunning) return;
    isRunning = true;
    lastShootingStarTime = Date.now();
    animate();
  }

  function animate(): void {
    if (!isRunning || !ctx) return;

    // Сглаживание
    currentOffsetX += (targetOffsetX - currentOffsetX) * 0.05;
    currentOffsetY += (targetOffsetY - currentOffsetY) * 0.05;

    ctx.clearRect(0, 0, width, height);

    // Звезды
    for (const star of stars) {
      const offsetX = currentOffsetX * star.z * 2;
      const offsetY = currentOffsetY * star.z * 2;

      star.twinklePhase += star.twinkleSpeed;
      const twinkle = Math.sin(star.twinklePhase) * 0.3 + 0.7;
      const opacity = star.baseOpacity * twinkle;

      ctx.beginPath();
      ctx.arc(star.x + offsetX, star.y + offsetY, star.size, 0, Math.PI * 2);
      
      if (star.size > 1.5) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(94, 203, 255, 0.8)';
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.fill();
    }

    // Кометы
    const now = Date.now();
    if (now - lastShootingStarTime > 2000 + Math.random() * 3000) {
      spawnShootingStar();
      lastShootingStarTime = now;
    }

    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.x += Math.cos(s.angle) * s.speed;
      s.y += Math.sin(s.angle) * s.speed;
      s.life++;

      const tailX = s.x - Math.cos(s.angle) * s.length;
      const tailY = s.y - Math.sin(s.angle) * s.length;

      const gradient = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${s.opacity})`);
      gradient.addColorStop(1, 'rgba(94, 203, 255, 0)');

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.stroke();

      s.opacity = Math.max(0, 1 - (s.life / s.maxLife));

      if (s.life >= s.maxLife || s.x < -200 || s.x > width + 200 || s.y > height + 200) {
        shootingStars.splice(i, 1);
      }
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function stopAnimation(): void {
    isRunning = false;
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', resize);
  }

  function hideSplash(): void {
    const splash = document.getElementById(SPLASH_ID);
    if (!splash) return;

    splash.classList.add('hide'); // Используем класс .hide как в CSS
    stopAnimation();

    setTimeout(() => splash.remove(), 800);
  }

  function updateStatus(text: string): void {
    const el = document.getElementById(STATUS_ID);
    if (el) el.textContent = text;
  }

  function initSplash(): void {
    const splash = document.getElementById(SPLASH_ID);
    if (!splash) return;

    initCanvas();

    // Растягиваем тайминги под 8 секунд
    updateStatus('INITIALIZING...');
    setTimeout(() => updateStatus('LOADING MARKET DATA...'), 2000);
    setTimeout(() => updateStatus('CALIBRATING ORACLE...'), 4000);
    setTimeout(() => updateStatus('SYNCING EXCHANGES...'), 6000);
    setTimeout(() => updateStatus('READY'), 7500);

    setTimeout(hideSplash, HIDE_DELAY);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplash, { once: true });
  } else {
    initSplash();
  }

  if (typeof window !== 'undefined') {
    (window as any).NebulaSplash = { hide: hideSplash, updateStatus };
  }
})();

export {};