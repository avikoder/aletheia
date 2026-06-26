/* ============================================================
   Aletheia — app.js
   The controller. Holds the working state of the log form,
   wires every interaction, talks to the DB, and keeps the
   four panels in sync. Registers the service worker last.
   ============================================================ */

(function () {
  'use strict';

  const DB = window.AletheiaDB;
  const UI = window.AletheiaUI;
  const Charts = window.AletheiaCharts;
  const { PROMPTS, EMOTION_BY_ID, DISTORTION_BY_ID } = window.AletheiaData;
  const { $, $$, toast } = UI;

  /* ---------------- working state ---------------- */
  const draft = {
    emotion: null,
    energy: 5,
    clarity: 5,
    distortions: new Set(),
  };

  const view = {
    range: '7',
    promptIndex: Math.floor(Math.random() * PROMPTS.length),
    search: '',
    filterEmotion: null,
    filterDistortion: null,
  };

  /** @type {object[]} cached entries, newest first */
  let entries = [];

  /* ---------------- id helper ---------------- */
  function makeId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  }

  /* ================================================
     LOG: build form, capture, reset
     ================================================ */
  function initLogForm() {
    UI.buildEmotionGrid($('#emotion-grid'));
    UI.buildDistortionGrid($('#distortion-grid'));
    UI.icons();

    // Emotion selection (single-select, toggleable)
    $('#emotion-grid').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-emotion]');
      if (!btn) return;
      const id = btn.dataset.emotion;
      const already = draft.emotion === id;

      $$('#emotion-grid .emotion-btn').forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });

      if (already) {
        draft.emotion = null;
      } else {
        draft.emotion = id;
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
      }
    });

    // Distortion checkboxes (multi-select)
    $('#distortion-grid').addEventListener('click', (e) => {
      const item = e.target.closest('[data-distortion]');
      if (!item) return;
      e.preventDefault();
      const id = item.dataset.distortion;
      if (draft.distortions.has(id)) {
        draft.distortions.delete(id);
        item.classList.remove('is-active');
      } else {
        draft.distortions.add(id);
        item.classList.add('is-active');
      }
    });

    // Sliders
    const energy = $('#energy-slider');
    const clarity = $('#clarity-slider');
    energy.addEventListener('input', () => {
      draft.energy = Number(energy.value);
      $('#energy-value').textContent = energy.value;
    });
    clarity.addEventListener('input', () => {
      draft.clarity = Number(clarity.value);
      $('#clarity-value').textContent = clarity.value;
    });

    // Live timestamp, refreshed each minute
    const tick = () => { $('#live-timestamp').textContent = UI.liveTimestamp(); };
    tick();
    setInterval(tick, 30000);

    // Save
    $('[data-action="save-thought"]').addEventListener('click', saveThought);

    // Ctrl/Cmd + Enter to record from the textarea
    $('#thought-input').addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveThought();
      }
    });
  }

  async function saveThought() {
    const text = $('#thought-input').value.trim();

    if (!text && !draft.emotion && draft.distortions.size === 0) {
      toast('Add a thought or pick a state before recording.', 'info');
      return;
    }

    const record = {
      id: makeId(),
      text,
      emotion: draft.emotion,
      energy: draft.energy,
      clarity: draft.clarity,
      distortions: Array.from(draft.distortions),
      createdAt: new Date().toISOString(),
    };

    try {
      await DB.put(record);
      entries.unshift(record);
      resetForm();
      toast('Recorded.', 'ok');
      refreshDerivedViews();
    } catch (err) {
      console.error(err);
      toast('Could not save. Storage may be unavailable.', 'err');
    }
  }

  function resetForm() {
    $('#thought-input').value = '';
    draft.emotion = null;
    draft.energy = 5;
    draft.clarity = 5;
    draft.distortions.clear();

    $('#energy-slider').value = 5;
    $('#clarity-slider').value = 5;
    $('#energy-value').textContent = '5';
    $('#clarity-value').textContent = '5';

    $$('#emotion-grid .emotion-btn').forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-pressed', 'false');
    });
    $$('#distortion-grid .distortion-item').forEach((i) => i.classList.remove('is-active'));
  }

  /* ================================================
     ANCHOR: breathing + prompts
     ================================================ */
  function initAnchor() {
    const stage = $('.breath-stage');
    const toggle = $('#breath-toggle');
    const cue = $('#breath-cue');
    let breathing = false;
    let cueTimer = null;

    // Cue text follows the 16s cycle: 4s each phase.
    const phases = [
      { label: 'Breathe in', at: 0 },
      { label: 'Hold', at: 4000 },
      { label: 'Breathe out', at: 8000 },
      { label: 'Hold', at: 12000 },
    ];

    function startCues() {
      const cycle = () => {
        phases.forEach((p) => {
          setTimeout(() => { if (breathing) cue.textContent = p.label; }, p.at);
        });
      };
      cue.textContent = 'Breathe in';
      cycle();
      cueTimer = setInterval(cycle, 16000);
    }

    function stopCues() {
      clearInterval(cueTimer);
      cue.textContent = 'Begin';
    }

    toggle.addEventListener('click', () => {
      breathing = !breathing;
      stage.classList.toggle('is-breathing', breathing);
      const icon = toggle.querySelector('i');
      const label = toggle.querySelector('span');
      if (breathing) {
        icon.setAttribute('data-lucide', 'pause');
        label.textContent = 'Pause';
        startCues();
      } else {
        icon.setAttribute('data-lucide', 'play');
        label.textContent = 'Begin';
        stopCues();
      }
      UI.icons();
    });

    // Prompts
    renderPrompt();
    $('[data-action="next-prompt"]').addEventListener('click', () => {
      let next;
      do { next = Math.floor(Math.random() * PROMPTS.length); }
      while (next === view.promptIndex && PROMPTS.length > 1);
      view.promptIndex = next;
      renderPrompt();
    });

    // Carry prompt into the log textarea
    $('[data-action="prompt-to-log"]').addEventListener('click', () => {
      const p = PROMPTS[view.promptIndex];
      switchTab('log');
      const ta = $('#thought-input');
      const prefix = ta.value.trim() ? ta.value.trim() + '\n\n' : '';
      ta.value = `${prefix}On "${p.text}"\n`;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      toast('Prompt carried to the log.', 'info');
    });
  }

  function renderPrompt() {
    const p = PROMPTS[view.promptIndex];
    const textEl = $('#prompt-text');
    const schoolEl = $('#prompt-school');
    // brief fade
    textEl.style.opacity = '0';
    textEl.style.transition = 'opacity 0.25s ease';
    setTimeout(() => {
      textEl.textContent = `“${p.text}”`;
      schoolEl.textContent = p.school;
      textEl.style.opacity = '1';
    }, 120);
  }

  /* ================================================
     PATTERNS: stats + charts
     ================================================ */
  function initPatterns() {
    $('#patterns-range').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-range]');
      if (!btn) return;
      view.range = btn.dataset.range;
      $$('#patterns-range .range-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      renderPatterns();
    });
  }

  function entriesInRange() {
    if (view.range === 'all') return entries.slice();
    const days = Number(view.range);
    const cutoff = Date.now() - days * 86400000;
    return entries.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  }

  function computeStats(list) {
    const total = list.length;

    // top emotion
    const emoCount = {};
    list.forEach((e) => { if (e.emotion) emoCount[e.emotion] = (emoCount[e.emotion] || 0) + 1; });
    const topEmotion = Object.entries(emoCount).sort((a, b) => b[1] - a[1])[0];

    // top loop
    const loopCount = {};
    list.forEach((e) => (e.distortions || []).forEach((id) => { loopCount[id] = (loopCount[id] || 0) + 1; }));
    const topLoop = Object.entries(loopCount).sort((a, b) => b[1] - a[1])[0];

    // average clarity
    const avgClarity = total
      ? (list.reduce((s, e) => s + (e.clarity || 0), 0) / total).toFixed(1)
      : '—';

    return {
      total,
      topEmotionLabel: topEmotion ? (EMOTION_BY_ID[topEmotion[0]]?.label || '—') : '—',
      topLoopLabel: topLoop ? (DISTORTION_BY_ID[topLoop[0]]?.label || '—') : '—',
      avgClarity,
    };
  }

  function renderPatterns() {
    const list = entriesInRange();
    const empty = $('#patterns-empty');
    const grid = $('#chart-distortions').closest('.grid');
    const cards = $('#stat-cards');

    if (!list.length) {
      empty.classList.remove('hidden');
      grid.classList.add('hidden');
      cards.classList.add('hidden');
      Charts.destroy();
      return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');
    cards.classList.remove('hidden');

    UI.renderStatCards(cards, computeStats(list));
    // Chronological order for the time chart
    const chrono = list.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    Charts.renderDistortions($('#chart-distortions'), chrono, view.range);
    Charts.renderCorrelation($('#chart-correlation'), list);
  }

  /* ================================================
     HISTORY: search + filter + feed
     ================================================ */
  function initHistory() {
    UI.buildFilterChips($('#filter-emotions'), $('#filter-distortions'));

    $('#history-search').addEventListener('input', (e) => {
      view.search = e.target.value.toLowerCase().trim();
      renderHistory();
    });

    $('#filter-emotions').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter-emotion]');
      if (!chip) return;
      const id = chip.dataset.filterEmotion;
      view.filterEmotion = view.filterEmotion === id ? null : id;
      $$('#filter-emotions .chip-filter').forEach((c) => c.classList.remove('is-active'));
      if (view.filterEmotion) chip.classList.add('is-active');
      renderHistory();
    });

    $('#filter-distortions').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter-distortion]');
      if (!chip) return;
      const id = chip.dataset.filterDistortion;
      view.filterDistortion = view.filterDistortion === id ? null : id;
      $$('#filter-distortions .chip-filter').forEach((c) => c.classList.remove('is-active'));
      if (view.filterDistortion) chip.classList.add('is-active');
      renderHistory();
    });

    // Delete (event-delegated on the feed)
    $('#history-feed').addEventListener('click', async (e) => {
      const del = e.target.closest('[data-delete]');
      if (!del) return;
      const id = del.dataset.delete;
      try {
        await DB.remove(id);
        entries = entries.filter((x) => x.id !== id);
        toast('Entry deleted.', 'ok');
        refreshDerivedViews();
      } catch (err) {
        console.error(err);
        toast('Could not delete that entry.', 'err');
      }
    });
  }

  function filteredEntries() {
    return entries.filter((e) => {
      if (view.filterEmotion && e.emotion !== view.filterEmotion) return false;
      if (view.filterDistortion && !(e.distortions || []).includes(view.filterDistortion)) return false;
      if (view.search && !(e.text || '').toLowerCase().includes(view.search)) return false;
      return true;
    });
  }

  function renderHistory() {
    UI.renderHistory($('#history-feed'), $('#history-empty'), filteredEntries());
  }

  /* ================================================
     EXPORT / IMPORT
     ================================================ */
  function initBackup() {
    $('[data-action="export"]').addEventListener('click', exportData);
    $('[data-action="import"]').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', importData);
  }

  function exportData() {
    if (!entries.length) {
      toast('Nothing to export yet.', 'info');
      return;
    }
    const payload = {
      app: 'aletheia',
      version: DB.DB_VERSION,
      exportedAt: new Date().toISOString(),
      count: entries.length,
      thoughts: entries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `aletheia-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${entries.length} entries.`, 'ok');
  }

  function importData(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = Array.isArray(parsed) ? parsed : parsed.thoughts;
        if (!Array.isArray(incoming)) throw new Error('Unrecognised file shape.');

        // Validate + normalise each record; skip anything unusable.
        const clean = incoming
          .filter((r) => r && typeof r === 'object')
          .map((r) => ({
            id: r.id || makeId(),
            text: typeof r.text === 'string' ? r.text : '',
            emotion: r.emotion || null,
            energy: clampScale(r.energy),
            clarity: clampScale(r.clarity),
            distortions: Array.isArray(r.distortions) ? r.distortions : [],
            createdAt: isValidDate(r.createdAt) ? r.createdAt : new Date().toISOString(),
          }));

        if (!clean.length) throw new Error('No valid entries found.');

        // Merge: keep existing, add/overwrite by id.
        const byId = new Map(entries.map((x) => [x.id, x]));
        clean.forEach((r) => byId.set(r.id, r));
        const merged = Array.from(byId.values()).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        await DB.replaceAll(merged);
        entries = merged;
        toast(`Imported ${clean.length} entries.`, 'ok');
        refreshDerivedViews();
      } catch (err) {
        console.error(err);
        toast('Import failed — is this an Aletheia backup?', 'err');
      } finally {
        e.target.value = ''; // allow re-importing the same file
      }
    };
    reader.onerror = () => toast('Could not read that file.', 'err');
    reader.readAsText(file);
  }

  function clampScale(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 5;
    return Math.min(10, Math.max(1, Math.round(v)));
  }
  function isValidDate(s) {
    return typeof s === 'string' && !Number.isNaN(new Date(s).getTime());
  }

  /* ================================================
     TABS
     ================================================ */
  function initTabs() {
    $$('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(name) {
    $$('.tab-btn').forEach((b) => {
      const active = b.dataset.tab === name;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.panel').forEach((p) => p.classList.add('hidden'));
    const panel = $(`#panel-${name}`);
    panel.classList.remove('hidden');
    // Re-trigger entry animation
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = '';

    if (name === 'patterns') renderPatterns();
    if (name === 'history') renderHistory();
  }

  /* ================================================
     Shared refresh after any data mutation
     ================================================ */
  function refreshDerivedViews() {
    const activeTab = $('.tab-btn.is-active')?.dataset.tab;
    if (activeTab === 'patterns') renderPatterns();
    if (activeTab === 'history') renderHistory();
  }

  /* ================================================
     BOOT
     ================================================ */
  async function boot() {
    initTabs();
    initLogForm();
    initAnchor();
    initPatterns();
    initHistory();
    initBackup();

    try {
      await DB.open();
      entries = await DB.getAll();
    } catch (err) {
      console.error(err);
      toast('Local storage is unavailable — entries will not persist.', 'err');
      entries = [];
    }

    UI.icons();
    registerServiceWorker();
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Only register when served over http/https (not file://).
    if (location.protocol === 'file:') {
      console.info('Aletheia: open via a local server to enable offline install.');
      return;
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('service-worker.js')
        .catch((err) => console.warn('Service worker registration failed:', err));
    });
  }

  // Expose switchTab for the prompt-carry action
  window.switchTab = switchTab;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
