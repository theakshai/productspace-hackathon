import { generateJSON } from './gemini.js'

export const PLATFORMS = [
  { id: 'youtube_shorts', label: 'YouTube Shorts' },
  { id: 'instagram_reels', label: 'Instagram Reels' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
]

export const platformLabel = (id) => PLATFORMS.find((p) => p.id === id)?.label || id

const BRIEF_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: 'One clean sentence stating what the creator wants.' },
    audience: { type: 'STRING' },
    goal: { type: 'STRING', description: 'What the clips should achieve, e.g. grow followers, drive podcast listens.' },
    tone: { type: 'ARRAY', items: { type: 'STRING' } },
    topics: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Topics or moments to look for.' },
    avoid: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Things to leave out.' },
    platforms: { type: 'ARRAY', items: { type: 'STRING', enum: PLATFORMS.map((p) => p.id) } },
    clipCount: { type: 'INTEGER' },
    clipLengthSeconds: {
      type: 'OBJECT',
      properties: { min: { type: 'INTEGER' }, max: { type: 'INTEGER' } },
      required: ['min', 'max'],
    },
    corrections: {
      type: 'ARRAY',
      description: 'Every place the speaker corrected themselves or was unclear, and how it was resolved.',
      items: {
        type: 'OBJECT',
        properties: { heard: { type: 'STRING' }, understood: { type: 'STRING' } },
        required: ['heard', 'understood'],
      },
    },
    assumptions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: 'Defaults you filled in because the speaker did not say.',
    },
  },
  required: ['summary', 'audience', 'goal', 'tone', 'topics', 'avoid', 'platforms', 'clipCount', 'clipLengthSeconds', 'corrections', 'assumptions'],
}

const SYSTEM = `You turn a content creator's spoken, unedited brief into a precise creative brief for repurposing a long podcast into short clips.

The input is raw speech captured by dictation. It contains filler words ("uh", "like", "you know"), digressions, repetition and self-corrections ("for LinkedIn, no wait, Instagram"). Rules:
- When the speaker corrects themselves, the LATER statement wins. Record each correction in "corrections".
- Ignore filler and digressions. Never invent topics the speaker did not mention.
- If something is not said, use sensible defaults and list each one in "assumptions":
  platforms = all four, clipCount = 5, clip length 30–60 seconds, tone = "conversational".
- Keep clipCount between 1 and 10 and clip lengths between 10 and 180 seconds.
- Write every field in clear, short English.`

export async function structureBrief({ apiKey, model, rawSpeech, signal }) {
  const brief = await generateJSON({
    apiKey,
    model,
    system: SYSTEM,
    schema: BRIEF_SCHEMA,
    temperature: 0.2,
    signal,
    parts: [{ text: `Spoken brief:\n"""${rawSpeech}"""` }],
  })
  return normalizeBrief(brief)
}

// Guards against out-of-range or missing values so later steps can trust the brief.
export function normalizeBrief(b) {
  const clamp = (n, lo, hi, d) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d)
  const list = (x) => (Array.isArray(x) ? x.filter(Boolean).map(String) : [])
  const platforms = list(b.platforms).filter((p) => PLATFORMS.some((x) => x.id === p))
  let min = clamp(b.clipLengthSeconds?.min, 10, 180, 30)
  let max = clamp(b.clipLengthSeconds?.max, 10, 180, 60)
  if (min > max) [min, max] = [max, min]
  return {
    summary: String(b.summary || ''),
    audience: String(b.audience || ''),
    goal: String(b.goal || ''),
    tone: list(b.tone),
    topics: list(b.topics),
    avoid: list(b.avoid),
    platforms: platforms.length ? platforms : PLATFORMS.map((p) => p.id),
    clipCount: clamp(b.clipCount, 1, 10, 5),
    clipLengthSeconds: { min, max },
    corrections: Array.isArray(b.corrections) ? b.corrections.filter((c) => c?.heard && c?.understood) : [],
    assumptions: list(b.assumptions),
  }
}

export const EXAMPLE_SPEECH =
  "Okay so, uh, I want clips mostly about the AI and jobs part, like what young people should actually do, you know, for, um, college students and early founders. Make it feel punchy but not, like, clickbaity. Let's do LinkedIn and Instagram, oh and YouTube Shorts too. Maybe six clips, no wait, five is fine. Keep them under a minute. And skip the bits where they talk about, uh, Sam's personal life."
