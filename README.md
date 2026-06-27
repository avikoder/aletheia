# Aletheia v2 — a local-first companion for self-development

Everything runs in your browser. No account, no server, no network calls.
Your entries live only on your device (IndexedDB) and the whole app works offline.

## The five spaces

**Log** — Capture a thought, then name what shaped it: pick from ~45 emotions
grouped into 10 families (searchable), set energy and clarity, flag any of 14
cognitive loops, and optionally write a reframe. `Ctrl/⌘ + Enter` records.

**Anchor** — Three breathing patterns (Box, 4-7-8, Coherent) with an animated
guide, rotating reflective prompts (Stoic, Jungian, humanist, contemplative),
and a 5-4-3-2-1 grounding exercise.

**Practices** — A daily check-in across three pillars — Physical, Mental,
Emotional — plus a sleep-quality measure. Tracks streaks. Saves automatically.

**Analysis** — The heart of v2. Computed entirely from your own data:
- Emotional landscape on a valence/arousal circumplex (with your average point)
- Emotional balance trend over time
- Emotional granularity (distinct-emotion count — a regulation marker)
- Cognitive-loop frequency and a rising/falling trend
- Practice adherence per pillar and per practice
- **Practice ↔ mood/clarity correlations** with effect sizes (Cohen's d),
  Pearson r, and sample-size guards
- Auto-generated, ranked, plain-language insights — associations, never
  presented as causation

**History** — Search and filter every entry by emotion family or loop.

## Your data
Export a JSON backup any time (download icon) and import/restore it (upload
icon). Backups carry both thoughts and practice check-ins, and merge without
duplicates. Backing up monthly is the only safety net for a fully private app.

## Install
Serve the folder over http/https (e.g. GitHub Pages) and use your browser's
"Install" / "Add to Home Screen". Offline-ready after first load.
