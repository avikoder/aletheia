/* ============================================================
   Aletheia — analysis.js
   A small, transparent statistics engine for turning logged
   entries and daily practices into evaluation metrics and
   plain-language, decision-ready insights.

   Design principles:
   • Every metric is computed from the user's own data, locally.
   • Associations are reported with sample sizes and effect
     sizes, never as causation.
   • Insights are gated by minimum-sample thresholds so the app
     stays honest when there isn't enough data yet.
   ============================================================ */

(function () {
  'use strict';

  const { EMOTION_BY_ID, DISTORTIONS, PRACTICES, PRACTICE_BY_ID, PILLARS } = window.AletheiaData;

  /* ---------------- basic statistics ---------------- */
  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

  function stdDev(xs) {
    if (xs.length < 2) return 0;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
  }

  // Pearson correlation coefficient.
  function pearson(xs, ys) {
    const n = Math.min(xs.length, ys.length);
    if (n < 3) return null;
    const mx = mean(xs), my = mean(ys);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
      const a = xs[i] - mx, b = ys[i] - my;
      num += a * b; dx += a * a; dy += b * b;
    }
    if (dx === 0 || dy === 0) return null;
    return num / Math.sqrt(dx * dy);
  }

  // Cohen's d (pooled) — standardized difference between two groups.
  function cohensD(a, b) {
    if (a.length < 2 || b.length < 2) return null;
    const ma = mean(a), mb = mean(b);
    const va = stdDev(a) ** 2, vb = stdDev(b) ** 2;
    const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2));
    if (pooled === 0) return null;
    return (ma - mb) / pooled;
  }

  const round = (n, p = 1) => Number(n.toFixed(p));

  /* ---------------- per-entry derived values ---------------- */
  // An entry may carry multiple emotions; aggregate to mean v/a.
  function entryEmotionIds(entry) {
    if (Array.isArray(entry.emotions) && entry.emotions.length) return entry.emotions;
    if (entry.emotion) return [entry.emotion]; // v1 backward compatibility
    return [];
  }

  function entryAffect(entry) {
    const ids = entryEmotionIds(entry);
    const coords = ids.map((id) => EMOTION_BY_ID[id]).filter(Boolean);
    if (!coords.length) return null;
    return { v: mean(coords.map((c) => c.v)), a: mean(coords.map((c) => c.a)) };
  }

  const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);

  /* ---------------- windowing ---------------- */
  function inWindow(entries, range) {
    if (range === 'all') return entries.slice();
    const cutoff = Date.now() - Number(range) * 86400000;
    return entries.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  }

  function practicesInWindow(practices, range) {
    if (range === 'all') return practices.slice();
    const cutoff = Date.now() - Number(range) * 86400000;
    return practices.filter((p) => new Date(p.date + 'T12:00:00').getTime() >= cutoff);
  }

  /* ---------------- headline metrics ---------------- */
  function headline(entries) {
    const affects = entries.map(entryAffect).filter(Boolean);
    const valences = affects.map((x) => x.v);
    const clarities = entries.map((e) => e.clarity).filter((x) => Number.isFinite(x));
    const energies = entries.map((e) => e.energy).filter((x) => Number.isFinite(x));

    // Emotional granularity: distinct emotions named in the window.
    const distinct = new Set();
    entries.forEach((e) => entryEmotionIds(e).forEach((id) => distinct.add(id)));

    // Journaling consistency: distinct days logged within the window span.
    const days = new Set(entries.map((e) => dayKey(e.createdAt)));

    return {
      count: entries.length,
      meanValence: valences.length ? round(mean(valences), 2) : null,
      meanClarity: clarities.length ? round(mean(clarities)) : null,
      meanEnergy: energies.length ? round(mean(energies)) : null,
      granularity: distinct.size,
      daysLogged: days.size,
    };
  }

  /* ---------------- circumplex points ---------------- */
  function circumplex(entries) {
    const pts = [];
    entries.forEach((e) => {
      const af = entryAffect(e);
      if (af) pts.push({ x: af.v, y: af.a, _raw: e });
    });
    const centroid = pts.length
      ? { x: round(mean(pts.map((p) => p.x)), 2), y: round(mean(pts.map((p) => p.y)), 2) }
      : null;
    return { points: pts, centroid };
  }

  /* ---------------- valence over time ---------------- */
  function valenceTrend(entries) {
    const byDay = {};
    entries.forEach((e) => {
      const af = entryAffect(e);
      if (!af) return;
      const k = dayKey(e.createdAt);
      (byDay[k] = byDay[k] || []).push(af.v);
    });
    const days = Object.keys(byDay).sort();
    return days.map((k) => ({ day: k, value: round(mean(byDay[k]), 2), n: byDay[k].length }));
  }

  /* ---------------- distortion load + trend ---------------- */
  function distortionLoad(entries) {
    const counts = {};
    let flagged = 0;
    entries.forEach((e) => {
      const ds = e.distortions || [];
      if (ds.length) flagged += 1;
      ds.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    });
    const ranked = Object.entries(counts)
      .map(([id, n]) => ({ id, label: (DISTORTIONS.find((d) => d.id === id) || {}).label || id, n }))
      .sort((a, b) => b.n - a.n);

    // Trend: distortions-per-entry, first half vs second half (chronological).
    const chrono = entries.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const half = Math.floor(chrono.length / 2);
    let trend = null;
    if (chrono.length >= 6) {
      const rate = (arr) => mean(arr.map((e) => (e.distortions || []).length));
      const first = rate(chrono.slice(0, half));
      const second = rate(chrono.slice(half));
      trend = { first: round(first, 2), second: round(second, 2), delta: round(second - first, 2) };
    }
    return { ranked, flaggedRate: entries.length ? round(flagged / entries.length, 2) : 0, trend };
  }

  /* ---------------- practice adherence ---------------- */
  function adherence(practices) {
    const totalDays = practices.length || 1;
    const perPractice = PRACTICES.map((p) => {
      const done = practices.filter((d) => d.completed && d.completed[p.id]).length;
      return { id: p.id, label: p.label, pillar: p.pillar, done, rate: round(done / totalDays, 2) };
    });
    const perPillar = Object.keys(PILLARS).map((pillar) => {
      const items = perPractice.filter((x) => x.pillar === pillar);
      const rate = items.length ? mean(items.map((x) => x.rate)) : 0;
      return { pillar, label: PILLARS[pillar].label, rate: round(rate, 2) };
    });
    return { perPractice, perPillar, totalDays: practices.length };
  }

  /* ---------------- energy vs clarity ---------------- */
  function energyClarity(entries) {
    const pairs = entries
      .filter((e) => Number.isFinite(e.energy) && Number.isFinite(e.clarity))
      .map((e) => ({ x: e.energy, y: e.clarity }));
    const r = pearson(pairs.map((p) => p.x), pairs.map((p) => p.y));
    return { pairs, r: r == null ? null : round(r, 2), n: pairs.length };
  }

  /* ---------------- weekday mood ---------------- */
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function weekdayMood(entries) {
    const buckets = WEEKDAYS.map(() => []);
    entries.forEach((e) => {
      const af = entryAffect(e);
      if (!af) return;
      buckets[new Date(e.createdAt).getDay()].push(af.v);
    });
    return WEEKDAYS.map((label, i) => ({
      label,
      value: buckets[i].length ? round(mean(buckets[i]), 2) : null,
      n: buckets[i].length,
    }));
  }

  /* ---------------- practice ↔ mood correlation (the core) ----------------
     For each practice, split the days into "done" vs "not done", then
     compare the mean valence (and clarity) of entries on those days.
     Returns effect sizes and sample sizes for honest reporting.
  ------------------------------------------------------------------- */
  function buildDayIndex(entries) {
    // day -> { valence:[], clarity:[], energy:[] }
    const idx = {};
    entries.forEach((e) => {
      const k = dayKey(e.createdAt);
      const af = entryAffect(e);
      idx[k] = idx[k] || { valence: [], clarity: [], energy: [] };
      if (af) idx[k].valence.push(af.v);
      if (Number.isFinite(e.clarity)) idx[k].clarity.push(e.clarity);
      if (Number.isFinite(e.energy)) idx[k].energy.push(e.energy);
    });
    // collapse to per-day means
    const out = {};
    Object.entries(idx).forEach(([k, v]) => {
      out[k] = {
        valence: v.valence.length ? mean(v.valence) : null,
        clarity: v.clarity.length ? mean(v.clarity) : null,
        energy: v.energy.length ? mean(v.energy) : null,
      };
    });
    return out;
  }

  function practiceMoodEffects(entries, practices) {
    const dayIdx = buildDayIndex(entries);
    const results = [];

    PRACTICES.forEach((p) => {
      const done = { valence: [], clarity: [] };
      const not = { valence: [], clarity: [] };

      practices.forEach((d) => {
        const day = dayIdx[d.date];
        if (!day) return; // no entries that day → can't measure mood
        const isDone = !!(d.completed && d.completed[p.id]);
        const target = isDone ? done : not;
        if (day.valence != null) target.valence.push(day.valence);
        if (day.clarity != null) target.clarity.push(day.clarity);
      });

      const vDiff = (done.valence.length && not.valence.length)
        ? mean(done.valence) - mean(not.valence) : null;
      const cDiff = (done.clarity.length && not.clarity.length)
        ? mean(done.clarity) - mean(not.clarity) : null;

      results.push({
        id: p.id,
        label: p.label,
        pillar: p.pillar,
        nDone: done.valence.length,
        nNot: not.valence.length,
        valenceDiff: vDiff == null ? null : round(vDiff, 2),
        clarityDiff: cDiff == null ? null : round(cDiff, 1),
        valenceD: cohensD(done.valence, not.valence),
      });
    });

    return results.filter((r) => r.valenceDiff != null || r.clarityDiff != null);
  }

  // sleep quality (continuous) vs clarity / valence across days
  function sleepEffects(entries, practices) {
    const dayIdx = buildDayIndex(entries);
    const sleep = [], clar = [], val = [];
    practices.forEach((d) => {
      if (!Number.isFinite(d.sleepQuality)) return;
      const day = dayIdx[d.date];
      if (!day) return;
      if (day.clarity != null) { sleep.push(d.sleepQuality); clar.push(day.clarity); }
      if (day.valence != null) val.push(day.valence);
    });
    return {
      n: sleep.length,
      rClarity: pearson(sleep, clar),
      rValence: pearson(sleep.slice(0, val.length), val),
    };
  }

  /* ---------------- insight generation ----------------
     Produces ranked, plain-language statements with a tone
     ('positive' | 'caution' | 'neutral') and a confidence
     label derived from effect size + sample size.
  ------------------------------------------------------ */
  function confidenceFromD(d) {
    const ad = Math.abs(d);
    if (ad >= 0.8) return 'strong';
    if (ad >= 0.5) return 'moderate';
    return 'slight';
  }

  function generateInsights(ctx) {
    const out = [];
    const { entries, practices } = ctx;

    // 1) Practice → valence effects
    const effects = practiceMoodEffects(entries, practices);
    effects.forEach((e) => {
      if (e.nDone < 4 || e.nNot < 4 || e.valenceDiff == null) return;
      if (Math.abs(e.valenceDiff) < 0.12) return;
      const d = e.valenceD;
      const conf = d != null ? confidenceFromD(d) : 'slight';
      const better = e.valenceDiff > 0;
      out.push({
        tone: better ? 'positive' : 'caution',
        icon: better ? 'trending-up' : 'trending-down',
        salience: Math.abs(e.valenceDiff) * Math.min(e.nDone, e.nNot),
        title: better
          ? `“${e.label}” lifts your mood`
          : `“${e.label}” days run lower`,
        detail: better
          ? `On days you did this, your emotional balance averaged ${fmtSigned(e.valenceDiff)} higher (${conf} association, ${e.nDone} vs ${e.nNot} days).`
          : `On days you did this, your balance averaged ${fmtSigned(e.valenceDiff)} — worth noticing the context (${e.nDone} vs ${e.nNot} days).`,
      });
    });

    // 2) Practice → clarity effects (separate, clarity scale 1–10)
    effects.forEach((e) => {
      if (e.nDone < 4 || e.nNot < 4 || e.clarityDiff == null) return;
      if (Math.abs(e.clarityDiff) < 0.8) return;
      const better = e.clarityDiff > 0;
      out.push({
        tone: better ? 'positive' : 'caution',
        icon: 'eye',
        salience: Math.abs(e.clarityDiff) * 0.4 * Math.min(e.nDone, e.nNot),
        title: `“${e.label}” and your clarity`,
        detail: `Mental clarity averaged ${fmtSigned(e.clarityDiff)} points ${better ? 'higher' : 'lower'} on days you did this (${e.nDone} vs ${e.nNot} days).`,
      });
    });

    // 3) Sleep quality → clarity
    const se = sleepEffects(entries, practices);
    if (se.n >= 6 && se.rClarity != null && Math.abs(se.rClarity) >= 0.3) {
      const pos = se.rClarity > 0;
      out.push({
        tone: pos ? 'positive' : 'caution',
        icon: 'moon',
        salience: Math.abs(se.rClarity) * se.n,
        title: 'Sleep tracks your clarity',
        detail: `Sleep quality and next-day clarity move together (r = ${round(se.rClarity, 2)}, ${se.n} days). Better-rested days tend to be clearer ones.`,
      });
    }

    // 4) Energy ↔ clarity
    const ec = energyClarity(entries);
    if (ec.n >= 6 && ec.r != null && Math.abs(ec.r) >= 0.35) {
      out.push({
        tone: 'neutral',
        icon: 'zap',
        salience: Math.abs(ec.r) * ec.n * 0.5,
        title: ec.r > 0 ? 'Clarity rises with energy' : 'Clarity and energy diverge',
        detail: ec.r > 0
          ? `Your clarity and energy are correlated (r = ${ec.r}, ${ec.n} entries) — guard your energy for work that needs a clear head.`
          : `Your clarity doesn't follow your energy (r = ${ec.r}, ${ec.n} entries) — you can think clearly even when tired.`,
      });
    }

    // 5) Distortion trend
    const dl = distortionLoad(entries);
    if (dl.trend && Math.abs(dl.trend.delta) >= 0.2) {
      const improving = dl.trend.delta < 0;
      out.push({
        tone: improving ? 'positive' : 'caution',
        icon: improving ? 'check-circle-2' : 'alert-triangle',
        salience: Math.abs(dl.trend.delta) * 8,
        title: improving ? 'Fewer thinking loops lately' : 'Thinking loops are rising',
        detail: improving
          ? `Flagged distortions per entry fell from ${dl.trend.first} to ${dl.trend.second} across this window — your thinking is catching itself more.`
          : `Flagged distortions per entry rose from ${dl.trend.first} to ${dl.trend.second}. ${dl.ranked[0] ? `“${dl.ranked[0].label}” shows up most.` : ''}`,
      });
    } else if (dl.ranked.length) {
      out.push({
        tone: 'neutral',
        icon: 'repeat',
        salience: dl.ranked[0].n,
        title: `“${dl.ranked[0].label}” is your most frequent loop`,
        detail: `It appears in ${dl.ranked[0].n} ${dl.ranked[0].n === 1 ? 'entry' : 'entries'}. Naming it as it happens is often enough to loosen it.`,
      });
    }

    // 6) Best weekday
    const wd = weekdayMood(entries).filter((d) => d.n >= 3);
    if (wd.length >= 3) {
      const best = wd.slice().sort((a, b) => b.value - a.value)[0];
      const worst = wd.slice().sort((a, b) => a.value - b.value)[0];
      if (best && worst && best.label !== worst.label && (best.value - worst.value) >= 0.25) {
        out.push({
          tone: 'neutral',
          icon: 'calendar',
          salience: (best.value - worst.value) * 6,
          title: `${best.label}s tend to feel best`,
          detail: `Your emotional balance is highest on ${best.label}s and lowest on ${worst.label}s. Worth asking what differs between them.`,
        });
      }
    }

    // 7) Emotional granularity (regulation marker)
    const hl = headline(entries);
    if (hl.count >= 8) {
      if (hl.granularity >= 12) {
        out.push({
          tone: 'positive', icon: 'palette', salience: 3,
          title: 'You name feelings precisely',
          detail: `You've used ${hl.granularity} distinct emotions. This emotional granularity is linked to steadier self-regulation.`,
        });
      } else if (hl.granularity <= 5) {
        out.push({
          tone: 'neutral', icon: 'palette', salience: 2.5,
          title: 'Try naming feelings more finely',
          detail: `You've drawn on ${hl.granularity} distinct emotions. Reaching for a more specific word can itself ease a feeling's grip.`,
        });
      }
    }

    return out.sort((a, b) => b.salience - a.salience);
  }

  function fmtSigned(n) {
    const s = Math.abs(n).toFixed(2);
    return (n >= 0 ? '+' : '−') + s;
  }

  window.AletheiaAnalysis = {
    mean, stdDev, pearson, cohensD,
    entryAffect, entryEmotionIds,
    inWindow, practicesInWindow,
    headline, circumplex, valenceTrend, distortionLoad,
    adherence, energyClarity, weekdayMood,
    practiceMoodEffects, sleepEffects, generateInsights,
    WEEKDAYS,
  };
})();
