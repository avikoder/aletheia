/* ============================================================
   Aletheia — ui.js
   Pure-ish view helpers: building option grids, rendering the
   history feed, formatting dates, and showing toasts. State and
   wiring live in app.js; this file only knows how to draw.
   ============================================================ */

(function () {
  'use strict';

  const { EMOTIONS, DISTORTIONS, EMOTION_BY_ID, DISTORTION_BY_ID } = window.AletheiaData;

  /* ---------- tiny DOM helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('data-')) node.setAttribute(k, v);
      else if (k === 'style') node.setAttribute('style', v);
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* Re-render Lucide icons within a scope (or whole document). */
  function icons(root) {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons(root ? { nameAttr: 'data-lucide' } : undefined);
    }
  }

  /* ---------- formatting ---------- */
  function formatDateTime(iso) {
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${date} · ${time}`;
  }

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatDateTime(iso).split(' · ')[0];
  }

  function liveTimestamp() {
    return new Date().toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }

  /* ---------- build option grids ---------- */
  function buildEmotionGrid(container) {
    container.innerHTML = '';
    EMOTIONS.forEach((e) => {
      const btn = el('button', {
        type: 'button',
        class: 'emotion-btn',
        'data-emotion': e.id,
        style: `--ec:${e.color}`,
        'aria-pressed': 'false',
        title: e.label,
      }, [
        el('span', { class: 'emotion-dot' }),
        el('span', { class: 'emotion-name', text: e.label }),
      ]);
      container.appendChild(btn);
    });
  }

  function buildDistortionGrid(container) {
    container.innerHTML = '';
    DISTORTIONS.forEach((d) => {
      const item = el('label', {
        class: 'distortion-item',
        'data-distortion': d.id,
      }, [
        el('span', { class: 'distortion-box' }, [
          el('i', { 'data-lucide': 'check' }),
        ]),
        el('span', {}, [
          el('span', { class: 'distortion-name', text: d.label, style: 'display:block' }),
          el('span', { class: 'distortion-desc', text: d.desc }),
        ]),
      ]);
      container.appendChild(item);
    });
    icons();
  }

  /* ---------- filter chips (history) ---------- */
  function buildFilterChips(emotionHost, distortionHost) {
    emotionHost.innerHTML = '';
    EMOTIONS.forEach((e) => {
      emotionHost.appendChild(
        el('button', {
          type: 'button',
          class: 'chip chip-filter',
          'data-filter-emotion': e.id,
          style: `--fc:${e.color}`,
        }, [
          el('span', { class: 'chip-dot', style: `background:${e.color}` }),
          e.label,
        ])
      );
    });

    distortionHost.innerHTML = '';
    DISTORTIONS.forEach((d) => {
      distortionHost.appendChild(
        el('button', {
          type: 'button',
          class: 'chip chip-filter',
          'data-filter-distortion': d.id,
          style: '--fc:#818cf8',
        }, [d.label])
      );
    });
  }

  /* ---------- history feed ---------- */
  function renderHistory(host, emptyState, entries) {
    host.innerHTML = '';

    if (!entries.length) {
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    entries.forEach((entry, i) => {
      const emotion = EMOTION_BY_ID[entry.emotion];

      // Header: emotion + relative time + delete
      const header = el('div', { class: 'flex items-center justify-between gap-3 mb-2.5' }, [
        el('div', { class: 'flex items-center gap-2 flex-wrap' }, [
          emotion
            ? el('span', { class: 'chip', style: `border-color:${emotion.color}55` }, [
                el('span', { class: 'chip-dot', style: `background:${emotion.color}` }),
                emotion.label,
              ])
            : null,
          el('span', { class: 'text-[11px] text-slatey-400/80', text: relativeTime(entry.createdAt) }),
        ]),
        el('button', {
          type: 'button',
          class: 'entry-del p-1 -m-1',
          'data-delete': entry.id,
          'aria-label': 'Delete entry',
          title: 'Delete',
        }, [el('i', { 'data-lucide': 'trash-2', class: 'w-4 h-4' })]),
      ]);

      // Body text
      const body = el('p', {
        class: 'text-[15px] leading-relaxed text-slatey-200 whitespace-pre-wrap',
        text: entry.text || '(no text recorded)',
      });

      // Metrics row
      const metrics = el('div', { class: 'flex items-center gap-4 mt-3 text-[11px] text-slatey-400' }, [
        el('span', { class: 'inline-flex items-center gap-1.5' }, [
          el('i', { 'data-lucide': 'zap', class: 'w-3.5 h-3.5' }),
          `Energy ${entry.energy}`,
        ]),
        el('span', { class: 'inline-flex items-center gap-1.5' }, [
          el('i', { 'data-lucide': 'eye', class: 'w-3.5 h-3.5' }),
          `Clarity ${entry.clarity}`,
        ]),
        el('span', { class: 'inline-flex items-center gap-1.5' }, [
          el('i', { 'data-lucide': 'calendar', class: 'w-3.5 h-3.5' }),
          formatDateTime(entry.createdAt),
        ]),
      ]);

      // Distortion chips
      let loops = null;
      if (entry.distortions && entry.distortions.length) {
        loops = el('div', { class: 'flex flex-wrap gap-1.5 mt-3' },
          entry.distortions.map((id) => {
            const d = DISTORTION_BY_ID[id];
            return el('span', {
              class: 'chip',
              style: 'border-color:#818cf855;color:#c7d2fe',
            }, [d ? d.label : id]);
          })
        );
      }

      const card = el('article', {
        class: 'entry',
        style: `animation-delay:${Math.min(i * 35, 350)}ms`,
      }, [header, body, metrics, loops]);

      host.appendChild(card);
    });

    icons();
  }

  /* ---------- stat cards (patterns) ---------- */
  function renderStatCards(host, stats) {
    host.innerHTML = '';
    const cards = [
      { value: stats.total, label: 'Entries in range', icon: 'notebook-pen' },
      { value: stats.topEmotionLabel, label: 'Most frequent feeling', icon: 'heart' },
      { value: stats.topLoopLabel, label: 'Most frequent loop', icon: 'repeat' },
      { value: stats.avgClarity, label: 'Average clarity', icon: 'eye' },
    ];
    cards.forEach((c) => {
      host.appendChild(
        el('div', { class: 'stat-card' }, [
          el('div', { class: 'flex items-center justify-between' }, [
            el('span', { class: 'stat-value', text: String(c.value) }),
            el('i', { 'data-lucide': c.icon, class: 'w-4 h-4 text-slatey-400/70' }),
          ]),
          el('div', { class: 'stat-label', text: c.label }),
        ])
      );
    });
    icons();
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function dismissToast(node) {
    if (!node || node.dataset.dismissing) return;
    node.dataset.dismissing = '1';
    node.classList.add('toast--out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    // Safety net in case the animationend event is missed.
    setTimeout(() => node.remove(), 400);
  }

  function toast(message, type = 'ok') {
    const host = $('#toast-host');

    // Only one toast at a time: retire any that are still on screen.
    Array.from(host.children).forEach(dismissToast);

    const iconName = type === 'err' ? 'alert-triangle' : type === 'info' ? 'info' : 'check-circle-2';
    const node = el('div', { class: `toast toast--${type}`, role: 'status' }, [
      el('i', { 'data-lucide': iconName, class: 'w-4 h-4' }),
      el('span', { text: message }),
    ]);
    host.appendChild(node);
    icons();

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dismissToast(node), 2600);
  }

  window.AletheiaUI = {
    $, $$, el, icons,
    formatDateTime, relativeTime, liveTimestamp,
    buildEmotionGrid, buildDistortionGrid, buildFilterChips,
    renderHistory, renderStatCards, toast,
  };
})();
