// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CUSTOM TOOLTIP
// Порт из js/tooltip.js — работает на тап (mobile) и ховер (desktop)
// ═══════════════════════════════════════════════════════════════

(function nebulaTooltip(): void {
  'use strict';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any)._nebulaTipInit) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any)._nebulaTipInit = true;

  let tipEl: HTMLDivElement | null = null;
  let activeTarget: HTMLElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function ensureTip(): HTMLDivElement {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'nebula-tip';
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }

  function showTip(target: HTMLElement): void {
    const text = target.getAttribute('data-tip');
    if (!text) return;

    activeTarget = target;
    const el = ensureTip();
    el.textContent = text;
    el.classList.remove('below', 'show');

    const r = target.getBoundingClientRect();
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.display = 'block';

    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const vw = window.innerWidth;

    let left = r.left + r.width / 2 - tw / 2;
    let top = r.top - th - 8;

    if (left < 8) left = 8;
    if (left + tw > vw - 8) left = vw - tw - 8;

    let below = false;
    if (top < 60) {
      top = r.bottom + 8;
      below = true;
    }

    el.style.left = left + 'px';
    el.style.top = top + 'px';
    if (below) el.classList.add('below');

    requestAnimationFrame(() => el.classList.add('show'));

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTip, 6000);
  }

  function hideTip(): void {
    if (!tipEl) return;
    tipEl.classList.remove('show');
    activeTarget = null;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const t = target.closest('[data-tip]') as HTMLElement | null;
    if (t) {
      e.preventDefault();
      e.stopPropagation();
      if (activeTarget === t) {
        hideTip();
      } else {
        showTip(t);
      }
      return;
    }
    if (activeTarget) hideTip();
  }, true);

  document.addEventListener('mouseover', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const t = target.closest('[data-tip]') as HTMLElement | null;
    if (t && !('ontouchstart' in window)) {
      showTip(t);
    }
  });

  document.addEventListener('mouseout', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const t = target.closest('[data-tip]') as HTMLElement | null;
    if (t && !('ontouchstart' in window)) {
      setTimeout(() => {
        if (!activeTarget) hideTip();
      }, 100);
    }
  });

  window.addEventListener('scroll', hideTip, { passive: true, capture: true });
})();
export {};