import { useEffect, useState } from 'react'
import BrandPanel from './components/BrandPanel.jsx'
import CalendarPanel from './components/CalendarPanel.jsx'
import ClipsPanel from './components/ClipsPanel.jsx'
import CopyPanel from './components/CopyPanel.jsx'
import PerformancePanel from './components/PerformancePanel.jsx'
import Settings from './components/Settings.jsx'
import TranscriptPanel from './components/TranscriptPanel.jsx'
import UploadPanel from './components/UploadPanel.jsx'
import { DEMO_BRAND_RULES, buildDemo } from './lib/demo.js'
import { load, save } from './lib/storage.js'

// Each step maps to a feature in features.md. Steps unlock as features ship.
const STEPS = [
  { id: 'upload', label: 'Upload', feature: 'F1', blurb: 'A YouTube link or a 10–20 minute podcast file.' },
  { id: 'transcript', label: 'Transcript', feature: 'F3', blurb: 'Timestamped, speaker-labelled transcript.' },
  { id: 'clips', label: 'Clips', feature: 'F4', blurb: 'Say what you want; get the best moments, each with a reason.' },
  { id: 'copy', label: 'Copy', feature: 'F5–F6', blurb: 'Captions and posts for every platform. Edit by voice.' },
  { id: 'brand', label: 'Brand voice', feature: 'F7', blurb: 'Rules learned from your edits.' },
  { id: 'calendar', label: 'Calendar', feature: 'F8', blurb: 'When and where each clip goes out.' },
  { id: 'performance', label: 'Performance', feature: 'F9', blurb: 'What worked, and how suggestions changed.' },
]

function Placeholder({ step }) {
  return (
    <div className="placeholder">
      <span className="tag">{step.feature}</span>
      <h2>{step.label}</h2>
      <p className="muted">{step.blurb}</p>
      <p className="hint">Coming in {step.feature}.</p>
    </div>
  )
}

// The File object and its preview URL only live in memory; everything else is saved.
function persistableMedia(media) {
  if (!media) return null
  const { file: _file, previewUrl: _url, ...rest } = media
  return rest
}

function restoreMedia() {
  const saved = load('media', null)
  if (!saved) return null
  // Gemini deletes uploaded files after 48 hours.
  if (saved.gemini?.expiresAt && new Date(saved.gemini.expiresAt) < new Date()) {
    return { ...saved, gemini: null }
  }
  return saved
}

export default function App() {
  const [active, setActive] = useState('upload')
  const [settings, setSettings] = useState(() => load('settings', { apiKey: '', model: '' }))
  const [media, setMedia] = useState(restoreMedia)
  const [speech, setSpeech] = useState(() => load('speech', ''))
  const [brief, setBrief] = useState(() => load('brief', null))
  const [transcript, setTranscript] = useState(() => load('transcript', null))
  const [clips, setClips] = useState(() => load('clips', null))
  const [copy, setCopy] = useState(() => load('copy', null))
  const [schedule, setSchedule] = useState(() => load('schedule', null))
  const [performance, setPerformance] = useState(() => load('performance', null))
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => save('settings', settings), [settings])
  useEffect(() => save('media', persistableMedia(media)), [media])
  useEffect(() => save('speech', speech), [speech])
  useEffect(() => save('brief', brief), [brief])
  useEffect(() => save('transcript', transcript), [transcript])
  useEffect(() => save('clips', clips), [clips])
  useEffect(() => save('copy', copy), [copy])
  useEffect(() => save('schedule', schedule), [schedule])
  useEffect(() => save('performance', performance), [performance])

  // Release a local file's preview URL once it is replaced. Lives here (not in a panel)
  // so the preview keeps working while you move between steps.
  useEffect(() => {
    const url = media?.previewUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [media?.previewUrl])

  // Transcript and clips belong to one podcast: ignore them when the podcast changes.
  const mediaUri = media?.gemini?.uri || null
  const currentTranscript = transcript && transcript.mediaUri === mediaUri ? transcript : null
  const currentClips = clips && clips.mediaUri === mediaUri && currentTranscript ? clips : null
  const currentCopy = copy && copy.mediaUri === mediaUri && currentClips ? copy : null
  const currentSchedule = schedule && schedule.mediaUri === mediaUri && currentCopy ? schedule : null
  const currentPerformance = performance && performance.mediaUri === mediaUri ? performance : null

  const done = {
    upload: Boolean(media?.gemini),
    transcript: Boolean(currentTranscript),
    clips: Boolean(currentClips?.items.some((c) => c.keep)),
    copy: Boolean(currentCopy),
    brand: Boolean(settings.brandRules?.length),
    calendar: Boolean(currentSchedule?.posts?.length),
    performance: Boolean(settings.learnings?.length),
  }

  const step = STEPS.find((s) => s.id === active)
  const openSettings = () => setShowSettings(true)
  // source: 'voice' (voice edit feedback), 'edits' (learned from typed edits), 'said' (taught by voice), 'typed'
  const addBrandRules = (rules, source = 'voice') =>
    setSettings((s) => {
      const existing = s.brandRules || []
      const lower = new Set(existing.map((r) => r.toLowerCase()))
      const fresh = rules.filter((r) => !lower.has(r.toLowerCase()))
      const ruleSources = { ...(s.ruleSources || {}) }
      for (const r of fresh) ruleSources[r] = source
      return { ...s, brandRules: [...existing, ...fresh], ruleSources }
    })
  // F10: one click loads a fully processed podcast with sample performance numbers. Keeps the API key.
  function loadDemo() {
    const d = buildDemo()
    setMedia(d.media)
    setSpeech(d.speech)
    setBrief(d.brief)
    setTranscript(d.transcript)
    setClips(d.clips)
    setCopy(d.copy)
    setSchedule(d.schedule)
    setPerformance(d.performance)
    setSettings((s) => ({
      ...s,
      brandRules: DEMO_BRAND_RULES.map(([r]) => r),
      ruleSources: Object.fromEntries(DEMO_BRAND_RULES),
      learnings: [],
    }))
    setActive('clips')
  }
  const setBrandRules = (brandRules, ruleSources) => setSettings((s) => ({ ...s, brandRules, ruleSources }))

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">✂</span>
          <span className="name">ClipCraft</span>
          <span className="tagline">One podcast in. A week of content out.</span>
        </div>
        <div className="row">
          <span className="voice-pill" title="All input in ClipCraft is designed for Wispr Flow dictation">
            🎙 Built for Wispr Flow
          </span>
          <button className="btn small demo-btn" onClick={loadDemo} title="Load a processed podcast with sample results. No API key needed.">
            ▶ Load demo
          </button>
          <button className="btn small" onClick={openSettings}>
            ⚙ Settings{settings.apiKey ? '' : ' · add key'}
          </button>
        </div>
      </header>

      <div className="layout">
        <nav className="steps" aria-label="Workflow steps">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`step ${s.id === active ? 'active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              <span className="step-num">{done[s.id] ? '✓' : i + 1}</span>
              <span className="step-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <main className="panel">
          {active === 'upload' ? (
            <UploadPanel
              settings={settings}
              media={media}
              onMediaChange={setMedia}
              onOpenSettings={openSettings}
              onNext={() => setActive('transcript')}
            />
          ) : active === 'transcript' ? (
            <TranscriptPanel
              settings={settings}
              media={media}
              transcript={currentTranscript}
              onTranscriptChange={setTranscript}
              onOpenSettings={openSettings}
              onGoUpload={() => setActive('upload')}
              onNext={() => setActive('clips')}
            />
          ) : active === 'clips' ? (
            <ClipsPanel
              settings={settings}
              media={media}
              transcript={currentTranscript}
              speech={speech}
              onSpeechChange={setSpeech}
              brief={brief}
              onBriefChange={setBrief}
              clips={currentClips}
              onClipsChange={setClips}
              onOpenSettings={openSettings}
              onGoTranscript={() => setActive('transcript')}
              onNext={() => setActive('copy')}
            />
          ) : active === 'copy' ? (
            <CopyPanel
              settings={settings}
              media={media}
              transcript={currentTranscript}
              clips={currentClips}
              brief={brief}
              copy={currentCopy}
              onCopyChange={setCopy}
              onAddBrandRules={addBrandRules}
              onOpenSettings={openSettings}
              onGoClips={() => setActive('clips')}
              onNext={() => setActive('brand')}
            />
          ) : active === 'brand' ? (
            <BrandPanel
              settings={settings}
              copy={currentCopy}
              onSetRules={setBrandRules}
              onAddRules={addBrandRules}
              onOpenSettings={openSettings}
              onGoCopy={() => setActive('copy')}
              onNext={() => setActive('calendar')}
            />
          ) : active === 'calendar' ? (
            <CalendarPanel
              settings={settings}
              media={media}
              clips={currentClips}
              copy={currentCopy}
              schedule={currentSchedule}
              onScheduleChange={setSchedule}
              onGoCopy={() => setActive('copy')}
              onNext={() => setActive('performance')}
            />
          ) : active === 'performance' ? (
            <PerformancePanel
              settings={settings}
              media={media}
              clips={currentClips}
              schedule={currentSchedule}
              performance={currentPerformance}
              onPerformanceChange={setPerformance}
              onSaveLearnings={(learnings) => setSettings((s) => ({ ...s, learnings }))}
              onOpenSettings={openSettings}
              onGoCalendar={() => setActive('calendar')}
              onGoClips={() => setActive('clips')}
            />
          ) : (
            <Placeholder step={step} />
          )}
        </main>
      </div>

      {showSettings && <Settings settings={settings} onSave={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  )
}
