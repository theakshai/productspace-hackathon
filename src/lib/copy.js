import { DEFAULT_BRIEF } from './clips.js'
import { generateJSON } from './gemini.js'

// What each platform needs, with the platform's own length limits.
export const PLATFORM_FIELDS = {
  youtube_shorts: [
    { key: 'title', label: 'Title', limit: 100, rows: 1, hint: 'Under 60 characters works best. Hook first.' },
    { key: 'description', label: 'Description', limit: 5000, rows: 4, hint: '2–3 lines, end with #shorts and a pointer to the full episode.' },
  ],
  instagram_reels: [
    { key: 'caption', label: 'Caption', limit: 2200, rows: 5, hint: 'Hook in the first line (only ~125 characters show before "more").' },
    { key: 'hashtags', label: 'Hashtags', limit: 30, rows: 2, unit: 'tags', hint: '8–15 tags, mix of broad and niche.' },
  ],
  linkedin: [{ key: 'post', label: 'Post', limit: 3000, rows: 8, hint: 'Strong first two lines, short paragraphs, one takeaway, a question to end.' }],
  x: [{ key: 'post', label: 'Post', limit: 280, rows: 3, hint: 'One punchy line plus the hook. No hashtag spam.' }],
}

export const countFor = (field, value) =>
  field.unit === 'tags' ? (String(value || '').match(/#[\p{L}\p{N}_]+/gu) || []).length : String(value || '').length

const FIELD_SCHEMA = {
  youtube_shorts: { title: 'Shorts title', description: 'Shorts description' },
  instagram_reels: { caption: 'Reels caption without hashtags', hashtags: 'Hashtags as one string, e.g. "#ai #careers"' },
  linkedin: { post: 'LinkedIn post' },
  x: { post: 'X post, max 280 characters' },
}

function schemaFor(platforms) {
  const platformProps = {}
  for (const p of platforms) {
    const fields = FIELD_SCHEMA[p]
    platformProps[p] = {
      type: 'OBJECT',
      properties: Object.fromEntries(Object.entries(fields).map(([k, d]) => [k, { type: 'STRING', description: d }])),
      required: Object.keys(fields),
    }
  }
  return {
    type: 'OBJECT',
    properties: {
      posts: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { clipId: { type: 'STRING' }, ...platformProps },
          required: ['clipId', ...platforms],
        },
      },
    },
    required: ['posts'],
  }
}

const SYSTEM = `You are a social media copywriter for podcast creators. You write native copy for each platform, never one text pasted everywhere.

Platform rules:
- YouTube Shorts: title under 60 characters that creates curiosity; description 2–3 short lines, then "#shorts" and a pointer to the full episode.
- Instagram Reels: the first line is the hook; short lines; a soft call to action (save / follow / comment). Hashtags separate: 8–15, relevant, mix broad and niche.
- LinkedIn: professional but human; first two lines must earn the "see more" click; short paragraphs; one clear takeaway; end with a question. 3 hashtags max.
- X: under 280 characters; one sharp idea; at most one hashtag.

Always:
- Base every claim on what is actually said in the clip. Never invent facts, numbers or quotes.
- Credit the speaker by name when quoting them.
- Match the tone and audience from the brief.
- Follow every brand voice rule exactly; they override the platform rules above.`

function clipText(transcript, clip) {
  const names = Object.fromEntries(transcript.speakers.map((s) => [s.id, s.name]))
  return transcript.segments
    .filter((s) => s.end > clip.start && s.start < clip.end)
    .map((s) => `${names[s.speaker] || s.speaker}: ${s.text}`)
    .join('\n')
}

export function platformsFor(brief) {
  const list = (brief?.platforms?.length ? brief.platforms : DEFAULT_BRIEF.platforms).filter((p) => PLATFORM_FIELDS[p])
  return list.length ? list : Object.keys(PLATFORM_FIELDS)
}

export async function writeCopy({ apiKey, model, transcript, clips, brief, brandRules = [], episodeTitle, signal }) {
  const platforms = platformsFor(brief)
  const b = brief || DEFAULT_BRIEF
  const parts = [
    {
      text: `BRIEF\nAudience: ${b.audience}\nGoal: ${b.goal}\nTone: ${b.tone.join(', ') || 'conversational'}\nEpisode: ${episodeTitle || 'podcast episode'}`,
    },
    {
      text: brandRules.length
        ? `BRAND VOICE RULES (must follow)\n- ${brandRules.join('\n- ')}`
        : 'BRAND VOICE RULES\nNone yet.',
    },
    ...clips.map((c) => ({
      text: `CLIP id=${c.id}\nTitle: ${c.title}\nWhy it was picked: ${c.reason}\nKey line: ${c.quote}\nTranscript:\n${clipText(transcript, c)}`,
    })),
    { text: `Write copy for these platforms only: ${platforms.join(', ')}. One entry in "posts" per clip, with the same clipId.` },
  ]
  const raw = await generateJSON({ apiKey, model, system: SYSTEM, schema: schemaFor(platforms), temperature: 0.8, signal, parts })
  const byClip = {}
  for (const post of raw.posts || []) {
    const clip = clips.find((c) => c.id === post.clipId)
    if (!clip) continue
    const content = {}
    for (const p of platforms) {
      content[p] = {}
      for (const f of PLATFORM_FIELDS[p]) content[p][f.key] = String(post[p]?.[f.key] || '').trim()
    }
    byClip[clip.id] = { platforms: content, original: structuredClone(content), edits: [] }
  }
  // Fall back to matching by order if the model mangled the ids.
  if (!Object.keys(byClip).length && raw.posts?.length) {
    raw.posts.slice(0, clips.length).forEach((post, i) => {
      const content = {}
      for (const p of platforms) {
        content[p] = {}
        for (const f of PLATFORM_FIELDS[p]) content[p][f.key] = String(post[p]?.[f.key] || '').trim()
      }
      byClip[clips[i].id] = { platforms: content, original: structuredClone(content), edits: [] }
    })
  }
  return { platforms, byClip }
}
