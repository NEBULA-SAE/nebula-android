import { state, toast } from '../utils';
import { tm, isEN } from '../i18n';

export async function openMiningCalculator(): Promise<void> {
  const en = isEN();
  
  const html = `
    <div style="text-align:center; padding: 8px 0;">
      <div style="font-size:42px; margin-bottom:10px;">⛏️</div>
      <div style="font-family:'Space Grotesk'; font-size:16px; font-weight:700; color:var(--mint); margin-bottom:12px;">
        ${tm('mining_calc_title')}
      </div>
      
      <div style="background:rgba(0,0,0,.3); border-radius:10px; padding:14px; text-align:left; border:1px solid var(--border); margin-bottom:14px;">
        <div class="form-row">
          <label class="form-lbl">${tm('mining_coin')}</label>
          <select id="mine-coin" class="form-input" style="color:var(--hi);">
            <option value="BTC">Bitcoin (BTC)</option>
            <option value="KAS">Kaspa (KAS)</option>
            <option value="ETC">Ethereum Classic (ETC)</option>
            <option value="RVN">Ravencoin (RVN)</option>
            <option value="ERG">Ergo (ERG)</option>
          </select>
        </div>
        
        <div class="form-grid-2">
          <div class="form-row">
            <label class="form-lbl">${tm('mining_hash')}</label>
            <input class="form-input" type="number" id="mine-hash" placeholder="100" value="100" step="1">
          </div>
          <div class="form-row">
            <label class="form-lbl">${tm('mining_power')}</label>
            <input class="form-input" type="number" id="mine-power" placeholder="1500" value="1500" step="10">
          </div>
        </div>

        <div class="form-row" style="margin-bottom:0;">
          <label class="form-lbl">${tm('mining_elec')}</label>
          <input class="form-input" type="number" id="mine-elec" placeholder="0.05" value="0.05" step="0.01">
        </div>
      </div>

      <button class="btn-primary btn-mint" onclick="calculateMining()" id="mine-btn">
        ${tm('mining_btn_calc')}
      </button>

      <div id="mine-result" style="display:none; margin-top:16px; padding:14px; background:rgba(94,203,255,.06); border:1px solid var(--border-hi); border-radius:12px; text-align:left;"></div>
    </div>
  `;

  (window as any).openSheet?.(tm('mining_title'), html);

  (window as any).calculateMining = async () => {
    const coin = (document.getElementById('mine-coin') as HTMLSelectElement).value;
    const hash = parseFloat((document.getElementById('mine-hash') as HTMLInputElement).value) || 0;
    const power = parseFloat((document.getElementById('mine-power') as HTMLInputElement).value) || 0;
    const elec = parseFloat((document.getElementById('mine-elec') as HTMLInputElement).value) || 0;

    if (hash <= 0) { toast(tm('mining_err_hash'), 'warn'); return; }

    const btn = document.getElementById('mine-btn') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = tm('mining_btn_loading');

    try {
      const res = await fetch(`https://api.minerstat.com/v2/coins?list=${coin}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      
      const c = data[0];
      if (!c) throw new Error('Coin not found');

      const hashrateH = hash * 1e9; 
      const secondsPerDay = 86400;
      const blocksPerDay = (hashrateH * secondsPerDay) / (c.difficulty * Math.pow(2, 32));
      
      const dailyCoins = blocksPerDay * c.reward;
      const dailyUsd = dailyCoins * c.price;
      
      const powerCost = (power / 1000) * 24 * elec;
      const dailyProfit = dailyUsd - powerCost;

      const profitEl = document.getElementById('mine-result');
      if (profitEl) {
        profitEl.style.display = 'block';
        profitEl.innerHTML = `
          <div style="font-family:'JetBrains Mono'; font-size:11px; color:var(--mut); margin-bottom:8px;">
            ${coin} / USD: $${c.price.toFixed(4)} | Diff: ${(c.difficulty / 1e12).toFixed(2)} T
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:var(--tx);">${tm('mining_res_daily_coins')}</span>
            <span style="color:var(--cyan); font-weight:700;">${dailyCoins.toFixed(4)} ${coin}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
            <span style="color:var(--tx);">${tm('mining_res_revenue')}</span>
            <span style="color:var(--mint); font-weight:700;">$${dailyUsd.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
            <span style="color:var(--tx);">${tm('mining_res_power')}</span>
            <span style="color:var(--coral); font-weight:700;">-$${powerCost.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding-top:8px; border-top:1px dashed var(--border);">
            <span style="color:var(--hi); font-weight:700;">${tm('mining_res_net')}</span>
            <span style="color:${dailyProfit >= 0 ? 'var(--mint)' : 'var(--coral)'}; font-weight:800; font-size:14px;">${dailyProfit >= 0 ? '+' : ''}$${dailyProfit.toFixed(2)}</span>
          </div>
        `;
      }
    } catch (e) {
      toast(tm('mining_err_api'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = tm('mining_btn_calc');
    }
  };
}