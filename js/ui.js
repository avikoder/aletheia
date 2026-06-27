/* ============================================================
   Aletheia — ui.js  (v2)
   View helpers: DOM building, the family-grouped emotion picker,
   distortion list, practices grid, history feed, analysis stat
   cards and insight cards, and toasts.
   ============================================================ */

(function () {
  'use strict';

  const D = window.AletheiaData;
  const {
    EMOTION_FAMILIES, EMOTIONS_BY_FAMILY, EMOTION_BY_ID,
    DISTORTIONS, DISTORTION_BY_ID,
    PILLARS, PRACTICES,
  } = D;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v == null) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function icons() {
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  }

  /* ---------- formatting ---------- */
  function formatDateTime(iso) {
    const d = new Date(iso);
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  function relativeTime(iso) {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d ago`;
    return formatDateTime(iso).split(' · ')[0];
  }
  function liveTimestamp() {
    return new Date().toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  /* ---------- emotion picker (grouped by family, searchable) ---------- */
  function buildEmotionPicker(container) {
    container.innerHTML = '';
    Object.keys(EMOTION_FAMILIES).forEach((famId) => {
      const fam = EMOTION_FAMILIES[famId];
      const list = EMOTIONS_BY_FAMILY[famId] || [];
      const group = el('div', { class: 'emo-family', 'data-family': famId }, [
        el('div', { class: 'emo-family-head' }, [
          el('span', { class: 'emo-family-dot', style: `background:${fam.color}` }),
          el('span', { class: 'emo-family-name', text: fam.label }),
        ]),
        el('div', { class: 'emo-chips' },
          list.map((e) => el('button', {
            type: 'button', class: 'emo-chip', 'data-emotion': e.id,
            style: `--ec:${fam.color}`, 'aria-pressed': 'false', title: e.label,
          }, [e.label]))
        ),
      ]);
      container.appendChild(group);
    });
  }

  function filterEmotionPicker(container, query) {
    const q = query.toLowerCase().trim();
    $$('.emo-family', container).forEach((group) => {
      let visible = 0;
      $$('.emo-chip', group).forEach((chip) => {
        const match = !q || chip.textContent.toLowerCase().includes(q);
        chip.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      group.style.display = visible ? '' : 'none';
    });
  }

  /* ---------- distortions ---------- */
  function buildDistortionGrid(container) {
    container.innerHTML = '';
    DISTORTIONS.forEach((d) => {
      container.appendChild(
        el('label', { class: 'distortion-item', 'data-distortion': d.id, title: d.reframe }, [
          el('span', { class: 'distortion-box' }, [el('i', { 'data-lucide': 'check' })]),
          el('span', {}, [
            el('span', { class: 'distortion-name', text: d.label, style: 'display:block' }),
            el('span', { class: 'distortion-desc', text: d.desc }),
          ]),
        ])
      );
    });
    icons();
  }

  /* ---------- practices ---------- */
  function buildPractices(container) {
    container.innerHTML = '';
    Object.keys(PILLARS).forEach((pillarId) => {
      const pillar = PILLARS[pillarId];
      const items = PRACTICES.filter((p) => p.pillar === pillarId);
      const block = el('div', { class: 'practice-pillar' }, [
        el('div', { class: 'practice-pillar-head' }, [
          el('span', { class: 'pillar-bar', style: `background:${pillar.color}` }),
          el('span', { class: 'pillar-name', text: pillar.label }),
        ]),
        el('div', { class: 'practice-list' },
          items.map((p) => el('button', {
            type: 'button', class: 'practice-item', 'data-practice': p.id,
            style: `--pc:${pillar.color}`, 'aria-pressed': 'false',
          }, [
            el('span', { class: 'practice-check' }, [el('i', { 'data-lucide': 'check' })]),
            el('i', { 'data-lucide': p.icon, class: 'practice-icon' }),
            el('span', { class: 'practice-label', text: p.label }),
          ]))
        ),
      ]);
      container.appendChild(block);
    });
    icons();
  }

  /* ---------- history filters ---------- */
  function buildHistoryFilters(emotionHost, distortionHost) {
    emotionHost.innerHTML = '';
    Object.keys(EMOTION_FAMILIES).forEach((famId) => {
      const fam = EMOTION_FAMILIES[famId];
      emotionHost.appendChild(el('button', {
        type: 'button', class: 'chip chip-filter', 'data-filter-family': famId, style: `--fc:${fam.color}`,
      }, [el('span', { class: 'chip-dot', style: `background:${fam.color}` }), fam.label]));
    });
    distortionHost.innerHTML = '';
    DISTORTIONS.forEach((d) => {
      distortionHost.appendChild(el('button', {
        type: 'button', class: 'chip chip-filter', 'data-filter-distortion': d.id, style: '--fc:#818cf8',
      }, [d.label]));
    });
  }

  /* ---------- history feed ---------- */
  function renderHistory(host, empty, entries) {
    host.innerHTML = '';
    if (!entries.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');

    entries.forEach((entry, i) => {
      const ids = (Array.isArray(entry.emotions) && entry.emotions.length)
        ? entry.emotions : (entry.emotion ? [entry.emotion] : []);
      const emoChips = ids.map((id) => {
        const e = EMOTION_BY_ID[id]; if (!e) return null;
        const c = EMOTION_FAMILIES[e.family].color;
        return el('span', { class: 'chip', style: `border-color:${c}55` }, [
          el('span', { class: 'chip-dot', style: `background:${c}` }), e.label,
        ]);
      }).filter(Boolean);

      const header = el('div', { class: 'flex items-center justify-between gap-3 mb-2' }, [
        el('div', { class: 'flex items-center gap-1.5 flex-wrap' },
          [...emoChips, el('span', { class: 'text-[11px] text-slatey-400/80', text: relativeTime(entry.createdAt) })]),
        el('button', { type: 'button', class: 'entry-del p-1 -m-1', 'data-delete': entry.id, 'aria-label': 'Delete', title: 'Delete' },
          [el('i', { 'data-lucide': 'trash-2', class: 'w-4 h-4' })]),
      ]);

      const body = el('p', { class: 'text-[15px] leading-relaxed text-slatey-200 whitespace-pre-wrap', text: entry.text || '(no text recorded)' });

      const children = [header, body];

      if (entry.reframe) {
        children.push(el('div', { class: 'entry-reframe' }, [
          el('i', { 'data-lucide': 'corner-down-right', class: 'w-3.5 h-3.5' }),
          el('span', { text: entry.reframe }),
        ]));
      }

      children.push(el('div', { class: 'flex items-center gap-4 mt-3 text-[11px] text-slatey-400 flex-wrap' }, [
        el('span', { class: 'inline-flex items-center gap-1.5' }, [el('i', { 'data-lucide': 'zap', class: 'w-3.5 h-3.5' }), `Energy ${entry.energy}`]),
        el('span', { class: 'inline-flex items-center gap-1.5' }, [el('i', { 'data-lucide': 'eye', class: 'w-3.5 h-3.5' }), `Clarity ${entry.clarity}`]),
        el('span', { class: 'inline-flex items-center gap-1.5' }, [el('i', { 'data-lucide': 'calendar', class: 'w-3.5 h-3.5' }), formatDateTime(entry.createdAt)]),
      ]));

      if (entry.distortions && entry.distortions.length) {
        children.push(el('div', { class: 'flex flex-wrap gap-1.5 mt-3' },
          entry.distortions.map((id) => el('span', { class: 'chip', style: 'border-color:#818cf855;color:#c7d2fe' },
            [(DISTORTION_BY_ID[id] || {}).label || id]))));
      }

      host.appendChild(el('article', { class: 'entry', style: `animation-delay:${Math.min(i * 30, 300)}ms` }, children));
    });
    icons();
  }

  /* ---------- analysis: stat cards ---------- */
  function renderStatCards(host, hl) {
    host.innerHTML = '';
    const balance = hl.meanValence == null ? '—'
      : (hl.meanValence > 0 ? '+' : '') + hl.meanValence;
    const cards = [
      { value: hl.count, label: 'Entries in range', icon: 'notebook-pen' },
      { value: balance, label: 'Emotional balance', icon: 'scale', hint: 'Mean valence, −1 to +1' },
      { value: hl.granularity, label: 'Distinct emotions', icon: 'palette', hint: 'Emotional granularity' },
      { value: hl.meanClarity == null ? '—' : hl.meanClarity, label: 'Average clarity', icon: 'eye' },
    ];
    cards.forEach((c) => {
      host.appendChild(el('div', { class: 'stat-card' }, [
        el('div', { class: 'flex items-center justify-between' }, [
          el('span', { class: 'stat-value', text: String(c.value) }),
          el('i', { 'data-lucide': c.icon, class: 'w-4 h-4 text-slatey-400/70' }),
        ]),
        el('div', { class: 'stat-label', text: c.label }),
        c.hint ? el('div', { class: 'stat-hint', text: c.hint }) : null,
      ]));
    });
    icons();
  }

  /* ---------- analysis: insight cards ---------- */
  function renderInsights(host, empty, insights) {
    host.innerHTML = '';
    if (!insights.length) { empty.classList.remove('hidden'); return; }
    empty.classList.add('hidden');
    insights.slice(0, 6).forEach((ins, i) => {
      host.appendChild(el('div', { class: `insight insight--${ins.tone}`, style: `animation-delay:${i * 50}ms` }, [
        el('div', { class: 'insight-ico' }, [el('i', { 'data-lucide': ins.icon, class: 'w-[18px] h-[18px]' })]),
        el('div', {}, [
          el('div', { class: 'insight-title', text: ins.title }),
          el('p', { class: 'insight-detail', text: ins.detail }),
        ]),
      ]));
    });
    icons();
  }

  /* ---------- pillar balance bars ---------- */
  function renderPillarBalance(host, perPillar) {
    host.innerHTML = '';
    perPillar.forEach((p) => {
      const color = PILLARS[p.pillar].color;
      host.appendChild(el('div', { class: 'pillar-row' }, [
        el('div', { class: 'pillar-row-head' }, [
          el('span', { text: p.label }),
          el('span', { class: 'pillar-pct', text: Math.round(p.rate * 100) + '%' }),
        ]),
        el('div', { class: 'pillar-track' }, [
          el('div', { class: 'pillar-fill', style: `width:${Math.round(p.rate * 100)}%;background:${color}` }),
        ]),
      ]));
    });
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function dismissToast(node) {
    if (!node || node.dataset.dismissing) return;
    node.dataset.dismissing = '1';
    node.classList.add('toast--out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  }
  function toast(message, type = 'ok') {
    const host = $('#toast-host');
    Array.from(host.children).forEach(dismissToast);
    const iconName = type === 'err' ? 'alert-triangle' : type === 'info' ? 'info' : 'check-circle-2';
    const node = el('div', { class: `toast toast--${type}`, role: 'status' }, [
      el('i', { 'data-lucide': iconName, class: 'w-4 h-4' }), el('span', { text: message }),
    ]);
    host.appendChild(node); icons();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dismissToast(node), 2600);
  }

  window.AletheiaUI = {
    $, $$, el, icons,
    formatDateTime, relativeTime, liveTimestamp,
    buildEmotionPicker, filterEmotionPicker, buildDistortionGrid,
    buildPractices, buildHistoryFilters,
    renderHistory, renderStatCards, renderInsights, renderPillarBalance,
    toast,
  };
})();
