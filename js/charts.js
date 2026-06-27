/* ============================================================
   Aletheia — charts.js  (v2)
   Chart.js visualisations for the Analysis space, themed for
   the monastic dark UI. Each chart is created once and updated
   in place. All read from AletheiaAnalysis outputs.
   ============================================================ */

(function () {
  'use strict';

  const D = window.AletheiaData;
  const { PILLARS, EMOTION_FAMILIES } = D;

  const GRID = 'rgba(148,163,184,0.08)';
  const TICK = 'rgba(148,163,184,0.7)';
  const FONT = 'Inter, system-ui, sans-serif';
  const EMERALD = '#34d399';

  const charts = {}; // id -> Chart instance

  function defaults() {
    if (!window.Chart) return;
    Chart.defaults.color = TICK;
    Chart.defaults.font.family = FONT;
    Chart.defaults.font.size = 11;
  }

  function upsert(key, ctx, config) {
    if (charts[key]) {
      charts[key].data = config.data;
      charts[key].options = config.options;
      charts[key].update();
    } else {
      charts[key] = new Chart(ctx, config);
    }
  }

  const tooltipStyle = {
    backgroundColor: 'rgba(11,15,20,0.95)',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, padding: 10, cornerRadius: 8,
    titleColor: '#e2e8f0', bodyColor: '#cbd5e1',
  };

  /* ---------- 1. Affective circumplex ---------- */
  // Quadrant background plugin draws faint labels in each corner.
  const quadrantPlugin = {
    id: 'quadrants',
    beforeDraw(chart) {
      const { ctx, chartArea: a, scales } = chart;
      if (!a) return;
      const x0 = scales.x.getPixelForValue(0);
      const y0 = scales.y.getPixelForValue(0);
      ctx.save();
      // axes
      ctx.strokeStyle = 'rgba(148,163,184,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.left, y0); ctx.lineTo(a.right, y0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, a.top); ctx.lineTo(x0, a.bottom); ctx.stroke();
      // labels
      ctx.fillStyle = 'rgba(148,163,184,0.45)';
      ctx.font = '600 10px ' + FONT;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'right';  ctx.fillText('TENSE', a.right - 6, a.top + 4);
      ctx.textAlign = 'left';   ctx.fillText('ENERGIZED', a.left + 6, a.top + 4);
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'right';  ctx.fillText('LOW', a.right - 6, a.bottom - 4);
      ctx.textAlign = 'left';   ctx.fillText('CALM', a.left + 6, a.bottom - 4);
      ctx.restore();
    },
  };

  function circumplex(canvas, data) {
    defaults();
    const pts = data.points.map((p) => ({
      x: p.x, y: p.y,
      _fam: (window.AletheiaAnalysis.entryEmotionIds(p._raw)[0] || ''),
      _raw: p._raw,
    }));

    const colorFor = (p) => {
      const ids = window.AletheiaAnalysis.entryEmotionIds(p._raw);
      const fam = ids.length ? (D.EMOTION_BY_ID[ids[0]] || {}).family : null;
      return fam && EMOTION_FAMILIES[fam] ? EMOTION_FAMILIES[fam].color : EMERALD;
    };

    const datasets = [{
      label: 'Moments',
      data: pts,
      pointRadius: 5,
      pointHoverRadius: 7,
      backgroundColor: pts.map((p) => colorFor(p) + 'cc'),
      borderColor: pts.map((p) => colorFor(p)),
      borderWidth: 1,
    }];

    if (data.centroid) {
      datasets.push({
        label: 'Your average',
        data: [{ x: data.centroid.x, y: data.centroid.y }],
        pointRadius: 9,
        pointHoverRadius: 11,
        pointStyle: 'rectRot',
        backgroundColor: '#ffffff',
        borderColor: '#0b0f14',
        borderWidth: 2,
      });
    }

    upsert('circumplex', canvas.getContext('2d'), {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle,
            callbacks: {
              label: (c) => {
                if (c.datasetIndex === 1) return `Average · balance ${c.raw.x}, energy ${c.raw.y}`;
                const ids = window.AletheiaAnalysis.entryEmotionIds(c.raw._raw);
                const names = ids.map((id) => (D.EMOTION_BY_ID[id] || {}).label).filter(Boolean);
                return names.length ? names.join(', ') : 'Moment';
              },
            },
          },
        },
        scales: {
          x: { min: -1, max: 1, grid: { color: GRID, drawBorder: false },
               title: { display: true, text: 'Unpleasant  ←  balance  →  Pleasant', color: TICK },
               ticks: { stepSize: 0.5 } },
          y: { min: -1, max: 1, grid: { color: GRID, drawBorder: false },
               title: { display: true, text: 'Low energy  ←  →  Activated', color: TICK },
               ticks: { stepSize: 0.5 } },
        },
      },
      plugins: [quadrantPlugin],
    });
  }

  /* ---------- 2. Valence trend over time ---------- */
  function valenceTrend(canvas, series) {
    defaults();
    const labels = series.map((d) => fmtDay(d.day));
    const values = series.map((d) => d.value);

    upsert('valence', canvas.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily balance',
          data: values,
          borderColor: EMERALD,
          backgroundColor: 'rgba(52,211,153,0.12)',
          borderWidth: 2, tension: 0.35, fill: true,
          pointRadius: series.length <= 30 ? 3 : 0,
          pointHoverRadius: 5, pointBackgroundColor: EMERALD,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipStyle },
        scales: {
          x: { grid: { color: GRID, drawBorder: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { min: -1, max: 1, grid: { color: GRID, drawBorder: false }, ticks: { stepSize: 0.5 } },
        },
      },
    });
  }

  /* ---------- 3. Distortion frequency (horizontal bars) ---------- */
  function distortions(canvas, ranked) {
    defaults();
    const top = ranked.slice(0, 8);
    upsert('distortions', canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: top.map((d) => d.label),
        datasets: [{
          label: 'Times flagged',
          data: top.map((d) => d.n),
          backgroundColor: 'rgba(129,140,248,0.55)',
          borderColor: '#818cf8', borderWidth: 1, borderRadius: 5,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tooltipStyle },
        scales: {
          x: { beginAtZero: true, grid: { color: GRID, drawBorder: false }, ticks: { precision: 0, stepSize: 1 } },
          y: { grid: { display: false, drawBorder: false } },
        },
      },
    });
  }

  /* ---------- 4. Practice adherence (grouped by pillar) ---------- */
  function adherence(canvas, perPractice) {
    defaults();
    upsert('adherence', canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: perPractice.map((p) => p.label),
        datasets: [{
          label: 'Completion rate',
          data: perPractice.map((p) => Math.round(p.rate * 100)),
          backgroundColor: perPractice.map((p) => PILLARS[p.pillar].color + '99'),
          borderColor: perPractice.map((p) => PILLARS[p.pillar].color),
          borderWidth: 1, borderRadius: 5,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle, callbacks: { label: (c) => `${c.raw}% of days` } },
        },
        scales: {
          x: { min: 0, max: 100, grid: { color: GRID, drawBorder: false }, ticks: { callback: (v) => v + '%' } },
          y: { grid: { display: false, drawBorder: false } },
        },
      },
    });
  }

  /* ---------- 5. Practice → mood lift (diverging) ---------- */
  function moodLift(canvas, effects) {
    defaults();
    const usable = effects
      .filter((e) => e.valenceDiff != null && e.nDone >= 3 && e.nNot >= 3)
      .sort((a, b) => b.valenceDiff - a.valenceDiff);

    upsert('lift', canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: usable.map((e) => e.label),
        datasets: [{
          label: 'Mood difference',
          data: usable.map((e) => e.valenceDiff),
          backgroundColor: usable.map((e) => (e.valenceDiff >= 0 ? 'rgba(52,211,153,0.6)' : 'rgba(248,113,113,0.6)')),
          borderColor: usable.map((e) => (e.valenceDiff >= 0 ? '#34d399' : '#f87171')),
          borderWidth: 1, borderRadius: 5,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { ...tooltipStyle, callbacks: {
            label: (c) => `${c.raw >= 0 ? '+' : ''}${c.raw} balance (${usable[c.dataIndex].nDone} vs ${usable[c.dataIndex].nNot} days)`,
          } },
        },
        scales: {
          x: { grid: { color: GRID, drawBorder: false }, suggestedMin: -0.5, suggestedMax: 0.5,
               title: { display: true, text: 'Mood on days done vs not done', color: TICK } },
          y: { grid: { display: false, drawBorder: false } },
        },
      },
    });
  }

  /* ---------- 6. Weekday mood ---------- */
  function weekday(canvas, series) {
    defaults();
    upsert('weekday', canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: series.map((d) => d.label),
        datasets: [{
          label: 'Average balance',
          data: series.map((d) => d.value),
          backgroundColor: series.map((d) => (d.value == null ? 'rgba(148,163,184,0.2)' : d.value >= 0 ? 'rgba(52,211,153,0.55)' : 'rgba(96,165,250,0.55)')),
          borderColor: series.map((d) => (d.value == null ? 'rgba(148,163,184,0.3)' : d.value >= 0 ? '#34d399' : '#60a5fa')),
          borderWidth: 1, borderRadius: 5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltipStyle, callbacks: { label: (c) => c.raw == null ? 'No entries' : `balance ${c.raw} (${series[c.dataIndex].n})` } } },
        scales: {
          x: { grid: { display: false, drawBorder: false } },
          y: { min: -1, max: 1, grid: { color: GRID, drawBorder: false }, ticks: { stepSize: 0.5 } },
        },
      },
    });
  }

  function fmtDay(key) {
    const d = new Date(key + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function destroyAll() {
    Object.values(charts).forEach((c) => c.destroy());
    Object.keys(charts).forEach((k) => delete charts[k]);
  }

  window.AletheiaCharts = {
    circumplex, valenceTrend, distortions, adherence, moodLift, weekday, destroyAll,
  };
})();
