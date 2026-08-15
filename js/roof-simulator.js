/**
 * Revit26 RoofTools Suite — Interactive 2D Roof Simulator & Sandbox
 * Simulates Voronoi Ridge & Valley lines (RoofRidgeLines V67) and
 * Dijkstra Shortest-Path Elevation Contours & Water Flow (AutoSlope).
 */

window.RoofSimulator = (function () {
  'use strict';

  // Preset Roof Boundary Polygons (Normalized 0..1 coordinates)
  const ROOF_PRESETS = {
    rectangle: {
      name: 'Rectangular Commercial Roof',
      aspect: 1.6,
      polygon: [
        { x: 0.08, y: 0.12 },
        { x: 0.92, y: 0.12 },
        { x: 0.92, y: 0.88 },
        { x: 0.08, y: 0.88 }
      ],
      holes: [],
      defaultDrains: [
        { x: 0.28, y: 0.40 },
        { x: 0.72, y: 0.38 },
        { x: 0.50, y: 0.72 }
      ]
    },
    'l-shape': {
      name: 'L-Shaped Medical Facility',
      aspect: 1.3,
      polygon: [
        { x: 0.10, y: 0.10 },
        { x: 0.52, y: 0.10 },
        { x: 0.52, y: 0.46 },
        { x: 0.90, y: 0.46 },
        { x: 0.90, y: 0.90 },
        { x: 0.10, y: 0.90 }
      ],
      holes: [],
      defaultDrains: [
        { x: 0.30, y: 0.28 },
        { x: 0.30, y: 0.70 },
        { x: 0.72, y: 0.70 }
      ]
    },
    courtyard: {
      name: 'Courtyard with Skylight Openings',
      aspect: 1.5,
      polygon: [
        { x: 0.08, y: 0.10 },
        { x: 0.92, y: 0.10 },
        { x: 0.92, y: 0.90 },
        { x: 0.08, y: 0.90 }
      ],
      holes: [
        [ { x: 0.22, y: 0.35 }, { x: 0.42, y: 0.35 }, { x: 0.42, y: 0.65 }, { x: 0.22, y: 0.65 } ],
        [ { x: 0.58, y: 0.35 }, { x: 0.78, y: 0.35 }, { x: 0.78, y: 0.65 }, { x: 0.58, y: 0.65 } ]
      ],
      defaultDrains: [
        { x: 0.14, y: 0.20 },
        { x: 0.50, y: 0.20 },
        { x: 0.86, y: 0.20 },
        { x: 0.50, y: 0.80 }
      ]
    }
  };

  class SimulatorInstance {
    constructor(canvasId) {
      this.canvas = document.getElementById(canvasId);
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.currentPresetKey = 'rectangle';
      this.mode = 'voronoi-slope'; // 'voronoi' | 'dijkstra' | 'voronoi-slope'
      this.slopePercent = 1.5;
      this.threshold = 0.05;
      this.toleranceMm = 50;
      this.scaleMeters = 40; // 40m wide

      this.showContours = true;
      this.showFlow = true;
      this.showRidges = true;
      this.showVertices = true;

      this.activeDrains = [];
      this.isDragging = false;
      this.draggedDrainIndex = -1;

      this.init();
    }

    init() {
      this.loadPreset(this.currentPresetKey);
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());

      // Mouse & Touch Interactions for placing & dragging drains
      this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
      this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
      window.addEventListener('mouseup', () => this.handlePointerUp());

      this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
      window.addEventListener('touchend', () => this.handlePointerUp());

      this.render();
    }

    resizeCanvas() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = this.canvas.width = rect.width;
      this.height = this.canvas.height = rect.height || 500;
      this.render();
    }

    loadPreset(presetKey) {
      const preset = ROOF_PRESETS[presetKey] || ROOF_PRESETS.rectangle;
      this.currentPresetKey = presetKey;
      this.preset = preset;
      this.activeDrains = preset.defaultDrains.map(d => ({ ...d }));
      this.render();
    }

    getCanvasCoords(e) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / this.width,
        y: (e.clientY - rect.top) / this.height
      };
    }

    isPointInPoly(pt, poly) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }

    isInsideRoof(pt) {
      if (!this.isPointInPoly(pt, this.preset.polygon)) return false;
      for (const hole of this.preset.holes) {
        if (this.isPointInPoly(pt, hole)) return false;
      }
      return true;
    }

    handlePointerDown(e) {
      const pos = this.getCanvasCoords(e);

      // Check if clicking existing drain to drag or delete
      for (let i = 0; i < this.activeDrains.length; i++) {
        const d = this.activeDrains[i];
        const dist = Math.hypot(d.x - pos.x, (d.y - pos.y) * (this.height / this.width));
        if (dist < 0.035) {
          if (e.shiftKey || e.button === 2) {
            // Remove drain
            this.activeDrains.splice(i, 1);
            this.render();
            return;
          }
          this.isDragging = true;
          this.draggedDrainIndex = i;
          return;
        }
      }

      // If clicked inside roof polygon, add new drain
      if (this.isInsideRoof(pos)) {
        if (this.activeDrains.length < 12) {
          this.activeDrains.push({ x: pos.x, y: pos.y });
          this.render();
        }
      }
    }

    handlePointerMove(e) {
      if (!this.isDragging || this.draggedDrainIndex === -1) return;
      const pos = this.getCanvasCoords(e);
      if (this.isInsideRoof(pos)) {
        this.activeDrains[this.draggedDrainIndex] = { x: pos.x, y: pos.y };
        this.render();
      }
    }

    handlePointerUp() {
      this.isDragging = false;
      this.draggedDrainIndex = -1;
    }

    handleTouchStart(e) {
      if (e.touches.length === 1) {
        e.preventDefault();
        this.handlePointerDown(e.touches[0]);
      }
    }

    handleTouchMove(e) {
      if (e.touches.length === 1 && this.isDragging) {
        e.preventDefault();
        this.handlePointerMove(e.touches[0]);
      }
    }

    render() {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw Blueprint Background Grid
      ctx.strokeStyle = 'rgba(45, 108, 223, 0.09)';
      ctx.lineWidth = 1;
      const gridSpacing = 28;
      for (let x = 0; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // 2. Render Roof Slab Interior & Distance Field / Elevation Contours
      this.renderRoofSurface();

      // 3. Render Voronoi Ridge & Valley lines if enabled
      if (this.showRidges && this.activeDrains.length > 1) {
        this.renderVoronoiRidges();
      }

      // 4. Render Roof Perimeter Boundaries & Skylight Openings
      this.renderRoofBoundaries();

      // 5. Render Drain Markers
      this.renderDrains();

      // 6. Update Real-Time Simulation Metrics Panel
      this.updateMetrics();
    }

    renderRoofSurface() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.save();
      // Clip rendering to roof polygon minus holes
      ctx.beginPath();
      const poly = this.preset.polygon;
      ctx.moveTo(poly[0].x * w, poly[0].y * h);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x * w, poly[i].y * h);
      }
      ctx.closePath();

      for (const hole of this.preset.holes) {
        ctx.moveTo(hole[0].x * w, hole[0].y * h);
        for (let i = 1; i < hole.length; i++) {
          ctx.lineTo(hole[i].x * w, hole[i].y * h);
        }
        ctx.closePath();
      }
      ctx.clip('evenodd');

      // Fill base slab
      ctx.fillStyle = '#10233C';
      ctx.fillRect(0, 0, w, h);

      // Render Elevation Contours / Distance Field
      if (this.activeDrains.length > 0 && this.showContours) {
        const step = 8;
        let maxDist = 0;

        for (let x = 0; x < w; x += step) {
          for (let y = 0; y < h; y += step) {
            const normX = x / w;
            const normY = y / h;
            if (!this.isInsideRoof({ x: normX, y: normY })) continue;

            let minDist = Infinity;
            let nearestDrain = null;

            for (const d of this.activeDrains) {
              const dx = (normX - d.x) * this.scaleMeters;
              const dy = (normY - d.y) * (this.scaleMeters * (h / w));
              const dist = Math.hypot(dx, dy);
              if (dist < minDist) {
                minDist = dist;
                nearestDrain = d;
              }
            }

            if (minDist > maxDist) maxDist = minDist;

            // Calculate elevation drop in mm
            const elevationMm = minDist * (this.slopePercent / 100) * 1000;
            const normElev = Math.min(elevationMm / 450, 1.0);

            // Interpolate color: Green (Low) -> Yellow -> Red/Coral (High Ridge)
            let r, g, b;
            if (normElev < 0.5) {
              const t = normElev * 2;
              r = Math.round(39 + (241 - 39) * t);
              g = Math.round(174 + (196 - 174) * t);
              b = Math.round(96 + (15 - 96) * t);
            } else {
              const t = (normElev - 0.5) * 2;
              r = Math.round(241 + (231 - 241) * t);
              g = Math.round(196 + (76 - 196) * t);
              b = Math.round(15 + (60 - 15) * t);
            }

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.28)`;
            ctx.fillRect(x - step / 2, y - step / 2, step, step);

            // Draw flow arrows on a sparser grid
            if (this.showFlow && x % 40 === 0 && y % 40 === 0 && nearestDrain) {
              const ndX = nearestDrain.x * w;
              const ndY = nearestDrain.y * h;
              const angle = Math.atan2(ndY - y, ndX - x);
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10);
              ctx.stroke();
            }
          }
        }
      }

      ctx.restore();
    }

    renderVoronoiRidges() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.save();
      // Clip to roof
      ctx.beginPath();
      const poly = this.preset.polygon;
      ctx.moveTo(poly[0].x * w, poly[0].y * h);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x * w, poly[i].y * h);
      }
      ctx.closePath();
      ctx.clip();

      // Compute pairwise bisector ridge lines
      ctx.strokeStyle = '#C9A24B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);

      for (let i = 0; i < this.activeDrains.length; i++) {
        for (let j = i + 1; j < this.activeDrains.length; j++) {
          const d1 = this.activeDrains[i];
          const d2 = this.activeDrains[j];

          const mx = (d1.x + d2.x) / 2 * w;
          const my = (d1.y + d2.y) / 2 * h;

          const dx = (d2.x - d1.x) * w;
          const dy = (d2.y - d1.y) * h;

          // Perpendicular vector
          const px = -dy;
          const py = dx;
          const len = Math.hypot(px, py);

          if (len > 0) {
            const uX = (px / len) * w * 1.5;
            const uY = (py / len) * h * 1.5;

            ctx.beginPath();
            ctx.moveTo(mx - uX, my - uY);
            ctx.lineTo(mx + uX, my + uY);
            ctx.stroke();
          }
        }
      }

      ctx.restore();
      ctx.setLineDash([]);
    }

    renderRoofBoundaries() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      // Outer boundary
      ctx.strokeStyle = '#5B8DEF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const poly = this.preset.polygon;
      ctx.moveTo(poly[0].x * w, poly[0].y * h);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x * w, poly[i].y * h);
      }
      ctx.closePath();
      ctx.stroke();

      // Boundary vertex dots
      if (this.showVertices) {
        ctx.fillStyle = '#FFFFFF';
        poly.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x * w, pt.y * h, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Skylight / opening cutouts
      ctx.strokeStyle = '#E67E22';
      ctx.lineWidth = 2.5;
      for (const hole of this.preset.holes) {
        ctx.beginPath();
        ctx.moveTo(hole[0].x * w, hole[0].y * h);
        for (let i = 1; i < hole.length; i++) {
          ctx.lineTo(hole[i].x * w, hole[i].y * h);
        }
        ctx.closePath();
        ctx.fillStyle = '#07101B';
        ctx.fill();
        ctx.stroke();
      }
    }

    renderDrains() {
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      this.activeDrains.forEach((d, idx) => {
        const dx = d.x * w;
        const dy = d.y * h;

        // Drain tolerance ring
        ctx.beginPath();
        ctx.arc(dx, dy, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(39, 174, 96, 0.16)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(39, 174, 96, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Drain node point
        ctx.beginPath();
        ctx.arc(dx, dy, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#27AE60';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Label
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillText(`D${idx + 1}`, dx - 6, dy - 12);
      });
    }

    updateMetrics() {
      let maxDistMeters = 0;
      let vertexCount = 0;

      // Sample grid of vertices
      const step = 0.04;
      for (let x = 0.05; x <= 0.95; x += step) {
        for (let y = 0.05; y <= 0.95; y += step) {
          if (!this.isInsideRoof({ x, y })) continue;
          vertexCount++;

          for (const d of this.activeDrains) {
            const dx = (x - d.x) * this.scaleMeters;
            const dy = (y - d.y) * (this.scaleMeters * (this.height / this.width));
            const dist = Math.hypot(dx, dy);
            if (dist > maxDistMeters) maxDistMeters = dist;
          }
        }
      }

      const highestElevationMm = Math.round(maxDistMeters * (this.slopePercent / 100) * 1000);

      const simDrainCountEl = document.getElementById('simDrainCount');
      if (simDrainCountEl) simDrainCountEl.textContent = this.activeDrains.length;

      const simVertexCountEl = document.getElementById('simVertexCount');
      if (simVertexCountEl) simVertexCountEl.textContent = vertexCount;

      const simLongestPathEl = document.getElementById('simLongestPath');
      if (simLongestPathEl) simLongestPathEl.textContent = maxDistMeters.toFixed(2) + ' m';

      const simHighestElevEl = document.getElementById('simHighestElev');
      if (simHighestElevEl) simHighestElevEl.textContent = highestElevationMm + ' mm';
    }
  }

  function initSimulators() {
    const defaultCanvas = document.getElementById('roofSimCanvas');
    if (defaultCanvas) {
      window.mainSimulator = new SimulatorInstance('roofSimCanvas');

      // Preset switcher buttons
      document.querySelectorAll('[data-sim-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('[data-sim-preset]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          window.mainSimulator.loadPreset(btn.getAttribute('data-sim-preset'));
        });
      });

      // Slope % slider
      const slopeSlider = document.getElementById('simSlopeSlider');
      if (slopeSlider) {
        slopeSlider.addEventListener('input', () => {
          const val = parseFloat(slopeSlider.value);
          window.mainSimulator.slopePercent = val;
          const disp = document.getElementById('simSlopeVal');
          if (disp) disp.textContent = val.toFixed(2) + '%';
          window.mainSimulator.render();
        });
      }

      // Layer checkboxes
      const chkRidges = document.getElementById('simChkRidges');
      if (chkRidges) {
        chkRidges.addEventListener('change', () => {
          window.mainSimulator.showRidges = chkRidges.checked;
          window.mainSimulator.render();
        });
      }

      const chkContours = document.getElementById('simChkContours');
      if (chkContours) {
        chkContours.addEventListener('change', () => {
          window.mainSimulator.showContours = chkContours.checked;
          window.mainSimulator.render();
        });
      }

      const chkFlow = document.getElementById('simChkFlow');
      if (chkFlow) {
        chkFlow.addEventListener('change', () => {
          window.mainSimulator.showFlow = chkFlow.checked;
          window.mainSimulator.render();
        });
      }

      // Reset Drains Button
      const resetBtn = document.getElementById('simResetDrains');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          window.mainSimulator.loadPreset(window.mainSimulator.currentPresetKey);
        });
      }
    }
  }

  document.addEventListener('DOMContentLoaded', initSimulators);

  return {
    SimulatorInstance,
    ROOF_PRESETS
  };
})();
