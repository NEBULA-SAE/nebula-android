// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MASTER SIGNAL HUD & MODULE LAMPS
// Главная лампочка-светофор + индикаторы на каждом модуле
// ═══════════════════════════════════════════════════════════════

import { isEN } from '../i18n';

export type LampLevel = 'green' | 'yellow' | 'red' | 'cyan' | 'off';
export type SignalReliability = 'high' | 'medium' | 'low';

export type ModuleKey =
  | 'oracle'
  | 'tf'
  | 'plan'
  | 'agent'
  | 'whale'
  | 'xray'
  | 'walls'
  | 'habits'
  | 'dash';

interface ModuleSignal {
  level: LampLevel;
  note: string;
  reliability: SignalReliability;
  weight: number;
}

const MODULE_WEIGHTS: Record<ModuleKey, number> = {
  oracle: 1.4,
  tf: 1.2,
  whale: 1.0,
  plan: 0.9,
  agent: 0.8,
  habits: 0.75,
  xray: 0.7,
  walls: 0.7,
  dash: 0.6,
};

const LAMP_IDS: Record<ModuleKey, string> = {
  oracle: 'lamp-oracle',
  tf: 'lamp-tf',
  plan: 'lamp-plan',
  agent: 'lamp-agent',
  whale: 'lamp-whale',
  xray: 'lamp-xray',
  walls: 'lamp-walls',
  habits: 'lamp-habits',
  dash: 'lamp-dash',
};

const CARD_IDS: Record<ModuleKey, string> = {
  oracle: 'verdict',
  tf: 'confluence-card',
  plan: 'plan-card',
  agent: 'agent-card',
  whale: 'whale-card',
  xray: 'xray-card',
  walls: 'walls-card',
  habits: 'oracle-habits-card',
  dash: 'dash-section',
};

const CORE_MODULES: ModuleKey[] = ['oracle', 'tf', 'plan', 'whale', 'xray', 'walls', 'habits'];

let _ticker = '';
const _signals: Partial<Record<ModuleKey, ModuleSignal>> = {};

function T(ru: string, en: string): string {
  return isEN() ? en : ru;
}

function defaultReliability(key: ModuleKey, level: LampLevel): SignalReliability {
  if (level === 'off') return 'low';
  if (key === 'oracle' || key === 'tf') return 'high';
  if (key === 'whale' || key === 'plan') return level === 'yellow' ? 'low' : 'medium';
  return level === 'yellow' ? 'low' : 'low';
}

function directionBadgeText(level: LampLevel, rel: SignalReliability): string {
  const relTag = rel === 'high' ? T('ВЫС', 'HIGH') : rel === 'medium' ? T('СР', 'MED') : T('НИЗ', 'LOW');
  if (level === 'green' || level === 'cyan') return `▲ ${T('РОСТ', 'UP')} · ${relTag}`;
  if (level === 'red') return `▼ ${T('РИСК', 'DOWN')} · ${relTag}`;
  if (level === 'yellow') return `◆ ${T('НЕЙТР', 'FLAT')} · ${relTag}`;
  return '—';
}

function applyLampClass(key: ModuleKey, level: LampLevel, rel: SignalReliability = 'low'): void {
  const el = document.getElementById(LAMP_IDS[key]);
  if (!el) return;
  const strongGlow = level !== 'off' && level !== 'yellow' && rel === 'high';
  el.className = `mod-lamp lamp-${level}${strongGlow ? ' lamp-strong' : ''}`;

  const tagId = `lamp-tag-${key}`;
  let tagEl = document.getElementById(tagId);
  if (!tagEl && el.parentElement) {
    tagEl = document.createElement('span');
    tagEl.id = tagId;
    tagEl.style.cssText =
      "font-family:'JetBrains Mono',monospace;font-size:8.5px;font-weight:700;padding:1px 6px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:var(--mut);letter-spacing:.4px;white-space:nowrap;";
    el.insertAdjacentElement('afterend', tagEl);
  }
  if (tagEl) {
    const color =
      level === 'green' || level === 'cyan'
        ? 'var(--mint)'
        : level === 'red'
          ? 'var(--coral)'
          : level === 'yellow'
            ? 'var(--amber)'
            : 'var(--dim)';
    tagEl.textContent = directionBadgeText(level, rel);
    tagEl.style.color = color;
    tagEl.style.borderColor = level === 'off' ? 'rgba(255,255,255,.08)' : color;
  }
}

export function resetMasterSignal(ticker: string): void {
  _ticker = ticker.toUpperCase();
  (Object.keys(LAMP_IDS) as ModuleKey[]).forEach((k) => {
    delete _signals[k];
    applyLampClass(k, 'off', 'low');
  });
  const card = document.getElementById('master-signal-card');
  if (card) {
    card.style.display = 'none';
    card.style.boxShadow = '';
  }
}

export function setModuleSignal(
  key: ModuleKey,
  level: LampLevel,
  note = '',
  reliability?: SignalReliability
): void {
  const rel = reliability ?? defaultReliability(key, level);
  _signals[key] = { level, note, reliability: rel, weight: MODULE_WEIGHTS[key] };
  applyLampClass(key, level, rel);
  renderMasterSignal();
}

function getModuleLabel(key: ModuleKey): string {
  switch (key) {
    case 'oracle': return T('Оракул', 'Oracle');
    case 'tf':     return T('Мульти-ТФ', 'Multi-TF');
    case 'plan':   return T('План', 'Plan');
    case 'agent':  return T('ИИ', 'AI');
    case 'whale':  return T('Киты', 'Whales');
    case 'xray':   return T('Рентген', 'X-Ray');
    case 'walls':  return T('Стенки', 'Walls');
    case 'habits': return T('Повадки', 'Habits');
    case 'dash':   return T('Сеть', 'Net');
  }
}

function renderMasterSignal(): void {
  const card = document.getElementById('master-signal-card');
  const box = document.getElementById('master-signal-content');
  if (!card || !box) return;

  const activeCore = CORE_MODULES.filter((k) => _signals[k] && _signals[k]!.level !== 'off');
  if (!activeCore.length) {
    card.style.display = 'none';
    return;
  }

  let bull = 0;
  let bear = 0;
  let neutral = 0;
  let bullWeight = 0;
  let bearWeight = 0;
  let totalWeight = 0;
  let highRelCount = 0;

  activeCore.forEach((k) => {
    const sig = _signals[k]!;
    const lv = sig.level;
    totalWeight += sig.weight;
    if (sig.reliability === 'high') highRelCount++;
    if (lv === 'green' || lv === 'cyan') {
      bull++;
      bullWeight += sig.weight;
    } else if (lv === 'red') {
      bear++;
      bearWeight += sig.weight;
    } else {
      neutral++;
    }
  });

  const total = activeCore.length;
  const bullShare = totalWeight > 0 ? bullWeight / totalWeight : 0;
  const bearShare = totalWeight > 0 ? bearWeight / totalWeight : 0;
  const netShare = Math.max(bullShare, bearShare);

  const reliabilityLabel =
    netShare >= 0.65 && highRelCount >= 1
      ? T('ВЫСОКАЯ', 'HIGH')
      : netShare >= 0.45 || total >= 3
        ? T('СРЕДНЯЯ', 'MEDIUM')
        : T('НИЗКАЯ', 'LOW');

  let masterLevel: 'green' | 'yellow' | 'red' = 'yellow';
  let masterTitle = T('НЕОДНОЗНАЧНЫЙ ФОН · ЖДЁМ ПОДТВЕРЖДЕНИЯ', 'MIXED SETUP · WAIT FOR CONFIRMATION');
  let masterColor = 'var(--amber)';
  let masterBorder = 'rgba(251,191,36,0.35)';
  let masterGlow = '0 0 18px rgba(251,191,36,0.16)';

  if (bullWeight > bearWeight && bullShare >= 0.55 && bull >= 2) {
    masterLevel = 'green';
    masterTitle = bullShare >= 0.72
      ? T('▲ СИГНАЛ НА РОСТ · ОПОРА СИЛЬНАЯ', '▲ BULLISH SIGNAL · STRONG CONFLUENCE')
      : T('▲ ПРЕИМУЩЕСТВО РОСТА', '▲ BULLISH BIAS');
    masterColor = 'var(--mint)';
    masterBorder = 'rgba(69,224,168,0.65)';
    masterGlow = '0 0 28px rgba(69,224,168,0.32)';
  } else if (bearWeight > bullWeight && bearShare >= 0.55 && bear >= 2) {
    masterLevel = 'red';
    masterTitle = bearShare >= 0.72
      ? T('▼ РИСК ПАДЕНИЯ / ДАВЛЕНИЕ ПРОДАВЦОВ', '▼ DOWNTREND / SELL PRESSURE RISK')
      : T('▼ ПРЕОБЛАДАЮТ РИСКИ СНИЖЕНИЯ', '▼ BEARISH RISK BIAS');
    masterColor = 'var(--coral)';
    masterBorder = 'rgba(255,101,132,0.65)';
    masterGlow = '0 0 28px rgba(255,101,132,0.32)';
  } else if (bullWeight > bearWeight && bull >= 2) {
    masterLevel = 'green';
    masterTitle = T('▲ УМЕРЕННЫЙ РОСТ · ПРОВЕРЯЙ РИСКИ', '▲ MILD UPWARD BIAS · CHECK RISK');
    masterColor = 'var(--mint)';
    masterBorder = 'rgba(69,224,168,0.4)';
    masterGlow = '0 0 16px rgba(69,224,168,0.16)';
  } else if (bearWeight > bullWeight && bear >= 2) {
    masterLevel = 'red';
    masterTitle = T('▼ УМЕРЕННОЕ ДАВЛЕНИЕ ВНИЗ', '▼ MILD DOWNWARD PRESSURE');
    masterColor = 'var(--coral)';
    masterBorder = 'rgba(255,101,132,0.4)';
    masterGlow = '0 0 16px rgba(255,101,132,0.16)';
  }

  // Собираем краткое живое резюме по модулям
  const bullNames = activeCore
    .filter((k) => _signals[k]!.level === 'green' || _signals[k]!.level === 'cyan')
    .map(getModuleLabel);
  const bearNames = activeCore
    .filter((k) => _signals[k]!.level === 'red')
    .map(getModuleLabel);

  let summaryText = '';
  if (masterLevel === 'green') {
    summaryText = bearNames.length
      ? T(
          `За рост: ${bullNames.join(', ')}. Внимание на: ${bearNames.join(', ')} — входи поэтапно.`,
          `Bullish: ${bullNames.join(', ')}. Watch: ${bearNames.join(', ')} — scale in gradually.`
        )
      : T(
          `Согласованный позитивный фон (${bullNames.join(', ')}). Хорошие условия для работы по плану.`,
          `Aligned bullish confluence (${bullNames.join(', ')}). Favorable conditions to follow the plan.`
        );
  } else if (masterLevel === 'red') {
    summaryText = bullNames.length
      ? T(
          `Давление от: ${bearNames.join(', ')}. Поддерживают только ${bullNames.join(', ')} — не спеши со входом.`,
          `Bearish pressure from: ${bearNames.join(', ')}. Only ${bullNames.join(', ')} supportive — wait.`
        )
      : T(
          `Преобладают предупреждающие сигналы (${bearNames.join(', ')}). Лучше переждать или сократить риск.`,
          `Warning signals dominate (${bearNames.join(', ')}). Better stay patient or reduce exposure.`
        );
  } else {
    summaryText = T(
      `Сигналы разделились (${bull} за рост · ${neutral} нейтр. · ${bear} против). Ждём более чёткого перевеса.`,
      `Mixed signals (${bull} bullish · ${neutral} neutral · ${bear} bearish). Waiting for clearer confirmation.`
    );
  }

  const habitNote = _signals.habits?.note
    ? `<div style="margin-top:6px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--cyan);">🧭 ${ _signals.habits.note }</div>`
    : '';

  const pillsHtml = CORE_MODULES.map((k) => {
    const sig = _signals[k];
    const lv: LampLevel = sig ? sig.level : 'off';
    const cardId = CARD_IDS[k];
    return `
      <button type="button" class="ms-mod-chip" onclick="window.__openModuleCard?.('${cardId}')">
        <span class="mod-lamp lamp-${lv}"></span>
        <span>${getModuleLabel(k)}</span>
      </button>
    `;
  }).join('');

  card.style.display = 'block';
  card.style.borderColor = masterBorder;
  card.style.boxShadow = masterGlow;

  box.innerHTML = `
    <div class="ms-head">
      <div class="ms-left">
        <span class="master-lamp-orb lamp-${masterLevel}" style="box-shadow:${masterGlow};"></span>
        <div>
          <div class="ms-eyebrow">${_ticker ? `${_ticker} · ` : ''}${T('ОБЩИЙ ИНДИКАТОР СИСТЕМЫ', 'MASTER SIGNAL')}</div>
          <div class="ms-title" style="color:${masterColor};">${masterTitle}</div>
        </div>
      </div>
      <div class="ms-score-badge" style="color:${masterColor};border-color:${masterColor};">
        ${bull}/${total} ${T('РОСТ', 'UP')} · ${T('ДОСТОВ.', 'REL')}: ${reliabilityLabel}
      </div>
    </div>

    <div class="ms-summary">${summaryText}${habitNote}</div>

    <div class="ms-mods-row">
      ${pillsHtml}
    </div>
  `;
}

// ─── СВОРАЧИВАНИЕ КАРТОЧЕК (ОТ МУЛЬТИ-ТФ ДО СТЕНОК) ───

const COLLAPSIBLE_IDS = [
  'confluence-card',
  'plan-card',
  'agent-card',
  'whale-card',
  'xray-card',
  'walls-card',
];

const MOBILE_DEFAULT_COLLAPSED = new Set([
  'confluence-card',
  'whale-card',
  'xray-card',
  'walls-card',
]);

function getCardCollapsed(id: string): boolean {
  try {
    const saved = localStorage.getItem(`nebula_col_${id}`);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch { /* silent */ }
  return typeof window !== 'undefined' && window.innerWidth <= 767 && MOBILE_DEFAULT_COLLAPSED.has(id);
}

function setCardCollapsed(id: string, collapsed: boolean): void {
  try {
    localStorage.setItem(`nebula_col_${id}`, collapsed ? '1' : '0');
  } catch { /* silent */ }
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.toggle('nebula-collapsed', collapsed);
}

function initCollapsibleCards(): void {
  COLLAPSIBLE_IDS.forEach((id) => {
    const card = document.getElementById(id);
    if (!card) return;
    const head = card.querySelector('.card-head') as HTMLElement | null;
    if (!head || head.dataset.colInit === '1') return;
    head.dataset.colInit = '1';
    head.style.cursor = 'pointer';
    head.style.userSelect = 'none';

    const chevron = document.createElement('span');
    chevron.className = 'card-col-arrow';
    chevron.textContent = '▾';
    head.appendChild(chevron);

    setCardCollapsed(id, getCardCollapsed(id));

    head.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, summary, details, input, select, textarea, a')) return;
      const next = !card.classList.contains('nebula-collapsed');
      setCardCollapsed(id, next);
    });
  });
}

if (typeof window !== 'undefined') {
  (window as any).__openModuleCard = (cardId: string) => {
    if (cardId === 'oracle-habits-card') {
      (window as any).switchTab?.('oracle');
      setTimeout(() => {
        document.getElementById(cardId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
      return;
    }
    if (COLLAPSIBLE_IDS.includes(cardId)) {
      setCardCollapsed(cardId, false);
    }
    document.getElementById(cardId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCollapsibleCards, { once: true });
  } else {
    initCollapsibleCards();
  }
}

// ─── РЕКЛАМНЫЙ СТЕНД В ФУТЕРЕ (АВТОЛИСТАНИЕ + СВАЙП + КЛИКИ) ───

const AD_TOTAL_SLIDES = 3;
const AD_INTERVAL_MS = 6000;
let _adIndex = 0;
let _adTimer: ReturnType<typeof setInterval> | null = null;
let _adPaused = false;

function renderAdPosition(index: number): void {
  _adIndex = ((index % AD_TOTAL_SLIDES) + AD_TOTAL_SLIDES) % AD_TOTAL_SLIDES;
  const track = document.getElementById('nebula-ad-track') as HTMLElement | null;
  if (track) {
    track.style.transform = `translateX(-${_adIndex * 100}%)`;
  }
  const dots = document.querySelectorAll('#nebula-ad-dots .nebula-ad-dot');
  dots.forEach((dot, idx) => {
    dot.classList.toggle('active', idx === _adIndex);
  });
}

function restartAdTimer(): void {
  if (_adTimer) clearInterval(_adTimer);
  _adTimer = setInterval(() => {
    if (!_adPaused && !document.hidden) {
      renderAdPosition(_adIndex + 1);
    }
  }, AD_INTERVAL_MS);
}

function initFooterAdStand(): void {
  const stand = document.getElementById('nebula-ad-stand');
  if (!stand || stand.dataset.adInit === '1') return;
  stand.dataset.adInit = '1';

  stand.addEventListener('mouseenter', () => { _adPaused = true; });
  stand.addEventListener('mouseleave', () => { _adPaused = false; });

  let startX = 0;
  let moved = false;

  stand.addEventListener('touchstart', (e) => {
    _adPaused = true;
    startX = e.touches[0]?.clientX ?? 0;
    moved = false;
  }, { passive: true });

  stand.addEventListener('touchmove', (e) => {
    const dx = (e.touches[0]?.clientX ?? 0) - startX;
    if (Math.abs(dx) > 12) moved = true;
  }, { passive: true });

  stand.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const dx = endX - startX;
    if (Math.abs(dx) > 40) {
      renderAdPosition(dx < 0 ? _adIndex + 1 : _adIndex - 1);
      restartAdTimer();
    }
    setTimeout(() => {
      _adPaused = false;
      moved = false;
    }, 120);
  });

  (window as any).__nebulaAdGoTo = (idx: number) => {
    renderAdPosition(idx);
    restartAdTimer();
  };

  (window as any).__nebulaAdSlideClick = (idx: number) => {
    if (moved) return;
    if (idx === 0) {
      (window as any).openProModal?.();
    } else if (idx === 1) {
      document.getElementById('whale-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (idx === 2) {
      const cta = stand.querySelector('.nebula-ad-cta-hit') as HTMLAnchorElement | null;
      if (cta?.href && !cta.href.includes('твой_ник')) {
        window.open(cta.href, '_blank', 'noopener,noreferrer');
      } else {
        (window as any).openWhitePaper?.();
      }
    }
  };

  renderAdPosition(0);
  restartAdTimer();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFooterAdStand, { once: true });
  } else {
    initFooterAdStand();
  }
}