// F9 performance feedback loop: what worked, why, and how it changes the next suggestions.
import { platformLabel } from './brief.js'
import { clipDuration } from './clips.js'
import { generateJSON } from './gemini.js'

export const METRICS = ['views', 'likes', 'comments', 'saves']

// Saves count double: they signal "I want this again", the strongest short-form signal.
export function engagement(m) {
  if (!m?.views) return 0
  return (Number(m.likes || 0) + Number(m.comments || 0) * 2 + Number(m.saves || 0) * 2) / Number(m.views)
}

const lengthBucket = (sec) => (sec < 40 ? 'under 40s' : sec <= 55 ? '40–55s' : 'over 55s')
const pct = (x) => `${(x * 100).toFixed(1)}%`

function groupStats(rows, keyFn) {
  const groups = {}
  for (const r of rows) {
    const k = keyFn(r)
    groups[k] ||= { key: k, n: 0, views: 0, eng: 0 }
    groups[k].n++
    groups[k].views += r.metrics.views
    groups[k].eng += r.eng
  }
  return Object.values(groups).map((g) => ({ ...g, avgViews: g.views / g.n, avgEng: g.eng / g.n }))
}

// Turns raw numbers into findings. Each finding compares a group with the average,
// so "2.1×" always means "compared with your other posts".
export function analyze({ posts, clipsById, metrics }) {
  const rows = posts
    .filter((p) => metrics[p.id]?.views > 0 && clipsById[p.clipId])
    .map((p) => {
      const clip = clipsById[p.clipId]
      return { post: p, clip, metrics: metrics[p.id], eng: engagement(metrics[p.id]), score: engagement(metrics[p.id]) * Math.sqrt(metrics[p.id].views) }
    })
  if (rows.length < 2) return { rows, findings: [], learnings: [], hookLift: {}, enough: false }

  const avgScore = rows.reduce((s, r) => s + r.score, 0) / rows.length
  const lift = (g) => g / avgScore
  const scoreBy = (keyFn) =>
    groupStats(rows, keyFn).map((g) => {
      const members = rows.filter((r) => keyFn(r) === g.key)
      return { ...g, lift: lift(members.reduce((s, r) => s + r.score, 0) / members.length) }
    })

  const byHook = scoreBy((r) => r.clip.hookType).sort((a, b) => b.lift - a.lift)
  const byPlatform = scoreBy((r) => r.post.platform).sort((a, b) => b.avgViews - a.avgViews)
  const byLength = scoreBy((r) => lengthBucket(clipDuration(r.clip))).sort((a, b) => b.lift - a.lift)
  const best = [...rows].sort((a, b) => b.score - a.score)[0]

  const findings = []
  const learnings = []
  const top = byHook[0]
  const bottom = byHook[byHook.length - 1]
  if (top && top.lift > 1.15) {
    findings.push({ kind: 'up', title: `“${top.key}” hooks win`, detail: `${top.lift.toFixed(1)}× your average result across ${top.n} post${top.n > 1 ? 's' : ''} (${pct(top.avgEng)} engagement).` })
    learnings.push(`Favour ${top.key} hooks: they performed ${top.lift.toFixed(1)}× better than average.`)
  }
  if (bottom && bottom !== top && bottom.lift < 0.85) {
    findings.push({ kind: 'down', title: `“${bottom.key}” hooks lag`, detail: `${bottom.lift.toFixed(1)}× your average across ${bottom.n} post${bottom.n > 1 ? 's' : ''}.` })
    learnings.push(`Pick fewer ${bottom.key} moments: they performed ${bottom.lift.toFixed(1)}× average.`)
  }
  if (byPlatform.length > 1) {
    const [a, b] = byPlatform
    findings.push({ kind: 'info', title: `${platformLabel(a.key)} gets the reach`, detail: `${Math.round(a.avgViews).toLocaleString()} average views vs ${Math.round(b.avgViews).toLocaleString()} on ${platformLabel(b.key)}.` })
    learnings.push(`${platformLabel(a.key)} brings the most reach; give it the strongest clips first.`)
  }
  if (byLength.length > 1 && byLength[0].lift > 1.1) {
    findings.push({ kind: 'info', title: `${byLength[0].key} clips do best`, detail: `${byLength[0].lift.toFixed(1)}× average.` })
    learnings.push(`Clips ${byLength[0].key} performed best.`)
  }
  findings.unshift({ kind: 'star', title: `Top post: ${best.clip.title}`, detail: `${platformLabel(best.post.platform)} · ${best.metrics.views.toLocaleString()} views · ${pct(best.eng)} engagement.` })

  const hookLift = Object.fromEntries(byHook.map((g) => [g.key, g.lift]))
  return { rows, findings, learnings, hookLift, enough: true }
}

// Re-ranks the current clips with what was learned, so the change is visible right away.
export function rerank(clips, hookLift) {
  const before = [...clips].sort((a, b) => b.hookScore - a.hookScore)
  const after = clips
    .map((c) => {
      const l = hookLift[c.hookType] ?? 1
      return { ...c, adjusted: Math.round(c.hookScore * Math.min(1.5, Math.max(0.6, l)) * 10) / 10, lift: l }
    })
    .sort((a, b) => b.adjusted - a.adjusted)
  return after.map((c, i) => ({ clip: c, rank: i + 1, was: before.findIndex((b) => b.id === c.id) + 1 }))
}

const SPEECH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    entries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          postId: { type: 'STRING' },
          views: { type: 'INTEGER' },
          likes: { type: 'INTEGER' },
          comments: { type: 'INTEGER' },
          saves: { type: 'INTEGER' },
        },
        required: ['postId'],
      },
    },
    notes: { type: 'STRING', description: 'Anything you could not match, in one short sentence. Empty if all matched.' },
  },
  required: ['entries', 'notes'],
}

// "The robots one on Reels got twelve k views, around 400 likes and 90 saves" -> numbers on the right post.
export async function metricsFromSpeech({ apiKey, model, speech, posts, clipsById, signal }) {
  const list = posts
    .map((p) => `${p.id}: "${clipsById[p.clipId]?.title}" on ${platformLabel(p.platform)}, ${p.date}`)
    .join('\n')
  const out = await generateJSON({
    apiKey,
    model,
    signal,
    temperature: 0.1,
    schema: SPEECH_SCHEMA,
    system:
      'You turn a creator\'s spoken performance update into numbers. Match each mention to the right post by clip title, topic and platform. Convert spoken numbers ("twelve k" = 12000, "one point two million" = 1200000). Only include metrics that were said. Never invent numbers.',
    parts: [{ text: `POSTS\n${list}\n\nWHAT THE CREATOR SAID\n${speech}` }],
  })
  const ids = new Set(posts.map((p) => p.id))
  return { entries: (out.entries || []).filter((e) => ids.has(e.postId)), notes: out.notes || '' }
}
