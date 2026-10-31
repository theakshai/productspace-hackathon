import { useMemo, useState } from 'react'
import { platformLabel } from '../lib/brief.js'
import { PLATFORM_COLOR, autoSchedule, buildIcs, calendarDays, fromISODate, postText, toISODate } from '../lib/calendar.js'
import { downloadText } from '../lib/srt.js'
import { formatTimestamp } from '../lib/transcript.js'

const DAY_FMT = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const SHORT = { linkedin: 'LinkedIn', instagram_reels: 'Reels', youtube_shorts: 'Shorts', x: 'X' }

function PostCard({ post, clip, selected, onSelect }) {
  return (
    <button
      className={`post-card ${selected ? 'selected' : ''} ${post.status === 'posted' ? 'posted' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', post.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onClick={() => onSelect(post.id)}
      style={{ borderLeftColor: PLATFORM_COLOR[post.platform] }}
      data-testid="post-card"
      data-post={post.id}
      title="Drag to another day, or click to edit"
    >
      <span className="post-meta">
        <span className="post-dot" style={{ background: PLATFORM_COLOR[post.platform] }} />
        {post.time} · {SHORT[post.platform] || platformLabel(post.platform)}
        {post.status === 'posted' ? ' ✓' : ''}
      </span>
      <span className="post-title">{clip?.title || 'Clip'}</span>
    </button>
  )
}

export default function CalendarPanel({ media, clips, copy, schedule, onScheduleChange, onGoCopy, onNext }) {
  const [selected, setSelected] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const todayIso = toISODate(new Date())

  const kept = (clips?.items || []).filter((c) => c.keep)
  const clipsById = Object.fromEntries(kept.map((c) => [c.id, c]))
  const platforms = copy?.platforms || []
  const posts = (schedule?.posts || []).filter((p) => clipsById[p.clipId])

  // Show whole weeks from this Monday until the last scheduled post (at least two weeks, at most six).
  const lastDate = posts.reduce((max, p) => (p.date > max ? p.date : max), todayIso)
  const days = useMemo(() => {
    const first = calendarDays(new Date(), 1)[0]
    const span = Math.round((fromISODate(lastDate) - first) / 86400000) + 1
    return calendarDays(new Date(), Math.min(6, Math.max(2, Math.ceil(span / 7))))
  }, [lastDate])

  function plan() {
    onScheduleChange({ mediaUri: media.gemini.uri, posts: autoSchedule({ clips: kept, platforms }), createdAt: new Date().toISOString() })
    setSelected(null)
  }

  const update = (id, patch) =>
    onScheduleChange((prev) => ({ ...prev, posts: prev.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const remove = (id) => {
    onScheduleChange((prev) => ({ ...prev, posts: prev.posts.filter((p) => p.id !== id) }))
    setSelected(null)
  }

  function exportIcs() {
    const ics = buildIcs({ posts, clipsById, copy, platformLabel, sourceUrl: media?.url })
    downloadText('clipcraft-content-calendar.ics', ics, 'text/calendar')
  }

  if (!kept.length || !copy) {
    return (
      <div className="placeholder">
        <span className="tag">Step 6 · Calendar</span>
        <h2>Write captions first</h2>
        <p className="muted">The calendar schedules your kept clips with their captions on each platform.</p>
        <button className="btn primary" onClick={onGoCopy}>
          Go to captions
        </button>
      </div>
    )
  }

  const sel = posts.find((p) => p.id === selected)
  const selClip = sel && clipsById[sel.clipId]
  const outside = posts.filter((p) => !days.some((d) => toISODate(d) === p.date))

  return (
    <div className="calendar-panel">
      <div className="row between top">
        <div>
          <span className="tag">Step 6 · Calendar</span>
          <h2>Content calendar</h2>
          <p className="muted">
            {posts.length ? `${posts.length} posts scheduled. ` : ''}Drag a post to another day, or click it to change
            the time. Export to Google Calendar, Outlook or Apple Calendar with the caption inside each event.
          </p>
        </div>
        <div className="row">
          {posts.length > 0 && (
            <button className="btn" onClick={exportIcs}>
              ⬇ Export .ics
            </button>
          )}
          <button className={`btn ${posts.length ? '' : 'primary'}`} onClick={plan}>
            {posts.length ? 'Re-plan' : 'Auto-schedule'}
          </button>
        </div>
      </div>

      {!posts.length ? (
        <div className="empty">
          <p className="muted">
            Click <strong>Auto-schedule</strong>. ClipCraft spreads {kept.length} clips × {platforms.length} platforms over the next
            two weeks, strongest clips first, each platform at its usual best time.
          </p>
        </div>
      ) : (
        <div className="calendar-layout">
          <div className="cal-grid" data-testid="cal-grid">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="cal-head">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const iso = toISODate(d)
              const dayPosts = posts.filter((p) => p.date === iso).sort((a, b) => (a.time < b.time ? -1 : 1))
              const past = iso < todayIso
              return (
                <div
                  key={iso}
                  className={`cal-day ${iso === todayIso ? 'today' : ''} ${past ? 'past' : ''} ${dragOver === iso ? 'over' : ''}`}
                  data-date={iso}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(iso)
                  }}
                  onDragLeave={() => setDragOver((x) => (x === iso ? null : x))}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(null)
                    const id = e.dataTransfer.getData('text/plain')
                    if (id) update(id, { date: iso })
                  }}
                >
                  <div className="cal-date">{DAY_FMT.format(d)}</div>
                  {dayPosts.map((p) => (
                    <PostCard key={p.id} post={p} clip={clipsById[p.clipId]} selected={p.id === selected} onSelect={setSelected} />
                  ))}
                </div>
              )
            })}
          </div>

          <aside className="post-detail" data-testid="post-detail">
            {sel ? (
              <>
                <h3>{selClip.title}</h3>
                <p className="muted small">
                  {platformLabel(sel.platform)} · clip {formatTimestamp(selClip.start)}–{formatTimestamp(selClip.end)}
                </p>
                <div className="grid-2 tight">
                  <label className="field">
                    <span>Date</span>
                    <input type="date" value={sel.date} onChange={(e) => e.target.value && update(sel.id, { date: e.target.value })} />
                  </label>
                  <label className="field">
                    <span>Time</span>
                    <input type="time" value={sel.time} onChange={(e) => e.target.value && update(sel.id, { time: e.target.value })} />
                  </label>
                </div>
                <div className="field">
                  <span>Caption</span>
                  <pre className="caption-preview">{postText(copy.byClip[sel.clipId], sel.platform) || 'No caption for this platform yet.'}</pre>
                </div>
                <div className="row between">
                  <button className="link" onClick={() => remove(sel.id)}>
                    Remove from calendar
                  </button>
                  <button
                    className={`btn small ${sel.status === 'posted' ? '' : 'primary'}`}
                    onClick={() => update(sel.id, { status: sel.status === 'posted' ? 'scheduled' : 'posted' })}
                  >
                    {sel.status === 'posted' ? '↶ Mark as not posted' : '✓ Mark as posted'}
                  </button>
                </div>
              </>
            ) : (
              <p className="muted small">Click a post to see its caption, change its date or time, or mark it as posted.</p>
            )}
            {outside.length > 0 && <p className="muted small">{outside.length} post(s) are scheduled outside these two weeks.</p>}
          </aside>
        </div>
      )}

      {posts.length > 0 && (
        <div className="row end">
          <button className="btn primary" onClick={onNext}>
            Next: performance →
          </button>
        </div>
      )}
    </div>
  )
}
