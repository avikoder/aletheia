/* ============================================================
   Aletheia — constants.js  (v2)
   Domain data: a wide emotional taxonomy with valence/arousal
   coordinates, an expanded set of cognitive distortions with
   reframes, daily practices across three pillars, breathing
   patterns, a grounding exercise, and reflective prompts.
   ============================================================ */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     EMOTION FAMILIES
     Each family has a color used across the UI and charts.
     --------------------------------------------------------- */
  const EMOTION_FAMILIES = {
    joy:      { label: 'Joy',        color: '#fbbf24' },
    calm:     { label: 'Calm',       color: '#34d399' },
    engaged:  { label: 'Engaged',    color: '#818cf8' },
    love:     { label: 'Connection', color: '#fb7185' },
    fear:     { label: 'Fear',       color: '#a78bfa' },
    anger:    { label: 'Anger',      color: '#f87171' },
    sadness:  { label: 'Sadness',    color: '#60a5fa' },
    shame:    { label: 'Shame',      color: '#e879f9' },
    surprise: { label: 'Surprise',   color: '#22d3ee' },
    depleted: { label: 'Depleted',   color: '#94a3b8' },
  };

  /* ---------------------------------------------------------
     EMOTIONS
     valence: -1 (unpleasant) .. +1 (pleasant)
     arousal: -1 (deactivated/low energy) .. +1 (activated)
     These coordinates place each emotion on the affective
     circumplex used in the Analysis space.
     --------------------------------------------------------- */
  const EMOTIONS = [
    // Joy
    { id: 'joyful',     label: 'Joyful',     family: 'joy', v: 0.90, a: 0.55 },
    { id: 'content',    label: 'Content',    family: 'joy', v: 0.70, a: -0.20 },
    { id: 'grateful',   label: 'Grateful',   family: 'joy', v: 0.80, a: 0.10 },
    { id: 'proud',      label: 'Proud',      family: 'joy', v: 0.70, a: 0.40 },
    { id: 'excited',    label: 'Excited',    family: 'joy', v: 0.80, a: 0.80 },
    { id: 'hopeful',    label: 'Hopeful',    family: 'joy', v: 0.60, a: 0.30 },
    { id: 'playful',    label: 'Playful',    family: 'joy', v: 0.70, a: 0.55 },

    // Calm
    { id: 'calm',       label: 'Calm',       family: 'calm', v: 0.50, a: -0.50 },
    { id: 'peaceful',   label: 'Peaceful',   family: 'calm', v: 0.60, a: -0.60 },
    { id: 'relaxed',    label: 'Relaxed',    family: 'calm', v: 0.50, a: -0.40 },
    { id: 'centered',   label: 'Centered',   family: 'calm', v: 0.60, a: -0.25 },

    // Engaged / Powerful
    { id: 'focused',    label: 'Focused',    family: 'engaged', v: 0.40, a: 0.40 },
    { id: 'confident',  label: 'Confident',  family: 'engaged', v: 0.70, a: 0.40 },
    { id: 'motivated',  label: 'Motivated',  family: 'engaged', v: 0.60, a: 0.60 },
    { id: 'inspired',   label: 'Inspired',   family: 'engaged', v: 0.80, a: 0.60 },
    { id: 'determined', label: 'Determined', family: 'engaged', v: 0.50, a: 0.55 },

    // Connection / Love
    { id: 'loving',       label: 'Loving',       family: 'love', v: 0.80, a: 0.20 },
    { id: 'affectionate', label: 'Affectionate', family: 'love', v: 0.70, a: 0.10 },
    { id: 'connected',    label: 'Connected',    family: 'love', v: 0.70, a: 0.00 },
    { id: 'compassionate',label: 'Compassionate',family: 'love', v: 0.60, a: 0.00 },

    // Fear / Anxiety
    { id: 'anxious',     label: 'Anxious',     family: 'fear', v: -0.60, a: 0.50 },
    { id: 'worried',     label: 'Worried',     family: 'fear', v: -0.50, a: 0.30 },
    { id: 'nervous',     label: 'Nervous',     family: 'fear', v: -0.40, a: 0.50 },
    { id: 'overwhelmed', label: 'Overwhelmed', family: 'fear', v: -0.70, a: 0.60 },
    { id: 'insecure',    label: 'Insecure',    family: 'fear', v: -0.50, a: 0.10 },
    { id: 'afraid',      label: 'Afraid',      family: 'fear', v: -0.70, a: 0.65 },

    // Anger
    { id: 'angry',      label: 'Angry',      family: 'anger', v: -0.70, a: 0.70 },
    { id: 'frustrated', label: 'Frustrated', family: 'anger', v: -0.50, a: 0.50 },
    { id: 'irritated',  label: 'Irritated',  family: 'anger', v: -0.40, a: 0.30 },
    { id: 'resentful',  label: 'Resentful',  family: 'anger', v: -0.60, a: 0.20 },
    { id: 'jealous',    label: 'Jealous',    family: 'anger', v: -0.50, a: 0.40 },

    // Sadness
    { id: 'sad',          label: 'Sad',          family: 'sadness', v: -0.70, a: -0.30 },
    { id: 'lonely',       label: 'Lonely',       family: 'sadness', v: -0.60, a: -0.20 },
    { id: 'disappointed', label: 'Disappointed', family: 'sadness', v: -0.50, a: -0.10 },
    { id: 'hurt',         label: 'Hurt',         family: 'sadness', v: -0.60, a: 0.00 },
    { id: 'discouraged',  label: 'Discouraged',  family: 'sadness', v: -0.60, a: -0.30 },
    { id: 'empty',        label: 'Empty',        family: 'sadness', v: -0.60, a: -0.60 },
    { id: 'grief',        label: 'Grief',        family: 'sadness', v: -0.80, a: -0.20 },

    // Shame / Aversion
    { id: 'ashamed',   label: 'Ashamed',   family: 'shame', v: -0.70, a: 0.00 },
    { id: 'guilty',    label: 'Guilty',    family: 'shame', v: -0.60, a: 0.10 },
    { id: 'disgusted', label: 'Disgusted', family: 'shame', v: -0.50, a: 0.20 },
    { id: 'regretful', label: 'Regretful', family: 'shame', v: -0.50, a: -0.10 },

    // Surprise / Curiosity
    { id: 'surprised', label: 'Surprised', family: 'surprise', v: 0.10, a: 0.60 },
    { id: 'confused',  label: 'Confused',  family: 'surprise', v: -0.20, a: 0.20 },
    { id: 'curious',   label: 'Curious',   family: 'surprise', v: 0.50, a: 0.40 },

    // Depleted / Low energy
    { id: 'tired',    label: 'Tired',    family: 'depleted', v: -0.20, a: -0.60 },
    { id: 'bored',    label: 'Bored',    family: 'depleted', v: -0.30, a: -0.50 },
    { id: 'numb',     label: 'Numb',     family: 'depleted', v: -0.30, a: -0.70 },
    { id: 'restless', label: 'Restless', family: 'depleted', v: -0.20, a: 0.40 },
  ];

  /* ---------------------------------------------------------
     COGNITIVE DISTORTIONS  (expanded, with reframe)
     --------------------------------------------------------- */
  const DISTORTIONS = [
    { id: 'all-or-nothing', label: 'All-or-Nothing',
      desc: 'Seeing things in absolutes — total success or total failure.',
      example: '“If it isn\u2019t perfect, it\u2019s worthless.”',
      reframe: 'Look for the middle ground. Where does this sit on a scale, not a switch?' },
    { id: 'overgeneralization', label: 'Overgeneralization',
      desc: 'Taking one event as a never-ending pattern.',
      example: '“This always happens to me.”',
      reframe: 'Is this one instance, or genuinely every time? Name the actual frequency.' },
    { id: 'mental-filter', label: 'Mental Filter',
      desc: 'Dwelling on a single negative and screening out the rest.',
      example: 'One critical comment outweighs ten kind ones.',
      reframe: 'What are you filtering out? List the parts that also went well.' },
    { id: 'discounting-positive', label: 'Discounting the Positive',
      desc: 'Insisting good things “don\u2019t count.”',
      example: '“They were just being nice.”',
      reframe: 'Let the positive stand. What if it did count?' },
    { id: 'mind-reading', label: 'Mind Reading',
      desc: 'Assuming you know what others think, usually the worst.',
      example: '“They thought I sounded unprepared.”',
      reframe: 'What\u2019s the evidence? What else could explain it?' },
    { id: 'catastrophizing', label: 'Catastrophizing',
      desc: 'Leaping to the worst outcome and treating it as likely.',
      example: '“If this fails, everything falls apart.”',
      reframe: 'What\u2019s most likely to actually happen? Could you cope if it did?' },
    { id: 'magnification', label: 'Magnification / Minimizing',
      desc: 'Blowing up flaws, shrinking strengths.',
      example: 'A small mistake feels enormous; a real win feels trivial.',
      reframe: 'Right-size it. How big is this in a week? In a year?' },
    { id: 'emotional-reasoning', label: 'Emotional Reasoning',
      desc: 'Treating a feeling as proof of fact.',
      example: '“I feel like a fraud, so I must be one.”',
      reframe: 'A feeling is data, not a verdict. What do the facts say?' },
    { id: 'should-statements', label: 'Should Statements',
      desc: 'Rigid rules about how things, others, or you must be.',
      example: '“I should be further along by now.”',
      reframe: 'Swap “should” for “could.” Whose rule is this, and does it serve you?' },
    { id: 'labeling', label: 'Labeling',
      desc: 'Defining yourself by a single act or trait.',
      example: '“I\u2019m a failure,” instead of “I failed at this.”',
      reframe: 'Describe the behavior, not the whole self. You are not one event.' },
    { id: 'personalization', label: 'Personalization',
      desc: 'Taking responsibility for things outside your control.',
      example: '“It\u2019s my fault they\u2019re in a bad mood.”',
      reframe: 'What part is actually yours? What belongs to circumstance or others?' },
    { id: 'blaming', label: 'Blaming',
      desc: 'Placing all fault outward, ignoring your own agency.',
      example: '“They made me feel this way.”',
      reframe: 'What\u2019s one thing within your control here, however small?' },
    { id: 'rumination', label: 'Overthinking / Rumination',
      desc: 'Looping on a thought without moving to resolution.',
      example: 'Replaying the same scene for the tenth time.',
      reframe: 'Is this problem-solving or spinning? Name one next action, or set it down.' },
    { id: 'comparison', label: 'Compare & Despair',
      desc: 'Measuring your insides against others\u2019 outsides.',
      example: '“Everyone else has it figured out.”',
      reframe: 'You\u2019re seeing their highlight reel, not their full story. Compare to your past self.' },
  ];

  /* ---------------------------------------------------------
     DAILY PRACTICES  (three pillars)
     --------------------------------------------------------- */
  const PILLARS = {
    physical:  { label: 'Physical',  color: '#34d399' },
    mental:    { label: 'Mental',    color: '#818cf8' },
    emotional: { label: 'Emotional', color: '#fb7185' },
  };

  const PRACTICES = [
    // Physical
    { id: 'movement',  label: 'Moved my body',        pillar: 'physical', icon: 'activity' },
    { id: 'nourish',   label: 'Ate nourishing food',  pillar: 'physical', icon: 'apple' },
    { id: 'hydrate',   label: 'Stayed hydrated',      pillar: 'physical', icon: 'droplet' },
    { id: 'outdoors',  label: 'Time outdoors',        pillar: 'physical', icon: 'sun' },
    // Mental
    { id: 'deep_work', label: 'Focused deep work',    pillar: 'mental', icon: 'brain' },
    { id: 'learning',  label: 'Learned or read',      pillar: 'mental', icon: 'book-open' },
    { id: 'screen',    label: 'Screen discipline',    pillar: 'mental', icon: 'smartphone' },
    // Emotional
    { id: 'stillness', label: 'Stillness / meditation', pillar: 'emotional', icon: 'orbit' },
    { id: 'gratitude', label: 'Practiced gratitude',  pillar: 'emotional', icon: 'heart' },
    { id: 'connection',label: 'Meaningful connection',pillar: 'emotional', icon: 'users' },
    { id: 'reflection',label: 'Reflected / journaled',pillar: 'emotional', icon: 'feather' },
  ];

  /* ---------------------------------------------------------
     BREATHING PATTERNS  (phases in seconds)
     --------------------------------------------------------- */
  const BREATHING = [
    { id: 'box', label: 'Box', detail: '4 · 4 · 4 · 4',
      phases: [{ k: 'in', s: 4 }, { k: 'hold', s: 4 }, { k: 'out', s: 4 }, { k: 'hold', s: 4 }],
      note: 'Steadying. A calm, even square of breath.' },
    { id: '478', label: '4-7-8', detail: '4 · 7 · 8',
      phases: [{ k: 'in', s: 4 }, { k: 'hold', s: 7 }, { k: 'out', s: 8 }],
      note: 'Calming. A long exhale to settle the nervous system.' },
    { id: 'coherent', label: 'Coherent', detail: '5 · 5',
      phases: [{ k: 'in', s: 5 }, { k: 'out', s: 5 }],
      note: 'Balancing. Smooth, equal breaths near six per minute.' },
  ];

  const PHASE_LABEL = { in: 'Breathe in', out: 'Breathe out', hold: 'Hold' };

  /* ---------------------------------------------------------
     GROUNDING  (5-4-3-2-1 senses)
     --------------------------------------------------------- */
  const GROUNDING = [
    { sense: 'see',   count: 5, prompt: 'Name five things you can see right now.' },
    { sense: 'feel',  count: 4, prompt: 'Notice four things you can physically feel.' },
    { sense: 'hear',  count: 3, prompt: 'Listen for three things you can hear.' },
    { sense: 'smell', count: 2, prompt: 'Find two things you can smell.' },
    { sense: 'taste', count: 1, prompt: 'Notice one thing you can taste.' },
  ];

  /* ---------------------------------------------------------
     REFLECTIVE PROMPTS
     --------------------------------------------------------- */
  const PROMPTS = [
    { school: 'Stoicism', text: 'Is this within my control, or am I spending myself on what is not?' },
    { school: 'Stoicism', text: 'What would remain of this worry if I removed my opinion about it?' },
    { school: 'Stoicism', text: 'If today were enough, what would I stop chasing?' },
    { school: 'Stoicism', text: 'What would the wisest version of me do in the next hour?' },
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
    { school: 'Body', text: 'What is my body asking for right now that I have been ignoring?' },
    { school: 'Body', text: 'Where am I holding tension, and what might it be protecting?' },
    { school: 'Growth', text: 'What did today teach me that I did not know yesterday?' },
    { school: 'Growth', text: 'What would I do differently if I trusted that I could begin again tomorrow?' },
  ];

  /* ---------------------------------------------------------
     Lookups
     --------------------------------------------------------- */
  const EMOTION_BY_ID = Object.fromEntries(EMOTIONS.map((e) => [e.id, e]));
  const DISTORTION_BY_ID = Object.fromEntries(DISTORTIONS.map((d) => [d.id, d]));
  const PRACTICE_BY_ID = Object.fromEntries(PRACTICES.map((p) => [p.id, p]));

  // Group emotions by family for rendering the picker.
  const EMOTIONS_BY_FAMILY = {};
  EMOTIONS.forEach((e) => {
    (EMOTIONS_BY_FAMILY[e.family] = EMOTIONS_BY_FAMILY[e.family] || []).push(e);
  });

  window.AletheiaData = {
    EMOTION_FAMILIES, EMOTIONS, EMOTIONS_BY_FAMILY, EMOTION_BY_ID,
    DISTORTIONS, DISTORTION_BY_ID,
    PILLARS, PRACTICES, PRACTICE_BY_ID,
    BREATHING, PHASE_LABEL, GROUNDING, PROMPTS,
  };
})();
