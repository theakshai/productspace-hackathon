// Builds an .srt subtitle file for one clip from the transcript, with times relative to the clip start.

const MAX_LINE = 42 // characters per subtitle line (broadcast standard)

function srtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
  const r = String(ms % 1000).padStart(3, '0')
  return `${h}:${m}:${s},${r}`
}

// Splits text into lines of at most MAX_LINE characters, then pairs them into two-line cues.
function chunk(text) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > MAX_LINE) {
      lines.push(cur)
      cur = w
    } else cur = cur ? cur + ' ' + w : w
  }
  if (cur) lines.push(cur)
  const cues = []
  for (let i = 0; i < lines.length; i += 2) cues.push(lines.slice(i, i + 2).join('\n'))
  return cues
}

export function buildSrt(transcript, clip) {
  const cues = []
  for (const seg of transcript.segments) {
    if (seg.end <= clip.start || seg.start >= clip.end) continue
    const segLen = Math.max(0.5, seg.end - seg.start)
    const from = Math.max(seg.start, clip.start)
    const to = Math.min(seg.end, clip.end)
    // If the segment is cut by the clip edges, keep the matching share of its words.
    const words = seg.text.split(/\s+/).filter(Boolean)
    const firstWord = Math.floor(((from - seg.start) / segLen) * words.length)
    const lastWord = Math.ceil(((to - seg.start) / segLen) * words.length)
    const text = words.slice(firstWord, Math.max(firstWord + 1, lastWord)).join(' ')
    const pieces = chunk(text)
    const total = pieces.reduce((n, p) => n + p.length, 0) || 1
    let t = from
    for (const p of pieces) {
      const dur = ((to - from) * p.length) / total
      cues.push({ start: t - clip.start, end: t + dur - clip.start, text: p })
      t += dur
    }
  }
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n')
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export const safeFilename = (s) => String(s || 'clip').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'clip'
