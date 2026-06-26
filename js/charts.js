/* ============================================================
   Aletheia — charts.js
   Two Chart.js visualisations, themed for the monastic dark UI:
     1) Distortion frequency over time (stacked area-ish lines)
     2) Energy vs. Clarity scatter
   Charts are created once and updated in place to avoid leaks.
   ============================================================ */

(function () {
  'use strict';

  const { DISTORTIONS, DISTORTION_BY_ID } = window.AletheiaData;

  // Shared theme tokens
  const GRID = 'rgba(148, 163, 184, 0.08)';
  const TICK = 'rgba(148, 163, 184, 0.7)';
  const FONT = "Inter, system-ui, sans-serif";

  // A calm, distinct hue per distortion for the time chart.
  const LOOP_COLORS = {
    'catastrophizing': '#f87171',
    'all-or-nothing': '#fbbf24',
    'emotional-reasoning': '#f472b6',
    'overthinking': '#818cf8',
    'mind-reading': '#22d3ee',
    'should-statements': '#a78bfa',
  };

  let distortionChart = null;
  let correlationChart = null;

  // Apply global Chart.js defaults once.
  function applyDefaults() {
    if (!window.Chart) return;
    Chart.defaults.color = TICK;
    Chart.defaults.font.family = FONT;
    Chart.defaults.font.size = 11;
  }

  /* ---------- helpers ---------- */

  // Bucket entries into day keys (YYYY-MM-DD) sorted ascending.
  function dayBuckets(entries, days) {
    const buckets = [];
    const now = new Date();
    const span = days === 'all'
      ? Math.max(1, Math.ceil((now - new Date(entries[entries.length - 1]?.createdAt || now)) / 86400000) + 1)
      : Number(days);

    for (let i = span - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      buckets.push(d);
    }
    return buckets;
  }

  function dayKey(date) {
    return date.toISOString().slice(0, 10);
  }

  function dayLabel(date) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* ---------- Chart 1: distortion frequency over time ---------- */
  function renderDistortions(canvas, entries, range) {
    applyDefaults();
    const ctx = canvas.getContext('2d');

    // Limit the time chart to a sensible number of buckets.
    let buckets = dayBuckets(entries, range);
    if (buckets.length > 90) buckets = buckets.slice(-90);

    const labels = buckets.map(dayLabel);
    const keys = buckets.map(dayKey);

    // Count each distortion per day.
    const counts = {};
    DISTORTIONS.forEach((d) => { counts[d.id] = Object.fromEntries(keys.map((k) => [k, 0])); });

    entries.forEach((e) => {
      const k = e.createdAt.slice(0, 10);
      if (!(k in counts[DISTORTIONS[0].id])) return; // outside window
      (e.distortions || []).forEach((id) => {
        if (counts[id]) counts[id][k] += 1;
      });
    });

    const datasets = DISTORTIONS.map((d) => ({
      label: d.label,
      data: keys.map((k) => counts[d.id][k]),
      borderColor: LOOP_COLORS[d.id],
      backgroundColor: LOOP_COLORS[d.id] + '22',
      borderWidth: 2,
      tension: 0.35,
      fill: true,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: LOOP_COLORS[d.id],
    }));

    const config = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 14 },
          },
          tooltip: {
            backgroundColor: 'rgba(11,15,20,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            titleColor: '#e2e8f0',
            bodyColor: '#cbd5e1',
            cornerRadius: 8,
          },
        },
        scales: {
          x: { grid: { color: GRID, drawBorder: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { grid: { color: GRID, drawBorder: false }, beginAtZero: true, ticks: { precision: 0, stepSize: 1 } },
        },
      },
    };

    if (distortionChart) {
      distortionChart.data = config.data;
      distortionChart.options = config.options;
      distortionChart.update();
    } else {
      distortionChart = new Chart(ctx, config);
    }
  }

  /* ---------- Chart 2: energy vs clarity scatter ---------- */
  function renderCorrelation(canvas, entries) {
    applyDefaults();
    const ctx = canvas.getContext('2d');

    // Jitter overlapping points slightly so density is readable.
    const seen = {};
    const points = entries.map((e) => {
      const key = `${e.energy},${e.clarity}`;
      const n = (seen[key] = (seen[key] || 0) + 1);
      const jitter = (n - 1) * 0.08;
      return {
        x: e.energy + (jitter % 0.4) - 0.16,
        y: e.clarity + (Math.floor(jitter / 0.4) * 0.08),
        _raw: e,
      };
    });

    const config = {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Logged moments',
          data: points,
          backgroundColor: 'rgba(52, 211, 153, 0.55)',
          borderColor: 'rgba(52, 211, 153, 0.9)',
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(11,15,20,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (c) => `Energy ${c.raw._raw.energy} · Clarity ${c.raw._raw.clarity}`,
            },
          },
        },
        scales: {
          x: {
            min: 0, max: 11,
            title: { display: true, text: 'Energy', color: TICK },
            grid: { color: GRID, drawBorder: false },
            ticks: { stepSize: 1, callback: (v) => (v >= 1 && v <= 10 ? v : '') },
          },
          y: {
            min: 0, max: 11,
            title: { display: true, text: 'Clarity', color: TICK },
            grid: { color: GRID, drawBorder: false },
            ticks: { stepSize: 1, callback: (v) => (v >= 1 && v <= 10 ? v : '') },
          },
        },
      },
    };

    if (correlationChart) {
      correlationChart.data = config.data;
      correlationChart.options = config.options;
      correlationChart.update();
    } else {
      correlationChart = new Chart(ctx, config);
    }
  }

  function destroy() {
    if (distortionChart) { distortionChart.destroy(); distortionChart = null; }
    if (correlationChart) { correlationChart.destroy(); correlationChart = null; }
  }

  window.AletheiaCharts = { renderDistortions, renderCorrelation, destroy };
})();
