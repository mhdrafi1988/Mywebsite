/**
 * Revit26 RoofTools Suite — Time Comparison & ROI Calculators
 * Implements models for AutoSlope by Point (V026), RoofRidgeLines (V67),
 * AutoSlope By Drain (V005), and the Executive ROI Modeler.
 */

window.RoofCalculators = (function () {
  'use strict';

  function fmtNumber(num, decimals = 1) {
    return Number(num).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtCurrency(val) {
    return '$' + Math.round(val).toLocaleString();
  }

  // =========================================================================
  // 1. AUTOSLOPE BY POINT (V026) MODEL
  // =========================================================================
  const AUTOSLOPE_V026_CONFIG = {
    MANUAL_RATE_SEC_PER_PT: 20,
    PLUGIN_MIN_BY_TIER: { 200: 3, 400: 4, 500: 5 },
    ROOF_COUNT: 100,
    MANUAL_REWORK_PASSES: 5, // worst case, full re-do
    PLUGIN_REWORK_PASSES: 1   // base case, as-built stage
  };

  function computeAutoSlopeV026(tier) {
    const pts = parseInt(tier, 10) || 400;
    const manualBaseSecPerRoof = pts * AUTOSLOPE_V026_CONFIG.MANUAL_RATE_SEC_PER_PT;
    const manualBaseHrs = (manualBaseSecPerRoof * AUTOSLOPE_V026_CONFIG.ROOF_COUNT) / 3600;
    const manualTotalHrs = manualBaseHrs * AUTOSLOPE_V026_CONFIG.MANUAL_REWORK_PASSES;

    const pluginMinPerRoof = AUTOSLOPE_V026_CONFIG.PLUGIN_MIN_BY_TIER[pts] || 4;
    const pluginBaseHrs = (pluginMinPerRoof * AUTOSLOPE_V026_CONFIG.ROOF_COUNT) / 60;
    const pluginTotalHrs = pluginBaseHrs * (1 + AUTOSLOPE_V026_CONFIG.PLUGIN_REWORK_PASSES);

    const savedHrs = manualTotalHrs - pluginTotalHrs;
    const pct = Math.round((savedHrs / manualTotalHrs) * 100);

    return {
      pts,
      manualBaseHrs,
      manualTotalHrs,
      pluginBaseHrs,
      pluginMinPerRoof,
      pluginTotalHrs,
      savedHrs,
      pct
    };
  }

  function setSvgRing(el, labelEl, hrs, maxHrs) {
    if (!el) return;
    const r = 92;
    const circumference = 2 * Math.PI * r;
    const frac = Math.min(hrs / maxHrs, 1);
    const dash = circumference * frac;
    el.setAttribute('stroke-dasharray', `${dash} ${circumference}`);
    if (labelEl) labelEl.textContent = fmtNumber(hrs, 1) + 'h';
  }

  function renderAutoSlopeV026(tier) {
    const d = computeAutoSlopeV026(tier);
    const maxHrs = Math.max(d.manualTotalHrs, d.pluginTotalHrs);

    // Hero & Comparison Strip
    const heroPct = document.getElementById('heroPct');
    if (heroPct) heroPct.textContent = d.pct + '%';

    const stripManual = document.getElementById('stripManual');
    if (stripManual) stripManual.textContent = fmtNumber(d.manualTotalHrs) + ' hrs';

    const stripPlugin = document.getElementById('stripPlugin');
    if (stripPlugin) stripPlugin.textContent = fmtNumber(d.pluginTotalHrs) + ' hrs';

    const stripReduction = document.getElementById('stripReduction');
    if (stripReduction) stripReduction.textContent = '↓ ' + d.pct + '% time saved';

    // Summary Cards
    const sMan = document.getElementById('sMan');
    if (sMan) sMan.textContent = fmtNumber(d.manualTotalHrs) + ' hrs';

    const sPlug = document.getElementById('sPlug');
    if (sPlug) sPlug.textContent = fmtNumber(d.pluginTotalHrs) + ' hrs';

    const sSaved = document.getElementById('sSaved');
    if (sSaved) sSaved.textContent = fmtNumber(d.savedHrs) + ' hrs';

    const sPct = document.getElementById('sPct');
    if (sPct) sPct.textContent = d.pct + '%';

    // SVG Rings
    setSvgRing(document.getElementById('ringManual'), document.getElementById('ringManualLabel'), d.manualTotalHrs, maxHrs);
    setSvgRing(document.getElementById('ringPlugin'), document.getElementById('ringPluginLabel'), d.pluginTotalHrs, maxHrs);

    const ringManualBig = document.getElementById('ringManualBig');
    if (ringManualBig) ringManualBig.innerHTML = fmtNumber(d.manualTotalHrs) + ' <span>hrs</span>';

    const ringPluginBig = document.getElementById('ringPluginBig');
    if (ringPluginBig) ringPluginBig.innerHTML = fmtNumber(d.pluginTotalHrs) + ' <span>hrs</span>';

    // Breakdown Table
    const tPlugRate = document.getElementById('tPlugRate');
    if (tPlugRate) tPlugRate.textContent = d.pluginMinPerRoof + ' min / roof';

    const tManBase = document.getElementById('tManBase');
    if (tManBase) tManBase.textContent = fmtNumber(d.manualBaseHrs) + ' hrs';

    const tPlugBase = document.getElementById('tPlugBase');
    if (tPlugBase) tPlugBase.textContent = fmtNumber(d.pluginBaseHrs) + ' hrs';

    const tManRework = document.getElementById('tManRework');
    if (tManRework) tManRework.textContent = `x${AUTOSLOPE_V026_CONFIG.MANUAL_REWORK_PASSES} passes → ${fmtNumber(d.manualTotalHrs)} hrs total`;

    const tPlugRework = document.getElementById('tPlugRework');
    if (tPlugRework) tPlugRework.textContent = `x${1 + AUTOSLOPE_V026_CONFIG.PLUGIN_REWORK_PASSES} passes → ${fmtNumber(d.pluginTotalHrs)} hrs total`;

    const tManTotal = document.getElementById('tManTotal');
    if (tManTotal) tManTotal.textContent = fmtNumber(d.manualTotalHrs) + ' hrs';

    const tPlugTotal = document.getElementById('tPlugTotal');
    if (tPlugTotal) tPlugTotal.textContent = fmtNumber(d.pluginTotalHrs) + ' hrs';
  }

  // =========================================================================
  // 2. ROOFRIDGELINES (V67) VORONOI MODEL
  // =========================================================================
  const ROOFRIDGELINES_DATA = {
    small:  { manual: 2.0, manualLabel: '2.0m', pluginSec: 10, reduction: 91.7 },
    medium: { manual: 3.5, manualLabel: '3.5m', pluginSec: 10, reduction: 95.2 },
    large:  { manual: 5.0, manualLabel: '5.0m', pluginSec: 10, reduction: 96.7 }
  };

  function renderRoofRidgeLines(tier) {
    const d = ROOFRIDGELINES_DATA[tier] || ROOFRIDGELINES_DATA.large;
    const manualMin = d.manual;
    const pluginMin = d.pluginSec / 60;
    const maxMin = ROOFRIDGELINES_DATA.large.manual;

    const manualPct = Math.max(4, (manualMin / maxMin) * 100);
    const pluginPct = Math.max(2, (pluginMin / maxMin) * 100);

    const barManualFill = document.getElementById('barManualFill');
    if (barManualFill) barManualFill.style.width = manualPct + '%';

    const barPluginFill = document.getElementById('barPluginFill');
    if (barPluginFill) barPluginFill.style.width = pluginPct + '%';

    const barManualValue = document.getElementById('barManualValue');
    if (barManualValue) barManualValue.textContent = manualMin.toFixed(1) + ' min';

    const barPluginValue = document.getElementById('barPluginValue');
    if (barPluginValue) barPluginValue.textContent = d.pluginSec + ' sec';

    const multiple = Math.round(manualMin / pluginMin);
    const barMultiple = document.getElementById('barMultiple');
    if (barMultiple) barMultiple.innerHTML = `Manual takes <b>${multiple}×</b> longer per roof`;

    const statCards = document.getElementById('statCards');
    if (statCards) {
      const totalManualHr = (d.manual * 100 / 60).toFixed(1);
      const totalPluginMin = (pluginMin * 100).toFixed(1);
      statCards.innerHTML = `
        <div class="stat-metric-card"><div class="lbl">Manual / roof</div><div class="num" style="color:var(--danger)">${d.manual.toFixed(1)} min</div><div class="lbl">hand-drawn ridge/valley lines</div></div>
        <div class="stat-metric-card"><div class="lbl">Plugin / roof</div><div class="num" style="color:var(--emerald)">${d.pluginSec} sec</div><div class="lbl">pipeline run + review</div></div>
        <div class="stat-metric-card"><div class="lbl">Time reduction</div><div class="num" style="color:var(--emerald)">−${d.reduction}%</div><div class="lbl">per roof, this tier</div></div>
        <div class="stat-metric-card highlight"><div class="lbl">100-roof project</div><div class="num">${totalManualHr} hr → ${totalPluginMin} m</div><div class="lbl">total manual vs. plugin</div></div>
      `;
    }
  }

  // =========================================================================
  // 3. AUTOSLOPE BY DRAIN (V005) PROJECT SCALE MODEL
  // =========================================================================
  const AUTOSLOPE_DRAIN_DATA = {
    villa: { roofs: 10, pointsPerRoof: 100, manualSecPerPoint: 30, pluginMinPerRoof: 1.5, manualReworkPct: 0.125, pluginReworkPct: 0.0 },
    tower: { roofs: 100, pointsPerRoof: 100, manualSecPerPoint: 30, pluginMinPerRoof: 1.5, manualReworkPct: 0.125, pluginReworkPct: 0.0 }
  };

  function computeDrainScale(scaleKey) {
    const d = AUTOSLOPE_DRAIN_DATA[scaleKey] || AUTOSLOPE_DRAIN_DATA.villa;
    const manualMinPerRoof = (d.pointsPerRoof * d.manualSecPerPoint) / 60;
    const manualBase = manualMinPerRoof * d.roofs;
    const manualRework = manualBase * d.manualReworkPct;
    const manualTotal = manualBase + manualRework;

    const pluginBase = d.pluginMinPerRoof * d.roofs;
    const pluginRework = pluginBase * d.pluginReworkPct;
    const pluginTotal = pluginBase + pluginRework;

    const saved = manualTotal - pluginTotal;
    const pct = (saved / manualTotal) * 100;

    return {
      roofs: d.roofs,
      manualBase,
      manualRework,
      manualTotal,
      pluginBase,
      pluginRework,
      pluginTotal,
      saved,
      pct
    };
  }

  function fmtMin(m) { return fmtNumber(m, 1) + ' min'; }
  function fmtHr(m) { return fmtNumber(m / 60, 1) + ' hr'; }

  function renderDrainScale(scaleKey) {
    const r = computeDrainScale(scaleKey);
    const label = scaleKey === 'villa' ? 'Villa Project (10 roofs)' : 'Tower Project (100 roofs)';

    const summaryGrid = document.getElementById('summaryGrid');
    if (summaryGrid) {
      summaryGrid.innerHTML = `
        <div class="stat-metric-card"><div class="lbl">Roofs in scope</div><div class="num">${r.roofs}</div><div class="lbl">${label}</div></div>
        <div class="stat-metric-card"><div class="lbl">Manual total time</div><div class="num" style="color:var(--danger)">${fmtHr(r.manualTotal)}</div><div class="lbl">${fmtMin(r.manualTotal)} incl. rework</div></div>
        <div class="stat-metric-card"><div class="lbl">Plugin total time</div><div class="num" style="color:var(--emerald)">${fmtHr(r.pluginTotal)}</div><div class="lbl">${fmtMin(r.pluginTotal)} incl. review</div></div>
        <div class="stat-metric-card highlight"><div class="lbl">Time saved</div><div class="num">${r.pct.toFixed(1)}%</div><div class="lbl">${fmtHr(r.saved)} saved</div></div>
      `;
    }

    const chartWrap = document.getElementById('chartWrap');
    if (chartWrap) {
      const maxVal = r.manualTotal;
      const manualH = 100;
      const pluginH = Math.max((r.pluginTotal / maxVal) * 100, 4);

      chartWrap.innerHTML = `
        <div class="bar-group" style="display:flex;align-items:flex-end;justify-content:center;gap:36px;height:100%;width:100%;">
          <div style="display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;width:90px;">
            <div class="bar manual" style="height:${manualH}%;width:100%;background:linear-gradient(180deg,#E74C3C,#C0392B);border-radius:6px 6px 0 0;position:relative;display:flex;justify-content:center;">
              <span style="position:absolute;top:-26px;font-weight:800;font-size:14px;color:var(--danger);white-space:nowrap;">${fmtHr(r.manualTotal)}</span>
            </div>
            <div style="font-size:13px;font-weight:700;margin-top:10px;">Manual</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;width:90px;">
            <div class="bar plugin" style="height:${pluginH}%;width:100%;background:linear-gradient(180deg,#2ECC71,#27AE60);border-radius:6px 6px 0 0;position:relative;display:flex;justify-content:center;">
              <span style="position:absolute;top:-26px;font-weight:800;font-size:14px;color:var(--emerald);white-space:nowrap;">${fmtHr(r.pluginTotal)}</span>
            </div>
            <div style="font-size:13px;font-weight:700;margin-top:10px;">Plugin</div>
          </div>
        </div>
      `;
    }

    const breakdownTable = document.getElementById('breakdownTable');
    if (breakdownTable) {
      breakdownTable.innerHTML = `
        <thead>
          <tr><th>Process</th><th class="num">Base time</th><th class="num">Rework</th><th class="num">Total time</th><th class="num">Total (hrs)</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><span class="tag-status red">● Manual</span></td>
            <td class="num">${fmtMin(r.manualBase)}</td>
            <td class="num">${fmtMin(r.manualRework)} (12.5%)</td>
            <td class="num">${fmtMin(r.manualTotal)}</td>
            <td class="num" style="font-weight:800;color:var(--danger);">${fmtHr(r.manualTotal)}</td>
          </tr>
          <tr>
            <td><span class="tag-status green">● Plugin</span></td>
            <td class="num">${fmtMin(r.pluginBase)}</td>
            <td class="num">${fmtMin(r.pluginRework)} (~0%)</td>
            <td class="num">${fmtMin(r.pluginTotal)}</td>
            <td class="num" style="font-weight:800;color:var(--emerald);">${fmtHr(r.pluginTotal)}</td>
          </tr>
          <tr style="background:var(--bg-subtle);font-weight:800;">
            <td>Time Saved</td>
            <td class="num">—</td>
            <td class="num">—</td>
            <td class="num" style="color:var(--emerald);">${fmtMin(r.saved)}</td>
            <td class="num" style="color:var(--emerald);">${fmtHr(r.saved)} (${r.pct.toFixed(1)}%)</td>
          </tr>
        </tbody>
      `;
    }
  }

  // =========================================================================
  // 4. EXECUTIVE ROI CUSTOM CALCULATOR
  // =========================================================================
  function computeExecutiveROI(params) {
    const roofs = Number(params.roofs) || 50;
    const pts = Number(params.pointsPerRoof) || 300;
    const manualSec = Number(params.manualSecPerPt) || 20;
    const rate = Number(params.hourlyRate) || 85;
    const reworkPasses = Number(params.reworkPasses) || 3;

    // Manual Calculations
    const manualSecPerRoof = pts * manualSec;
    const manualBaseHours = (manualSecPerRoof * roofs) / 3600;
    const manualTotalHours = manualBaseHours * reworkPasses;
    const manualLaborCost = manualTotalHours * rate;

    // Plugin Calculations (Average ~3.5 min/roof)
    const pluginMinPerRoof = pts <= 250 ? 3 : pts <= 450 ? 4 : 5;
    const pluginBaseHours = (pluginMinPerRoof * roofs) / 60;
    const pluginTotalHours = pluginBaseHours * 1.5; // 1 review pass
    const pluginLaborCost = pluginTotalHours * rate;

    const hoursSaved = Math.max(0, manualTotalHours - pluginTotalHours);
    const dollarsSaved = Math.max(0, manualLaborCost - pluginLaborCost);
    const pctSaved = manualTotalHours > 0 ? Math.round((hoursSaved / manualTotalHours) * 100) : 0;
    const speedupMultiplier = pluginTotalHours > 0 ? (manualTotalHours / pluginTotalHours).toFixed(1) : '30';

    return {
      roofs,
      pts,
      manualTotalHours,
      manualLaborCost,
      pluginTotalHours,
      pluginLaborCost,
      hoursSaved,
      dollarsSaved,
      pctSaved,
      speedupMultiplier
    };
  }

  function initExecutiveCalculator() {
    const roofsSlider = document.getElementById('calcRoofs');
    const ptsSlider = document.getElementById('calcPoints');
    const rateSlider = document.getElementById('calcRate');
    const reworkSlider = document.getElementById('calcRework');

    if (!roofsSlider) return;

    function update() {
      const p = {
        roofs: roofsSlider.value,
        pointsPerRoof: ptsSlider.value,
        hourlyRate: rateSlider.value,
        reworkPasses: reworkSlider.value
      };

      // Update Slider Value Displays
      document.getElementById('calcRoofsVal').textContent = p.roofs + ' roofs';
      document.getElementById('calcPointsVal').textContent = p.pointsPerRoof + ' pts / roof';
      document.getElementById('calcRateVal').textContent = '$' + p.hourlyRate + ' / hr';
      document.getElementById('calcReworkVal').textContent = p.reworkPasses + ' passes';

      const res = computeExecutiveROI(p);

      document.getElementById('roiDollarsSaved').textContent = fmtCurrency(res.dollarsSaved);
      document.getElementById('roiHoursSaved').textContent = fmtNumber(res.hoursSaved, 0) + ' hrs';
      document.getElementById('roiPctSaved').textContent = res.pctSaved + '%';
      document.getElementById('roiSpeedup').textContent = res.speedupMultiplier + '×';
      document.getElementById('roiManualCost').textContent = fmtCurrency(res.manualLaborCost);
      document.getElementById('roiPluginCost').textContent = fmtCurrency(res.pluginLaborCost);
    }

    [roofsSlider, ptsSlider, rateSlider, reworkSlider].forEach(s => {
      s.addEventListener('input', update);
    });

    update();
  }

  // Setup Event Listeners on DOM Load
  document.addEventListener('DOMContentLoaded', () => {
    // AutoSlope by Point toggles
    document.querySelectorAll('[data-tier-point]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tier-point]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderAutoSlopeV026(btn.getAttribute('data-tier-point'));
      });
    });

    // RoofRidgeLines toggles
    document.querySelectorAll('[data-tier-drain]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-tier-drain]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderRoofRidgeLines(btn.getAttribute('data-tier-drain'));
      });
    });

    // AutoSlope By Drain Scale toggles
    document.querySelectorAll('[data-scale-drain]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-scale-drain]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDrainScale(btn.getAttribute('data-scale-drain'));
      });
    });

    // Initialize defaults if elements exist
    if (document.getElementById('ringManual')) {
      renderAutoSlopeV026(400);
    }
    if (document.getElementById('barManualFill')) {
      renderRoofRidgeLines('large');
    }
    if (document.getElementById('summaryGrid')) {
      renderDrainScale('villa');
    }

    initExecutiveCalculator();
  });

  return {
    computeAutoSlopeV026,
    renderAutoSlopeV026,
    renderRoofRidgeLines,
    renderDrainScale,
    computeExecutiveROI
  };
})();
