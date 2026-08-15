/**
 * Revit26 RoofTools Suite — Global Application Logic
 * Theme Switcher, Mobile Nav, Scroll Effects, Log Streamer & Clipboard
 */

(function () {
  'use strict';

  // 1. THEME MANAGEMENT (Dark / Light)
  const THEME_KEY = 'revit_rooftools_theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeToggleIcons(theme);
  }

  function updateThemeToggleIcons(theme) {
    const btns = document.querySelectorAll('.theme-toggle-btn');
    btns.forEach(btn => {
      if (theme === 'dark') {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        btn.setAttribute('title', 'Switch to Light Mode');
      } else {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
        btn.setAttribute('title', 'Switch to Dark Mode');
      }
    });
  }

  // Initialize theme
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle button click
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
      });
    });

    // 2. MOBILE NAVIGATION
    const mobileBtn = document.querySelector('.mobile-toggle-btn');
    const navMenu = document.querySelector('.nav-menu');

    if (mobileBtn && navMenu) {
      mobileBtn.addEventListener('click', () => {
        navMenu.classList.toggle('open');
        const isOpen = navMenu.classList.contains('open');
        mobileBtn.innerHTML = isOpen
          ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
          : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      });
    }

    // 3. COPY TO CLIPBOARD UTILITIES
    document.querySelectorAll('[data-copy-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-copy-target');
        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        const text = targetEl.innerText || targetEl.textContent;
        navigator.clipboard.writeText(text).then(() => {
          const original = btn.innerHTML;
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
          btn.classList.add('copied');
          setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('copied');
          }, 2200);
        });
      });
    });

    // 4. SHARED PARAMETERS SEARCH & FILTER
    const paramInput = document.getElementById('paramSearchInput');
    const paramGrid = document.getElementById('paramGrid');
    const filterBtns = document.querySelectorAll('.param-filter-btn');

    if (paramInput && paramGrid) {
      function filterParams() {
        const query = paramInput.value.toLowerCase().trim();
        const activeTypeBtn = document.querySelector('.param-filter-btn.active');
        const typeFilter = activeTypeBtn ? activeTypeBtn.getAttribute('data-filter') : 'all';

        const cards = paramGrid.querySelectorAll('.param-card');
        cards.forEach(card => {
          const name = (card.getAttribute('data-name') || '').toLowerCase();
          const desc = (card.getAttribute('data-desc') || '').toLowerCase();
          const type = (card.getAttribute('data-type') || '').toLowerCase();

          const matchesQuery = name.includes(query) || desc.includes(query);
          const matchesType = typeFilter === 'all' || type === typeFilter.toLowerCase();

          if (matchesQuery && matchesType) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      }

      paramInput.addEventListener('input', filterParams);

      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          filterParams();
        });
      });
    }

    // 5. HERO CANVAS CONTOUR ANIMATION (For Portal Hub)
    initPortalHeroCanvas();
  });

  // Animated canvas visualizer for the portal hero
  function initPortalHeroCanvas() {
    const canvas = document.getElementById('heroRoofCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = (canvas.width = canvas.parentElement.clientWidth);
    let height = (canvas.height = canvas.parentElement.clientHeight);

    window.addEventListener('resize', () => {
      if (canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = canvas.parentElement.clientHeight;
      }
    });

    // Simulated drain seeds
    const drains = [
      { x: width * 0.28, y: height * 0.42, r: 12, pulse: 0 },
      { x: width * 0.72, y: height * 0.36, r: 12, pulse: Math.PI },
      { x: width * 0.50, y: height * 0.75, r: 12, pulse: Math.PI * 0.5 }
    ];

    let t = 0;

    function renderHero() {
      t += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Background grid
      ctx.strokeStyle = 'rgba(45, 108, 223, 0.08)';
      ctx.lineWidth = 1;
      const step = 28;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Contour rings around each drain
      drains.forEach((d, idx) => {
        d.x = width * (idx === 0 ? 0.28 : idx === 1 ? 0.72 : 0.5);
        d.y = height * (idx === 0 ? 0.42 : idx === 1 ? 0.36 : 0.72);

        for (let ring = 1; ring <= 6; ring++) {
          const radius = ring * 24 + Math.sin(t + ring * 0.5) * 3;
          ctx.beginPath();
          ctx.arc(d.x, d.y, radius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(91, 141, 239, ${0.35 - ring * 0.05})`;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);

      // Bisector / Ridge lines between drains
      ctx.strokeStyle = 'rgba(201, 162, 75, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Midpoint between drain 0 and 1
      const mx01 = (drains[0].x + drains[1].x) / 2;
      const my01 = (drains[0].y + drains[1].y) / 2;
      ctx.moveTo(mx01, 0);
      ctx.lineTo(mx01, my01);
      ctx.lineTo(width * 0.5, height);
      ctx.stroke();

      // Draw drain points
      drains.forEach((d, i) => {
        const pulseR = 8 + Math.sin(t * 2 + d.pulse) * 4;
        ctx.beginPath();
        ctx.arc(d.x, d.y, pulseR + 8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(39, 174, 96, 0.15)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#27AE60';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#EBF2FA';
        ctx.font = '10px "Space Grotesk", sans-serif';
        ctx.fillText(`DRAIN #${i + 1}`, d.x - 22, d.y - 12);
      });

      requestAnimationFrame(renderHero);
    }

    renderHero();
  }

})();
