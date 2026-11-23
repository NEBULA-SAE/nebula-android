// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · MASTER SIGNAL HUD & MODULE LAMPS
// Главная лампочка-светофор + индикаторы на каждом модуле
// ═══════════════════════════════════════════════════════════════

import { isEN } from '../i18n';

export type LampLevel = 'green' | 'yellow' | 'red' | 'cyan' | 'off';

export type ModuleKey =
  | 'oracle'
  | 'tf'
  | 'plan'
  | 'agent'
  | 'whale'
  | 'xray'
  | 'walls'
  | 'dash';

interface ModuleSignal {
  level: LampLevel;
  note: string;
}

const LAMP_IDS: Record<ModuleKey, string> = {
  oracle: 'lamp-oracle',
  tf: 'lamp-tf',
  plan: 'lamp-plan',
  agent: 'lamp-agent',
  whale: 'lamp-whale',
  xray: 'lamp-xray',
  walls: 'lamp-walls',
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
  dash: 'dash-section',
};

const CORE_MODULES: ModuleKey[] = ['oracle', 'tf', 'plan', 'whale', 'xray', 'walls'];

let _ticker = '';
const _signals: Partial<Record<ModuleKey, ModuleSignal>> = {};

function T(ru: string, en: string): string {
  return isEN() ? en : ru;
}

function applyLampClass(key: ModuleKey, level: LampLevel): void {
  const el = document.getElementById(LAMP_IDS[key]);
  if (!el) return;
  el.className = `mod-lamp lamp-${level}`;
}

export function resetMasterSignal(ticker: string): void {
  _ticker = ticker.toUpperCase();
  (Object.keys(LAMP_IDS) as ModuleKey[]).forEach((k) => {
    delete _signals[k];
    applyLampClass(k, 'off');
  });
  const card = document.getElementById('master-signal-card');
  if (card) card.style.display = 'none';
}

export function setModuleSignal(key: ModuleKey, level: LampLevel, note = ''): void {
  _signals[key] = { level, note };
  applyLampClass(key, level);
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

  activeCore.forEach((k) => {
    const lv = _signals[k]!.level;
    if (lv === 'green' || lv === 'cyan') bull++;
    else if (lv === 'red') bear++;
    else neutral++;
  });

  const total = activeCore.length;
  let masterLevel: 'green' | 'yellow' | 'red' = 'yellow';
  let masterTitle = T('НЕЙТРАЛЬНЫЙ ФОН', 'NEUTRAL SETUP');
  let masterColor = 'var(--amber)';
  let masterBorder = 'rgba(251,191,36,0.3)';

  if (bull >= 3 && bull > bear + 1) {
    masterLevel = 'green';
    masterTitle = bull >= 4
      ? T('СИЛЬНЫЙ БЫЧИЙ КОНСЕНСУС', 'STRONG BULLISH CONSENSUS')
      : T('ПРЕИМУЩЕСТВО ПОКУПАТЕЛЕЙ', 'BULLISH BIAS');
    masterColor = 'var(--mint)';
    masterBorder = 'rgba(45,212,191,0.38)';
  } else if (bear >= 3 && bear > bull + 1) {
    masterLevel = 'red';
    masterTitle = bear >= 4
      ? T('ВЫСОКИЙ РИСК / ДАВЛЕНИЕ ПРОДАВЦОВ', 'HIGH RISK / BEARISH PRESSURE')
      : T('ОСТОРОЖНО · ПРЕОБЛАДАЮТ РИСКИ', 'CAUTION · BEARISH BIAS');
    masterColor = 'var(--coral)';
    masterBorder = 'rgba(251,113,133,0.38)';
  } else if (bull > bear && bull >= 2) {
    masterLevel = 'green';
    masterTitle = T('УМЕРЕННО БЫЧИЙ ФОН', 'MILD BULLISH BIAS');
    masterColor = 'var(--mint)';
    masterBorder = 'rgba(45,212,191,0.3)';
  } else if (bear > bull && bear >= 2) {
    masterLevel = 'red';
    masterTitle = T('УМЕРЕННО МЕДВЕЖИЙ ФОН', 'MILD BEARISH BIAS');
    masterColor = 'var(--coral)';
    masterBorder = 'rgba(251,113,133,0.3)';
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

  box.innerHTML = `
    <div class="ms-head">
      <div class="ms-left">
        <span class="master-lamp-orb lamp-${masterLevel}"></span>
        <div>
          <div class="ms-eyebrow">${_ticker ? `${_ticker} · ` : ''}${T('ОБЩИЙ ИНДИКАТОР СИСТЕМЫ', 'MASTER SIGNAL')}</div>
          <div class="ms-title" style="color:${masterColor};">${masterTitle}</div>
        </div>
      </div>
      <div class="ms-score-badge" style="color:${masterColor};border-color:${masterColor};">
        ${bull}/${total} ${T('ЗА РОСТ', 'BULL')}
      </div>
    </div>

    <div class="ms-summary">${summaryText}</div>

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