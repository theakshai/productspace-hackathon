// Content calendar: auto-scheduling, date helpers and .ics export. No AI needed here.

// Common best-practice posting slots (local time). Good defaults the creator can move.
export const BEST_TIME = { linkedin: '09:00', instagram_reels: '19:00', youtube_shorts: '18:00', x: '12:30' }
export const PLATFORM_COLOR = { linkedin: '#0a66c2', instagram_reels: '#e1306c', youtube_shorts: '#ff0000', x: '#9aa1b2' }

export const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function fromISODate(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6

// The 14 days shown in the grid, starting on the Monday of this week.
export function calendarDays(today = new Date(), weeks = 2) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const offset = (start.getDay() + 6) % 7 // days since Monday
  const monday = addDays(start, -offset)
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(monday, i))
}

// Spreads every kept clip × platform over the next 14 days, strongest clips first.
// Each platform posts at most once a day; LinkedIn skips weekends; the same clip lands on
// different platforms on neighbouring days so the feed doesn't repeat itself.
export function autoSchedule({ clips, platforms, today = new Date(), days = 14 }) {
  const ordered = [...clips].sort((a, b) => (b.hookScore || 0) - (a.hookScore || 0))
  const start = addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate()), 1)
  const gap = Math.max(1, Math.floor(days / Math.max(1, ordered.length)))
  const taken = new Set() // `${platform}|${date}`
  const posts = []
  ordered.forEach((clip, i) => {
    platforms.forEach((platform, p) => {
      let offset = Math.min(days - 1, i * gap + (p % gap))
      let date = addDays(start, offset)
      // Find the next free, allowed day for this platform.
      for (let tries = 0; tries < days; tries++) {
        const key = `${platform}|${toISODate(date)}`
        if (!taken.has(key) && !(platform === 'linkedin' && isWeekend(date))) break
        offset = (offset + 1) % days
        date = addDays(start, offset)
      }
      taken.add(`${platform}|${toISODate(date)}`)
      posts.push({
        id: `post-${clip.id}-${platform}`,
        clipId: clip.id,
        platform,
        date: toISODate(date),
        time: BEST_TIME[platform] || '12:00',
        status: 'scheduled',
      })
    })
  })
  return posts.sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
}

// Text of the post as it will be published, used in the calendar detail and the .ics file.
export function postText(copyEntry, platform) {
  const f = copyEntry?.platforms?.[platform]
  if (!f) return ''
  if (platform === 'youtube_shorts') return [f.title, f.description].filter(Boolean).join('\n\n')
  if (platform === 'instagram_reels') return [f.caption, f.hashtags].filter(Boolean).join('\n\n')
  return f.post || ''
}

const icsEscape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsStamp = (date, time) => `${date.replace(/-/g, '')}T${time.replace(':', '')}00`

// Builds an iCalendar file. Times are "floating", so each calendar shows them in the user's local time.
export function buildIcs({ posts, clipsById, copy, platformLabel, sourceUrl }) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ClipCraft//Content Calendar//EN', 'CALSCALE:GREGORIAN']
  for (const post of posts) {
    const clip = clipsById[post.clipId]
    if (!clip) continue
    const [h, m] = post.time.split(':').map(Number)
    const endMin = h * 60 + m + 15
    const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
    const body = [
      postText(copy?.byClip?.[clip.id], post.platform),
      '',
      `Clip: ${clip.title}`,
      sourceUrl ? `Source: ${sourceUrl}&t=${Math.floor(clip.start)}s` : '',
    ]
      .filter((x) => x !== null)
      .join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${post.id}-${post.date}@clipcraft`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsStamp(post.date, post.time)}`,
      `DTEND:${icsStamp(post.date, end)}`,
      `SUMMARY:${icsEscape(`Post on ${platformLabel(post.platform)}: ${clip.title}`)}`,
      `DESCRIPTION:${icsEscape(body)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(`Time to post "${clip.title}"`)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
