/**
 * Revit26 RoofTools Suite — Interactive Excel Workbook Viewer Component
 * Supports multi-sheet switching (Vertex Data, Run Summary, Drain Points, Statistics),
 * formula bar updates, cell selection, and data exports.
 */

(function () {
  'use strict';

  const SHEETS_DATA = {
    'vertex-data': {
      title: 'AUTOSLOPE — VERTEX DATA',
      nameBox: 'A1',
      fx: 'AUTOSLOPE — VERTEX DATA',
      headers: ['VertexIndex', 'DrainIndex', 'WasProcessed', 'PathLength_m', 'SlopePercent', 'LevelOffset_mm', 'Status'],
      rows: [
        ['0', '2', 'true', '4.82', '1.00', '48', 'OK'],
        ['1', '1', 'true', '3.15', '1.00', '32', 'OK'],
        ['2', '—', 'false', '0.00', '1.00', '—', 'Skipped (Outside Offset)'],
        ['3', '0', 'true', '2.04', '1.00', '20', 'OK'],
        ['4', '2', 'true', '5.10', '1.00', '51', 'OK'],
        ['5', '1', 'true', '1.80', '1.00', '18', 'OK'],
        ['6', '0', 'true', '3.92', '1.00', '39', 'OK'],
        ['7', '—', 'false', '0.00', '1.00', '—', 'Skipped (Boundary Clamped)']
      ]
    },
    'run-summary': {
      title: 'AUTOSLOPE — RUN SUMMARY',
      nameBox: 'B2',
      fx: 'Autodesk Revit 2026 External Command',
      headers: ['Parameter', 'Value', 'Unit', 'Revit Field Name', 'Notes'],
      rows: [
        ['Status', 'Success (1)', 'Integer', 'AutoSlope_Status', 'All valid vertices sloped'],
        ['Slope Applied', '1.00', '%', 'AutoSlope_SlopePercent', 'Standard commercial low-slope'],
        ['Threshold', '0.05', 'm', 'AutoSlope_Threshold', 'Minimum elevation drop limit'],
        ['Drain Tolerance', '50', 'mm', 'AutoSlope_DrainToleranceMm', 'Seed radius matching enabled'],
        ['Picked Drains', '3', 'Count', 'AutoSlope_DrainCount', 'User selected in view'],
        ['Final Drain Count', '3', 'Count', 'AutoSlope_DrainCount', '3 clusters formed'],
        ['Vertices Processed', '212', 'Count', 'AutoSlope_VerticesProcessed', 'Elevations written to slab'],
        ['Vertices Skipped', '8', 'Count', 'AutoSlope_VerticesSkipped', 'Clamped to perimeter offset'],
        ['Longest Path', '4.82', 'm', 'AutoSlope_LongestPath', 'Maximum Dijkstra distance'],
        ['Highest Elevation', '48', 'mm', 'AutoSlope_HighestElevation', 'Peak roof elevation delta'],
        ['Run Duration', '3.1', 's', 'AutoSlope_RunDuration_sec', 'Dijkstra execution time']
      ]
    },
    'drain-points': {
      title: 'AUTOSLOPE — DRAIN POINTS',
      nameBox: 'A1',
      fx: 'AUTOSLOPE — DRAIN DETECTION SEEDS',
      headers: ['DrainID', 'Location X (m)', 'Location Y (m)', 'Matched Vertices', 'Cluster Radius (mm)', 'State'],
      rows: [
        ['Drain_01', '12.450', '8.200', '74', '50', 'Active / Verified'],
        ['Drain_02', '24.800', '16.500', '81', '50', 'Active / Verified'],
        ['Drain_03', '38.150', '9.400', '57', '50', 'Active / Verified']
      ]
    },
    'statistics': {
      title: 'AUTOSLOPE — ELEVATION STATISTICS',
      nameBox: 'A1',
      fx: 'AUTOSLOPE — STATISTICAL DISTRIBUTION',
      headers: ['Elevation Bucket (mm)', 'Vertex Count', 'Percentage', 'Average Path Length (m)', 'Cumulative %'],
      rows: [
        ['0 – 10 mm', '42', '19.8%', '0.85 m', '19.8%'],
        ['11 – 25 mm', '86', '40.6%', '2.14 m', '60.4%'],
        ['26 – 40 mm', '58', '27.4%', '3.45 m', '87.8%'],
        ['41 – 50 mm', '26', '12.2%', '4.62 m', '100.0%']
      ]
    }
  };

  function renderSheet(sheetKey, container) {
    const data = SHEETS_DATA[sheetKey] || SHEETS_DATA['vertex-data'];
    if (!container) return;

    // Update Formula Bar
    const fxContent = container.querySelector('.xl-fxcontent');
    const nameBox = container.querySelector('.xl-namebox');
    if (fxContent) fxContent.textContent = data.fx;
    if (nameBox) nameBox.textContent = data.nameBox;

    // Generate Table HTML
    let tableHtml = `
      <table class="xl-table">
        <thead>
          <tr class="xl-colhead">
            <th class="xl-corner"></th>
            ${data.headers.map((_, i) => `<th>${String.fromCharCode(65 + i)}</th>`).join('')}
          </tr>
          <tr class="xl-header-row">
            <th class="xl-rownum">1</th>
            <th colspan="${data.headers.length}" class="xl-banner">${data.title}</th>
          </tr>
          <tr class="xl-header-row">
            <th class="xl-rownum">2</th>
            ${data.headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    data.rows.forEach((row, rIdx) => {
      const rowNum = rIdx + 3;
      const isSkipped = row.some(c => String(c).toLowerCase().includes('skipped') || c === 'false');
      tableHtml += `<tr ${isSkipped ? 'style="background:#FFF9E8;"' : ''}>
        <td class="xl-rownum">${rowNum}</td>
        ${row.map((cell, cIdx) => {
          const isNum = !isNaN(parseFloat(cell)) && isFinite(cell) && !cell.includes('%') && !cell.includes('_');
          const isOk = cell === 'true' || cell === 'OK' || cell.includes('Verified');
          const isFail = cell === 'false' || cell.includes('Skipped');
          let styleClass = isNum ? 'xl-num' : cell === '—' ? 'xl-dash' : '';
          let cellContent = cell;
          if (isOk) cellContent = `<span style="color:#1E7B44;font-weight:700;">${cell}</span>`;
          if (isFail) cellContent = `<span style="color:#C0392B;font-weight:600;">${cell}</span>`;
          return `<td class="${styleClass}" data-col="${String.fromCharCode(65 + cIdx)}" data-row="${rowNum}">${cellContent}</td>`;
        }).join('')}
      </tr>`;
    });

    tableHtml += `
        </tbody>
      </table>
    `;

    const gridWrap = container.querySelector('.xl-gridwrap');
    if (gridWrap) {
      gridWrap.innerHTML = tableHtml;

      // Add click listeners to cells for dynamic formula bar inspection
      gridWrap.querySelectorAll('td:not(.xl-rownum)').forEach(td => {
        td.addEventListener('click', () => {
          gridWrap.querySelectorAll('td').forEach(c => c.style.outline = 'none');
          td.style.outline = '2px solid #0F6A34';
          const col = td.getAttribute('data-col') || 'A';
          const row = td.getAttribute('data-row') || '1';
          if (nameBox) nameBox.textContent = `${col}${row}`;
          if (fxContent) fxContent.textContent = td.innerText || td.textContent;
        });
      });
    }
  }

  function initExcelViewers() {
    document.querySelectorAll('.xl-window').forEach(xlWin => {
      const sheetTabs = xlWin.querySelectorAll('.xl-sheettab');
      sheetTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          sheetTabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const sheetKey = tab.getAttribute('data-sheet') || 'vertex-data';
          renderSheet(sheetKey, xlWin);
        });
      });

      // Render default sheet
      renderSheet('vertex-data', xlWin);
    });
  }

  document.addEventListener('DOMContentLoaded', initExcelViewers);

  window.ExcelWorkbookViewer = {
    renderSheet,
    SHEETS_DATA
  };
})();
