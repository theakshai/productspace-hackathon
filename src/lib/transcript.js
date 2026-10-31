import { generateJSON, mediaPart } from './gemini.js'

// "12:34" → 754, "1:02:03" → 3723, 75 → 75. Returns null if it can't be read.
export function parseTimestamp(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  const parts = String(value || '')
    .trim()
    .replace(/[^\d:.]/g, '')
    .split(':')
    .filter((p) => p !== '')
  if (!parts.length || parts.length > 3) return null
  const nums = parts.map(Number)
  if (nums.some((n) => !Number.isFinite(n))) return null
  return nums.reduce((total, n) => total * 60 + n, 0)
}

export function formatTimestamp(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return '–'
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

const TRANSCRIPT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'A short descriptive title for this episode.' },
    durationSeconds: { type: 'INTEGER', description: 'Total length of the media in seconds.' },
    speakers: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'Short id used in segments, e.g. S1' },
          name: { type: 'STRING', description: 'Real name if said or shown on screen, else "Speaker 1"' },
          role: { type: 'STRING', description: 'e.g. host, guest' },
        },
        required: ['id', 'name'],
      },
    },
    segments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          start: { type: 'STRING', description: 'Start time as M:SS or H:MM:SS from the beginning of the media' },
          end: { type: 'STRING', description: 'End time as M:SS or H:MM:SS' },
          speaker: { type: 'STRING', description: 'Speaker id from speakers' },
          text: { type: 'STRING' },
        },
        required: ['start', 'speaker', 'text'],
      },
    },
    topics: {
      type: 'ARRAY',
      description: 'The 4–8 main topics discussed, in order.',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          start: { type: 'STRING', description: 'When the topic starts, M:SS or H:MM:SS' },
          summary: { type: 'STRING', description: 'One sentence.' },
        },
        required: ['title', 'start', 'summary'],
      },
    },
  },
  required: ['title', 'speakers', 'segments', 'topics'],
}

const SYSTEM = `You are a professional podcast transcriber.

Transcribe the spoken audio of the media from start to finish. Rules:
- Cover the WHOLE media. Do not skip or summarise any part.
- Clean verbatim: drop filler sounds (um, uh, you know) and false starts, but keep every real sentence and the speaker's own words.
- One segment per speaker turn. Split turns longer than about 30 seconds into several segments.
- Timestamps are measured from the very start of the media, as M:SS (or H:MM:SS past an hour). They must be accurate and increase through the transcript.
- Identify speakers by their real names when they are said or shown; otherwise use "Speaker 1", "Speaker 2". Keep the same id for the same person.
- Write the transcript in the language spoken. If several languages are mixed, write each sentence as spoken.`

export async function generateTranscript({ apiKey, model, media, signal }) {
  const raw = await generateJSON({
    apiKey,
    model,
    system: SYSTEM,
    schema: TRANSCRIPT_SCHEMA,
    temperature: 0.1,
    signal,
    // Low video resolution: we only need the audio and a glance at the picture. Saves tokens and time.
    config: { mediaResolution: 'MEDIA_RESOLUTION_LOW', maxOutputTokens: 65536 },
    parts: [mediaPart(media), { text: 'Transcribe this podcast following the rules.' }],
  })
  return normalizeTranscript(raw)
}

const SPEAKER_COLORS = ['#ff8a65', '#64b5f6', '#81c784', '#ba68c8', '#ffd54f', '#4dd0e1']

export function normalizeTranscript(raw) {
  const speakers = (raw.speakers || [])
    .filter((s) => s?.id)
    .map((s, i) => ({ id: String(s.id), name: String(s.name || `Speaker ${i + 1}`), role: s.role || '', color: SPEAKER_COLORS[i % SPEAKER_COLORS.length] }))

  const known = new Set(speakers.map((s) => s.id))
  const segments = (raw.segments || [])
    .map((seg) => ({
      start: parseTimestamp(seg.start),
      end: parseTimestamp(seg.end),
      speaker: String(seg.speaker || ''),
      text: String(seg.text || '').trim(),
    }))
    .filter((seg) => seg.text && seg.start != null)
    .sort((a, b) => a.start - b.start)

  // Any speaker id used in segments but missing from the list gets added.
  for (const seg of segments) {
    if (!known.has(seg.speaker)) {
      known.add(seg.speaker)
      speakers.push({ id: seg.speaker, name: seg.speaker || 'Unknown', role: '', color: SPEAKER_COLORS[speakers.length % SPEAKER_COLORS.length] })
    }
  }
  // Fill missing end times from the next segment's start.
  segments.forEach((seg, i) => {
    const next = segments[i + 1]
    if (seg.end == null || seg.end <= seg.start) seg.end = next ? next.start : seg.start + 10
  })

  const topics = (raw.topics || [])
    .map((t) => ({ title: String(t.title || ''), start: parseTimestamp(t.start), summary: String(t.summary || '') }))
    .filter((t) => t.title && t.start != null)
    .sort((a, b) => a.start - b.start)

  const last = segments[segments.length - 1]
  return {
    title: String(raw.title || ''),
    durationSeconds: Number.isFinite(raw.durationSeconds) ? raw.durationSeconds : last ? last.end : null,
    speakers,
    segments,
    topics,
    createdAt: new Date().toISOString(),
  }
}

export function transcriptToText(transcript) {
  const names = Object.fromEntries(transcript.speakers.map((s) => [s.id, s.name]))
  return transcript.segments.map((s) => `[${formatTimestamp(s.start)}] ${names[s.speaker] || s.speaker}: ${s.text}`).join('\n')
}
