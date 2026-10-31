import { normalizeBrief } from './brief.js'
import { generateJSON } from './gemini.js'
import { formatTimestamp, parseTimestamp } from './transcript.js'

export const HOOK_TYPES = ['bold claim', 'advice', 'story', 'question', 'stat', 'contrarian', 'funny', 'emotional']

// Used when the creator doesn't say anything: the five strongest moments for every platform.
export const DEFAULT_BRIEF = normalizeBrief({
  summary: 'The five strongest standalone moments, for every platform.',
  audience: 'General audience of the podcast',
  goal: 'Grow followers with clips that make people want the full episode',
  tone: ['conversational'],
  topics: [],
  avoid: [],
  platforms: [],
  clipCount: 5,
  clipLengthSeconds: { min: 30, max: 60 },
  corrections: [],
  assumptions: ['No brief given, so ClipCraft picked the strongest moments for every platform'],
})

const CLIPS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    clips: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Short, punchy working title (max 8 words).' },
          start: { type: 'STRING', description: 'Start time, M:SS, copied from a transcript line start.' },
          end: { type: 'STRING', description: 'End time, M:SS, copied from a transcript line end.' },
          topic: { type: 'STRING' },
          hookType: { type: 'STRING', enum: HOOK_TYPES },
          hookScore: { type: 'INTEGER', description: '1–10: how strongly the first 3 seconds stop the scroll.' },
          quote: { type: 'STRING', description: 'The single strongest line in the clip, verbatim.' },
          reason: { type: 'STRING', description: 'Why this moment was chosen, in 1–2 sentences that reference the brief.' },
        },
        required: ['title', 'start', 'end', 'topic', 'hookType', 'hookScore', 'quote', 'reason'],
      },
    },
  },
  required: ['clips'],
}

const SYSTEM = `You are a senior short-form video editor who repurposes long podcasts into viral clips.

You get a timestamped transcript and a creative brief. Pick the best clips for the brief. Rules:
- Each clip must stand on its own: a viewer with no context understands it and feels a payoff.
- It must open with a strong hook in the first sentence (bold claim, question, surprising fact, story start).
- Start and end exactly on transcript line boundaries: copy a line's start time and a (possibly later) line's end time.
- Respect the clip length range in the brief. Clips must not overlap.
- Follow the brief's topics, audience and tone; skip anything it says to leave out.
- If past performance learnings are given, favour what worked and avoid what didn't.
- The reason must be specific: say what makes this moment work for THIS audience, not generic praise.
- Return clips in order of strength, best first.`

function transcriptForPrompt(transcript) {
  const names = Object.fromEntries(transcript.speakers.map((s) => [s.id, s.name]))
  return transcript.segments
    .map((s) => `[${formatTimestamp(s.start)}–${formatTimestamp(s.end)}] ${names[s.speaker] || s.speaker}: ${s.text}`)
    .join('\n')
}

function briefForPrompt(brief) {
  return [
    `Goal: ${brief.goal}`,
    `Audience: ${brief.audience}`,
    `Tone: ${brief.tone.join(', ') || 'conversational'}`,
    `Topics to look for: ${brief.topics.join(', ') || 'any, pick the strongest moments'}`,
    `Leave out: ${brief.avoid.join(', ') || 'nothing'}`,
    `Number of clips: ${brief.clipCount}`,
    `Clip length: ${brief.clipLengthSeconds.min}–${brief.clipLengthSeconds.max} seconds`,
  ].join('\n')
}

export async function selectClips({ apiKey, model, transcript, brief = DEFAULT_BRIEF, learnings = [], signal }) {
  const parts = [
    { text: `CREATIVE BRIEF\n${briefForPrompt(brief)}` },
    ...(learnings.length ? [{ text: `PAST PERFORMANCE LEARNINGS\n- ${learnings.join('\n- ')}` }] : []),
    { text: `TRANSCRIPT\n${transcriptForPrompt(transcript)}` },
    { text: `Pick exactly ${brief.clipCount} clips.` },
  ]
  const raw = await generateJSON({ apiKey, model, system: SYSTEM, schema: CLIPS_SCHEMA, temperature: 0.5, signal, parts })
  return normalizeClips(raw.clips || [], transcript, brief)
}

// Snaps clips to transcript line boundaries, fixes bad ranges and drops overlaps.
export function normalizeClips(rawClips, transcript, brief = DEFAULT_BRIEF) {
  const segs = transcript.segments
  const total = transcript.durationSeconds || (segs.length ? segs[segs.length - 1].end : 0)
  const snapStart = (t) => {
    let best = segs[0]?.start ?? t
    for (const s of segs) if (s.start <= t + 1) best = s.start
    return best
  }
  const snapEnd = (t) => {
    for (const s of segs) if (s.end >= t - 1) return s.end
    return segs.length ? segs[segs.length - 1].end : t
  }

  const out = []
  rawClips.forEach((c, i) => {
    let start = parseTimestamp(c.start)
    let end = parseTimestamp(c.end)
    if (start == null) return
    start = snapStart(start)
    end = end == null || end <= start ? start + brief.clipLengthSeconds.max : snapEnd(end)
    if (end - start > brief.clipLengthSeconds.max * 1.5) end = start + brief.clipLengthSeconds.max
    if (total) end = Math.min(end, total)
    if (end - start < 5) return
    if (out.some((o) => start < o.end && end > o.start)) return // overlaps a stronger clip
    out.push({
      id: `clip-${Date.now().toString(36)}-${i}`,
      title: String(c.title || `Clip ${i + 1}`),
      start,
      end,
      topic: String(c.topic || ''),
      hookType: HOOK_TYPES.includes(c.hookType) ? c.hookType : 'bold claim',
      hookScore: Math.min(10, Math.max(1, Math.round(Number(c.hookScore) || 5))),
      quote: String(c.quote || ''),
      reason: String(c.reason || ''),
      keep: true,
    })
  })
  return out
}

export const clipDuration = (clip) => Math.round(clip.end - clip.start)
