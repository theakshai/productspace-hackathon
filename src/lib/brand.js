import { generateJSON } from './gemini.js'

// Finds every place the creator changed the AI's copy by hand: original vs current text.
export function collectManualEdits(copy) {
  const pairs = []
  for (const entry of Object.values(copy?.byClip || {})) {
    for (const [platform, fields] of Object.entries(entry.platforms || {})) {
      for (const [field, value] of Object.entries(fields)) {
        const original = entry.original?.[platform]?.[field]
        const wasVoice = (entry.edits || []).some((e) => e.kind === 'voice' && e.platform === platform)
        if (original != null && original.trim() !== String(value).trim() && !wasVoice) {
          pairs.push({ platform, field, original, edited: String(value) })
        }
      }
    }
  }
  return pairs
}

export function collectVoiceFeedback(copy) {
  const out = []
  for (const entry of Object.values(copy?.byClip || {})) {
    for (const e of entry.edits || []) if (e.kind === 'voice') out.push(e)
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1))
}

const LEARN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rules: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          rule: { type: 'STRING', description: 'Short imperative brand voice rule, e.g. "Never use emojis."' },
          evidence: { type: 'STRING', description: 'What in the edits shows this, e.g. "You removed emojis in 3 of 4 posts."' },
        },
        required: ['rule', 'evidence'],
      },
    },
  },
  required: ['rules'],
}

const LEARN_SYSTEM = `You study how a creator edits AI-written social media copy and infer their lasting brand voice.

You get pairs of ORIGINAL (AI) and EDITED (creator) text. Find consistent patterns: what they remove, add, shorten, rephrase; tone, length, emojis, hashtags, calls to action, words they avoid, how they open and close.
Rules:
- Only propose rules backed by the edits. Prefer patterns seen more than once; a single strong, clearly deliberate change is fine.
- Ignore one-off factual fixes (typos, names, numbers).
- Each rule is a short imperative sentence a copywriter can follow. Max 6 rules.
- Do not repeat or contradict existing rules unless the edits clearly show the creator changed their mind; then propose the new version.
- Evidence must cite what you saw, briefly.`

export async function learnFromEdits({ apiKey, model, pairs, existingRules = [], signal }) {
  const parts = [
    { text: existingRules.length ? `EXISTING RULES\n- ${existingRules.join('\n- ')}` : 'EXISTING RULES\nNone.' },
    ...pairs.slice(0, 20).map((p, i) => ({
      text: `EDIT ${i + 1} (${p.platform} ${p.field})\nORIGINAL:\n${p.original}\nEDITED:\n${p.edited}`,
    })),
  ]
  const raw = await generateJSON({ apiKey, model, system: LEARN_SYSTEM, schema: LEARN_SCHEMA, temperature: 0.3, signal, parts })
  const known = new Set(existingRules.map((r) => r.toLowerCase().trim()))
  return (raw.rules || [])
    .map((r) => ({ rule: String(r.rule || '').trim(), evidence: String(r.evidence || '').trim() }))
    .filter((r) => r.rule && !known.has(r.rule.toLowerCase()))
}

const SPEECH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rules: { type: 'ARRAY', items: { type: 'STRING' } },
    corrections: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { heard: { type: 'STRING' }, understood: { type: 'STRING' } }, required: ['heard', 'understood'] },
    },
  },
  required: ['rules', 'corrections'],
}

const SPEECH_SYSTEM = `A creator is describing, out loud, how they like their social media posts written. The text is raw dictation with filler words, rambling and self-corrections; the LATER statement wins.
Turn it into clear, separate brand voice rules: short imperative sentences ("Never use emojis.", "Keep LinkedIn posts under 120 words."). Do not invent preferences they did not state. Record each self-correction in "corrections".`

export async function rulesFromSpeech({ apiKey, model, speech, existingRules = [], signal }) {
  const raw = await generateJSON({
    apiKey,
    model,
    system: SPEECH_SYSTEM,
    schema: SPEECH_SCHEMA,
    temperature: 0.2,
    signal,
    parts: [
      { text: existingRules.length ? `EXISTING RULES (don't repeat)\n- ${existingRules.join('\n- ')}` : 'EXISTING RULES\nNone.' },
      { text: `WHAT THEY SAID\n"""${speech}"""` },
    ],
  })
  const known = new Set(existingRules.map((r) => r.toLowerCase().trim()))
  return {
    rules: (raw.rules || []).map((r) => String(r).trim()).filter((r) => r && !known.has(r.toLowerCase())),
    corrections: (raw.corrections || []).filter((c) => c?.heard && c?.understood),
  }
}
