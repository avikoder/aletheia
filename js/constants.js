/* ============================================================
   Aletheia — constants.js
   Static domain data: emotions, cognitive distortions, and the
   rotation of reflective prompts. Kept separate so the taxonomy
   is easy to read and extend.
   ============================================================ */

(function () {
  'use strict';

  // Primary emotional states. `color` drives the accent on selection
  // and the dot shown in the history feed.
  const EMOTIONS = [
    { id: 'joy',     label: 'Joy',     color: '#fbbf24', icon: 'sun' },
    { id: 'anxiety', label: 'Anxiety', color: '#f472b6', icon: 'wind' },
    { id: 'anger',   label: 'Anger',   color: '#f87171', icon: 'flame' },
    { id: 'sadness', label: 'Sadness', color: '#60a5fa', icon: 'cloud-rain' },
    { id: 'calm',    label: 'Calm',    color: '#34d399', icon: 'waves' },
    { id: 'focus',   label: 'Focus',   color: '#818cf8', icon: 'target' },
  ];

  // Common cognitive distortions / thinking loops. The short
  // description doubles as a gentle in-context reminder.
  const DISTORTIONS = [
    {
      id: 'catastrophizing',
      label: 'Catastrophizing',
      desc: 'Leaping to the worst possible outcome.',
    },
    {
      id: 'all-or-nothing',
      label: 'All-or-Nothing',
      desc: 'Seeing things as total success or total failure.',
    },
    {
      id: 'emotional-reasoning',
      label: 'Emotional Reasoning',
      desc: 'Treating a feeling as proof of fact.',
    },
    {
      id: 'overthinking',
      label: 'Overthinking',
      desc: 'Looping on the same thought without resolution.',
    },
    {
      id: 'mind-reading',
      label: 'Mind Reading',
      desc: 'Assuming you know what others think of you.',
    },
    {
      id: 'should-statements',
      label: 'Should Statements',
      desc: 'Holding rigid rules about how things must be.',
    },
  ];

  // Reflective prompts grouped by tradition. `school` is shown as the
  // eyebrow above each prompt on the Anchor screen.
  const PROMPTS = [
    { school: 'Stoicism', text: 'Is this within my control, or am I spending myself on what is not?' },
    { school: 'Stoicism', text: 'What would remain of this worry if I removed my opinion about it?' },
    { school: 'Stoicism', text: 'If today were enough, what would I stop chasing?' },
    { school: 'Jung', text: 'What part of myself am I meeting in the thing that irritates me most?' },
    { school: 'Jung', text: 'What have I left in shadow because it was easier not to look?' },
    { school: 'Jung', text: 'Which mask did I wear today, and who was underneath it?' },
    { school: 'Maslow', text: 'What would I attempt if my need for safety were already met?' },
    { school: 'Maslow', text: 'When did I last feel most fully myself — and what made it possible?' },
    { school: 'Maslow', text: 'What am I growing toward that I have not yet named aloud?' },
    { school: 'Awareness', text: 'Who is the one noticing this thought right now?' },
    { school: 'Awareness', text: 'Can I let this feeling be here without becoming it?' },
    { school: 'Awareness', text: 'What is true in this moment, before the story about it begins?' },
    { school: 'Awareness', text: 'If I met this thought as a passing cloud, would I still hold it so tightly?' },
    { school: 'Self-actualization', text: 'What would the person I am becoming do with this hour?' },
    { school: 'Self-actualization', text: 'Where am I trading meaning for comfort, and is the trade worth it?' },
    { school: 'Self-actualization', text: 'What small, honest act would move me one step closer to who I intend to be?' },
  ];

  // Convenience lookups
  const EMOTION_BY_ID = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));
  const DISTORTION_BY_ID = Object.fromEntries(DISTORTIONS.map((d) => [d.id, d]));

  window.AletheiaData = {
    EMOTIONS,
    DISTORTIONS,
    PROMPTS,
    EMOTION_BY_ID,
    DISTORTION_BY_ID,
  };
})();
