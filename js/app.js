/* ============================================================
   Aletheia — app.js  (v2)
   Controller for five spaces: Log, Anchor, Practices, Analysis,
   History. Holds working state, wires interactions, talks to the
   DB and the analysis engine, and registers the service worker.
   ============================================================ */

(function () {
  'use strict';

  const DB = window.AletheiaDB;
  const UI = window.AletheiaUI;
  const Charts = window.AletheiaCharts;
  const AN = window.AletheiaAnalysis;
  const D = window.AletheiaData;
  const { PROMPTS, BREATHING, PHASE_LABEL, GROUNDING, PRACTICES } = D;
  const { $, $$, toast } = UI;

  /* ---------- working state ---------- */
  const draft = { emotions: new Set(), energy: 5, clarity: 5, distortions: new Set() };
  const view = {
    range: '30',
    promptIndex: Math.floor(Math.random() * PROMPTS.length),
    breathId: 'box',
    search: '', filterFamily: null, filterDistortion: null,
  };

  let entries = [];        // newest first
  let practices = [];       // all daily records
  let todayKey = isoDay(new Date());
  let todayRecord = null;

  function isoDay(d) { return d.toISOString().slice(0, 10); }
  function makeId() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ================= LOG ================= */
  function initLog() {
    UI.buildEmotionPicker($('#emotion-picker'));
    UI.buildDistortionGrid($('#distortion-grid'));
    UI.icons();

    $('#emotion-search').addEventListener('input', (e) =>
      UI.filterEmotionPicker($('#emotion-picker'), e.target.value));

    $('#emotion-picker').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-emotion]');
      if (!chip) return;
      const id = chip.dataset.emotion;
      if (draft.emotions.has(id)) { draft.emotions.delete(id); chip.classList.remove('is-active'); chip.setAttribute('aria-pressed', 'false'); }
      else { draft.emotions.add(id); chip.classList.add('is-active'); chip.setAttribute('aria-pressed', 'true'); }
      updateEmotionCount();
    });

    $('#distortion-grid').addEventListener('click', (e) => {
      const item = e.target.closest('[data-distortion]');
      if (!item) return;
      e.preventDefault();
      const id = item.dataset.distortion;
      if (draft.distortions.has(id)) { draft.distortions.delete(id); item.classList.remove('is-active'); }
      else { draft.distortions.add(id); item.classList.add('is-active'); }
      toggleReframeField();
    });

    const energy = $('#energy-slider'), clarity = $('#clarity-slider');
    energy.addEventListener('input', () => { draft.energy = +energy.value; $('#energy-value').textContent = energy.value; });
    clarity.addEventListener('input', () => { draft.clarity = +clarity.value; $('#clarity-value').textContent = clarity.value; });

    const tick = () => { $('#live-timestamp').textContent = UI.liveTimestamp(); };
    tick(); setInterval(tick, 30000);

    $('[data-action="save-thought"]').addEventListener('click', saveThought);
    $('#thought-input').addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveThought(); }
    });
  }

  function updateEmotionCount() {
    const n = draft.emotions.size;
    $('#emotion-count').textContent = n ? `${n} selected` : 'none yet';
  }
  function toggleReframeField() {
    $('#reframe-wrap').classList.toggle('hidden', draft.distortions.size === 0);
  }

  async function saveThought() {
    const text = $('#thought-input').value.trim();
    const reframe = $('#reframe-input').value.trim();
    if (!text && draft.emotions.size === 0 && draft.distortions.size === 0) {
      toast('Add a thought or pick a state before recording.', 'info'); return;
    }
    const record = {
      id: makeId(), text,
      emotions: Array.from(draft.emotions),
      energy: draft.energy, clarity: draft.clarity,
      distortions: Array.from(draft.distortions),
      reframe: draft.distortions.size ? reframe : '',
      createdAt: new Date().toISOString(),
    };
    try {
      await DB.putThought(record);
      entries.unshift(record);
      resetLog();
      toast('Recorded.', 'ok');
      refreshDerived();
    } catch (err) { console.error(err); toast('Could not save. Storage may be unavailable.', 'err'); }
  }

  function resetLog() {
    $('#thought-input').value = '';
    $('#reframe-input').value = '';
    $('#emotion-search').value = '';
    draft.emotions.clear(); draft.distortions.clear();
    draft.energy = 5; draft.clarity = 5;
    $('#energy-slider').value = 5; $('#clarity-slider').value = 5;
    $('#energy-value').textContent = '5'; $('#clarity-value').textContent = '5';
    $$('#emotion-picker .emo-chip').forEach((c) => { c.classList.remove('is-active'); c.setAttribute('aria-pressed', 'false'); });
    $$('#distortion-grid .distortion-item').forEach((i) => i.classList.remove('is-active'));
    UI.filterEmotionPicker($('#emotion-picker'), '');
    updateEmotionCount(); toggleReframeField();
  }

  /* ================= ANCHOR ================= */
  let breathing = false, cueTimer = null, phaseTimers = [];
  function initAnchor() {
    // breathing pattern selector
    const sel = $('#breath-patterns');
    sel.innerHTML = '';
    BREATHING.forEach((b) => {
      sel.appendChild(UI.el('button', {
        type: 'button', class: 'range-btn' + (b.id === view.breathId ? ' is-active' : ''),
        'data-breath': b.id, title: b.note,
      }, [b.label]));
    });
    sel.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-breath]'); if (!btn) return;
      view.breathId = btn.dataset.breath;
      $$('#breath-patterns .range-btn').forEach((x) => x.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (breathing) { stopBreath(); startBreath(); }
      $('#breath-note').textContent = (BREATHING.find((b) => b.id === view.breathId) || {}).note || '';
    });
    $('#breath-note').textContent = (BREATHING.find((b) => b.id === view.breathId) || {}).note || '';

    $('#breath-toggle').addEventListener('click', () => breathing ? stopBreath() : startBreath());

    // prompts
    renderPrompt();
    $('[data-action="next-prompt"]').addEventListener('click', () => {
      let n; do { n = Math.floor(Math.random() * PROMPTS.length); } while (n === view.promptIndex && PROMPTS.length > 1);
      view.promptIndex = n; renderPrompt();
    });
    $('[data-action="prompt-to-log"]').addEventListener('click', () => {
      const p = PROMPTS[view.promptIndex];
      switchTab('log');
      const ta = $('#thought-input');
      const prefix = ta.value.trim() ? ta.value.trim() + '\n\n' : '';
      ta.value = `${prefix}On "${p.text}"\n`;
      ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
      toast('Prompt carried to the log.', 'info');
    });

    // grounding
    buildGrounding();
  }

  function startBreath() {
    const pattern = BREATHING.find((b) => b.id === view.breathId);
    if (!pattern) return;
    breathing = true;
    const stage = $('.breath-stage');
    const total = pattern.phases.reduce((s, p) => s + p.s, 0);
    stage.style.setProperty('--breath-total', total + 's');
    // build keyframe-driven animation via class + inline durations
    stage.classList.add('is-breathing');
    applyBreathAnimation(pattern, total);

    const toggle = $('#breath-toggle');
    setButtonIcon(toggle, 'pause', 'Pause');
    UI.icons();

    // cue text scheduling
    const cue = $('#breath-cue');
    const schedule = () => {
      let acc = 0;
      pattern.phases.forEach((ph) => {
        const at = acc * 1000;
        phaseTimers.push(setTimeout(() => { if (breathing) cue.textContent = PHASE_LABEL[ph.k]; }, at));
        acc += ph.s;
      });
    };
    cue.textContent = PHASE_LABEL[pattern.phases[0].k];
    schedule();
    cueTimer = setInterval(schedule, total * 1000);
  }

  function applyBreathAnimation(pattern, total) {
    // Generate a @keyframes-like scale timeline by setting CSS custom props
    // the stylesheet reads. We compute scale stops as percentages.
    const core = $('#breath-core');
    const rings = $$('.breath-ring');
    // Build a keyframes string dynamically and inject once per pattern.
    let frames = '';
    let acc = 0;
    const scaleFor = (k) => (k === 'in' ? 1.18 : k === 'out' ? 0.78 : null);
    let last = 0.78;
    pattern.phases.forEach((ph, i) => {
      const startPct = (acc / total) * 100;
      const target = scaleFor(ph.k);
      if (i === 0) frames += `${startPct.toFixed(2)}% { transform: scale(${last}); }\n`;
      acc += ph.s;
      const endPct = (acc / total) * 100;
      if (ph.k === 'in') { last = 1.18; }
      else if (ph.k === 'out') { last = 0.78; }
      frames += `${endPct.toFixed(2)}% { transform: scale(${last}); }\n`;
    });
    const css = `@keyframes aletheiaBreath {\n${frames}}`;
    let styleTag = document.getElementById('breath-keyframes');
    if (!styleTag) { styleTag = document.createElement('style'); styleTag.id = 'breath-keyframes'; document.head.appendChild(styleTag); }
    styleTag.textContent = css;
    core.style.animation = `aletheiaBreath ${total}s ease-in-out infinite`;
    rings.forEach((r, idx) => { r.style.animation = `aletheiaBreath ${total}s ease-in-out infinite`; r.style.animationDelay = `${idx * 0.18}s`; });
  }

  function stopBreath() {
    breathing = false;
    $('.breath-stage').classList.remove('is-breathing');
    const core = $('#breath-core'); core.style.animation = '';
    $$('.breath-ring').forEach((r) => { r.style.animation = ''; });
    clearInterval(cueTimer); phaseTimers.forEach(clearTimeout); phaseTimers = [];
    $('#breath-cue').textContent = 'Begin';
    const toggle = $('#breath-toggle');
    setButtonIcon(toggle, 'play', 'Begin');
    UI.icons();
  }

  // Replaces a button's leading icon + label robustly, whether the icon
  // is still an <i data-lucide> or has already been swapped to <svg> by lucide.
  function setButtonIcon(button, iconName, label) {
    const existing = button.querySelector('i, svg');
    const i = document.createElement('i');
    i.setAttribute('data-lucide', iconName);
    i.className = 'w-4 h-4';
    if (existing) existing.replaceWith(i); else button.prepend(i);
    const span = button.querySelector('span');
    if (span) span.textContent = label;
  }

  function renderPrompt() {
    const p = PROMPTS[view.promptIndex];
    const t = $('#prompt-text'), s = $('#prompt-school');
    t.style.opacity = '0'; t.style.transition = 'opacity 0.25s ease';
    setTimeout(() => { t.textContent = `\u201c${p.text}\u201d`; s.textContent = p.school; t.style.opacity = '1'; }, 120);
  }

  function buildGrounding() {
    const host = $('#grounding-steps');
    host.innerHTML = '';
    GROUNDING.forEach((g) => {
      host.appendChild(UI.el('div', { class: 'ground-step' }, [
        UI.el('div', { class: 'ground-n', text: String(g.count) }),
        UI.el('div', {}, [
          UI.el('div', { class: 'ground-sense', text: g.sense.toUpperCase() }),
          UI.el('p', { class: 'ground-prompt', text: g.prompt }),
        ]),
      ]));
    });
  }

  /* ================= PRACTICES ================= */
  function initPractices() {
    UI.buildPractices($('#practices-grid'));
    $('#practice-date').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    $('#practices-grid').addEventListener('click', (e) => {
      const item = e.target.closest('[data-practice]'); if (!item) return;
      const id = item.dataset.practice;
      ensureToday();
      todayRecord.completed[id] = !todayRecord.completed[id];
      item.classList.toggle('is-active', todayRecord.completed[id]);
      item.setAttribute('aria-pressed', todayRecord.completed[id] ? 'true' : 'false');
      saveToday();
    });

    const sleep = $('#sleep-slider');
    sleep.addEventListener('input', () => {
      $('#sleep-value').textContent = sleep.value;
      ensureToday(); todayRecord.sleepQuality = +sleep.value; saveToday();
    });

    updatePracticeSummary();
  }

  function ensureToday() {
    if (!todayRecord) {
      todayRecord = { date: todayKey, completed: {}, sleepQuality: null, createdAt: new Date().toISOString() };
    }
  }

  let saveTimer = null;
  function saveToday() {
    ensureToday();
    todayRecord.updatedAt = new Date().toISOString();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await DB.putPractice(todayRecord);
        const i = practices.findIndex((p) => p.date === todayKey);
        if (i >= 0) practices[i] = todayRecord; else practices.push(todayRecord);
        updatePracticeSummary();
      } catch (err) { console.error(err); toast('Could not save your check-in.', 'err'); }
    }, 250);
  }

  function loadToday() {
    const rec = practices.find((p) => p.date === todayKey);
    if (rec) {
      todayRecord = rec;
      Object.keys(rec.completed || {}).forEach((id) => {
        const item = $(`#practices-grid [data-practice="${id}"]`);
        if (item && rec.completed[id]) { item.classList.add('is-active'); item.setAttribute('aria-pressed', 'true'); }
      });
      if (Number.isFinite(rec.sleepQuality)) { $('#sleep-slider').value = rec.sleepQuality; $('#sleep-value').textContent = rec.sleepQuality; }
    }
  }

  function updatePracticeSummary() {
    // streak: consecutive days (ending today or yesterday) with any completion
    const done = new Set(practices.filter((p) => p.completed && Object.values(p.completed).some(Boolean)).map((p) => p.date));
    let streak = 0;
    const d = new Date();
    // allow today to be incomplete without breaking streak
    if (!done.has(isoDay(d))) d.setDate(d.getDate() - 1);
    while (done.has(isoDay(d))) { streak++; d.setDate(d.getDate() - 1); }
    $('#practice-streak').textContent = streak;

    const todayCount = todayRecord ? Object.values(todayRecord.completed || {}).filter(Boolean).length : 0;
    $('#practice-today-count').textContent = `${todayCount} / ${PRACTICES.length}`;
  }

  /* ================= ANALYSIS ================= */
  function initAnalysis() {
    $('#analysis-range').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-range]'); if (!btn) return;
      view.range = btn.dataset.range;
      $$('#analysis-range .range-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderAnalysis();
    });
  }

  function renderAnalysis() {
    const winEntries = AN.inWindow(entries, view.range);
    const winPractices = AN.practicesInWindow(practices, view.range);

    const hasData = winEntries.length > 0;
    $('#analysis-empty').classList.toggle('hidden', hasData);
    $('#analysis-body').classList.toggle('hidden', !hasData);
    if (!hasData) { Charts.destroyAll(); return; }

    // headline + insights
    const hl = AN.headline(winEntries);
    UI.renderStatCards($('#stat-cards'), hl);

    const insights = AN.generateInsights({ entries: winEntries, practices: winPractices });
    UI.renderInsights($('#insight-list'), $('#insight-empty'), insights);

    // charts
    Charts.circumplex($('#chart-circumplex'), AN.circumplex(winEntries));
    Charts.valenceTrend($('#chart-valence'), AN.valenceTrend(winEntries));
    Charts.distortions($('#chart-distortions'), AN.distortionLoad(winEntries).ranked);
    Charts.weekday($('#chart-weekday'), AN.weekdayMood(winEntries));

    // practices section
    const adh = AN.adherence(winPractices);
    const hasPractices = winPractices.length > 0;
    $('#practices-analysis').classList.toggle('hidden', !hasPractices);
    $('#practices-analysis-empty').classList.toggle('hidden', hasPractices);
    if (hasPractices) {
      UI.renderPillarBalance($('#pillar-balance'), adh.perPillar);
      Charts.adherence($('#chart-adherence'), adh.perPractice);
      Charts.moodLift($('#chart-lift'), AN.practiceMoodEffects(winEntries, winPractices));
    }
  }

  /* ================= HISTORY ================= */
  function initHistory() {
    UI.buildHistoryFilters($('#filter-emotions'), $('#filter-distortions'));
    $('#history-search').addEventListener('input', (e) => { view.search = e.target.value.toLowerCase().trim(); renderHistory(); });

    $('#filter-emotions').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter-family]'); if (!chip) return;
      const id = chip.dataset.filterFamily;
      view.filterFamily = view.filterFamily === id ? null : id;
      $$('#filter-emotions .chip-filter').forEach((c) => c.classList.remove('is-active'));
      if (view.filterFamily) chip.classList.add('is-active');
      renderHistory();
    });
    $('#filter-distortions').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter-distortion]'); if (!chip) return;
      const id = chip.dataset.filterDistortion;
      view.filterDistortion = view.filterDistortion === id ? null : id;
      $$('#filter-distortions .chip-filter').forEach((c) => c.classList.remove('is-active'));
      if (view.filterDistortion) chip.classList.add('is-active');
      renderHistory();
    });

    $('#history-feed').addEventListener('click', async (e) => {
      const del = e.target.closest('[data-delete]'); if (!del) return;
      try {
        await DB.removeThought(del.dataset.delete);
        entries = entries.filter((x) => x.id !== del.dataset.delete);
        toast('Entry deleted.', 'ok'); refreshDerived();
      } catch (err) { console.error(err); toast('Could not delete that entry.', 'err'); }
    });
  }

  function emotionFamilyOf(entry) {
    const ids = (Array.isArray(entry.emotions) && entry.emotions.length) ? entry.emotions : (entry.emotion ? [entry.emotion] : []);
    return ids.map((id) => (D.EMOTION_BY_ID[id] || {}).family).filter(Boolean);
  }
  function filtered() {
    return entries.filter((e) => {
      if (view.filterFamily && !emotionFamilyOf(e).includes(view.filterFamily)) return false;
      if (view.filterDistortion && !(e.distortions || []).includes(view.filterDistortion)) return false;
      if (view.search && !(e.text || '').toLowerCase().includes(view.search)) return false;
      return true;
    });
  }
  function renderHistory() { UI.renderHistory($('#history-feed'), $('#history-empty'), filtered()); }

  /* ================= EXPORT / IMPORT ================= */
  function initBackup() {
    $('[data-action="export"]').addEventListener('click', exportData);
    $('[data-action="import"]').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', importData);
  }
  function exportData() {
    if (!entries.length && !practices.length) { toast('Nothing to export yet.', 'info'); return; }
    const payload = {
      app: 'aletheia', version: DB.DB_VERSION, exportedAt: new Date().toISOString(),
      counts: { thoughts: entries.length, practices: practices.length },
      thoughts: entries, practices,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `aletheia-backup-${isoDay(new Date())}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast(`Exported ${entries.length} entries.`, 'ok');
  }
  function importData(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incomingThoughts = Array.isArray(parsed) ? parsed : parsed.thoughts;
        const incomingPractices = (parsed && parsed.practices) || [];
        if (!Array.isArray(incomingThoughts)) throw new Error('Unrecognised file.');

        const cleanThoughts = incomingThoughts.filter((r) => r && typeof r === 'object').map((r) => ({
          id: r.id || makeId(),
          text: typeof r.text === 'string' ? r.text : '',
          emotions: Array.isArray(r.emotions) ? r.emotions : (r.emotion ? [r.emotion] : []),
          energy: clampScale(r.energy), clarity: clampScale(r.clarity),
          distortions: Array.isArray(r.distortions) ? r.distortions : [],
          reframe: typeof r.reframe === 'string' ? r.reframe : '',
          createdAt: isValidDate(r.createdAt) ? r.createdAt : new Date().toISOString(),
        }));

        const cleanPractices = (incomingPractices || []).filter((r) => r && r.date).map((r) => ({
          date: r.date,
          completed: (r.completed && typeof r.completed === 'object') ? r.completed : {},
          sleepQuality: Number.isFinite(r.sleepQuality) ? r.sleepQuality : null,
          createdAt: r.createdAt || new Date().toISOString(),
          updatedAt: r.updatedAt || new Date().toISOString(),
        }));

        // merge by id / date
        const tById = new Map(entries.map((x) => [x.id, x]));
        cleanThoughts.forEach((r) => tById.set(r.id, r));
        const mergedThoughts = Array.from(tById.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const pByDate = new Map(practices.map((x) => [x.date, x]));
        cleanPractices.forEach((r) => pByDate.set(r.date, r));
        const mergedPractices = Array.from(pByDate.values());

        await DB.replaceAll(mergedThoughts, mergedPractices);
        entries = mergedThoughts; practices = mergedPractices;
        todayRecord = practices.find((p) => p.date === todayKey) || null;
        toast(`Imported ${cleanThoughts.length} entries.`, 'ok');
        refreshDerived(); updatePracticeSummary();
      } catch (err) { console.error(err); toast('Import failed — is this an Aletheia backup?', 'err'); }
      finally { e.target.value = ''; }
    };
    reader.onerror = () => toast('Could not read that file.', 'err');
    reader.readAsText(file);
  }
  function clampScale(n) { const v = Number(n); return Number.isFinite(v) ? Math.min(10, Math.max(1, Math.round(v))) : 5; }
  function isValidDate(s) { return typeof s === 'string' && !Number.isNaN(new Date(s).getTime()); }

  /* ================= TABS ================= */
  function initTabs() {
    $$('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  }
  function switchTab(name) {
    if (name !== 'anchor' && breathing) stopBreath();
    $$('.tab-btn').forEach((b) => {
      const active = b.dataset.tab === name;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.panel').forEach((p) => p.classList.add('hidden'));
    const panel = $(`#panel-${name}`);
    panel.classList.remove('hidden');
    panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
    if (name === 'analysis') renderAnalysis();
    if (name === 'history') renderHistory();
  }
  window.switchTab = switchTab;

  function refreshDerived() {
    const active = $('.tab-btn.is-active')?.dataset.tab;
    if (active === 'analysis') renderAnalysis();
    if (active === 'history') renderHistory();
  }

  /* ================= BOOT ================= */
  async function boot() {
    initTabs(); initLog(); initAnchor(); initPractices(); initAnalysis(); initHistory(); initBackup();
    try {
      await DB.open();
      entries = await DB.getAllThoughts();
      practices = await DB.getAllPractices();
      todayRecord = practices.find((p) => p.date === todayKey) || null;
      loadToday(); updatePracticeSummary();
    } catch (err) { console.error(err); toast('Local storage is unavailable — entries will not persist.', 'err'); }
    UI.icons();
    registerSW();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') { console.info('Aletheia: serve over http/https to enable offline install.'); return; }
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch((e) => console.warn('SW registration failed:', e)));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
